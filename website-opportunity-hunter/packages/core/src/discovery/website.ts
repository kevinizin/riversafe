import type {
  Confidence,
  DiscoveryMethod,
  SourceCompany,
  WebsiteStatus,
} from '../domain/types.js';
import { describeError } from '../domain/errors.js';
import { normaliseCompanyName, normaliseDomain, normalisePhone } from '../dedup/normalize.js';
import { postcodeKey as ukPostcodeKey } from '../geo/uk.js';
import { logger } from '../logging/logger.js';
import type { PlaceProvider, PlaceRecord } from '../providers/places/types.js';
import type { WebSearchProvider } from '../providers/search/types.js';
import { extractFacts } from '../analyzer/extract.js';
import { fetchPage, type FetchPageDeps } from '../analyzer/fetchPage.js';
import { isExcludedHost } from './excluded.js';

export interface WebsiteCandidate {
  url: string;
  domain: string;
  method: DiscoveryMethod;
  /** Signals that tie this domain to this company. */
  matches: string[];
  confidence: Confidence;
  evidence: string;
}

export type MethodOutcome = 'FOUND' | 'NO_RESULTS' | 'UNAVAILABLE' | 'SKIPPED';

export interface MethodAttempt {
  method: DiscoveryMethod;
  outcome: MethodOutcome;
  note: string;
}

export interface WebsiteDiscoveryResult {
  status: WebsiteStatus;
  confidence: Confidence;
  /** Plain-English justification shown next to the status in the UI. */
  note: string;
  website?: WebsiteCandidate;
  /** Runner-up candidates, kept as evidence for the operator. */
  others: WebsiteCandidate[];
  attempts: MethodAttempt[];
}

export interface DiscoveryDeps extends FetchPageDeps {
  webSearch: WebSearchProvider;
  places: PlaceProvider;
}

export interface DiscoveryInput {
  company: Pick<SourceCompany, 'name' | 'address' | 'countryCode'> & {
    website?: string | undefined;
    phone?: string | undefined;
  };
  /** ccTLDs to try when generating candidate domains. */
  domainSuffixes: string[];
  legalSuffixes: string[];
  /** Cap on speculative domain probes. Each one is an HTTP request. */
  maxDomainProbes?: number;
  /** Cap on verification fetches of search results. */
  maxVerifications?: number;
  /**
   * A business listing already fetched by an earlier pipeline stage. Passing it
   * here avoids paying for the same Places lookup twice; `undefined` means
   * "look it up", `null` means "looked up, nothing found".
   */
  place?: PlaceRecord | null;
}

/**
 * Tries, in cost order, to find the company's own website.
 *
 * The contract that matters is the negative one. `NO_WEBSITE_FOUND` is only
 * returned when at least two independent methods actually ran and came back
 * empty, and even then the confidence is capped at MEDIUM and the note says
 * which methods were used. If every method was unavailable — no search API
 * configured, for instance — the answer is `WEBSITE_UNCERTAIN`, never "no
 * website". The UI renders this as "website not found", never "has no website".
 */
export async function discoverWebsite(
  input: DiscoveryInput,
  deps: DiscoveryDeps,
): Promise<WebsiteDiscoveryResult> {
  const { company } = input;
  const attempts: MethodAttempt[] = [];
  const candidates: WebsiteCandidate[] = [];
  const verified = new Set<string>();
  const maxVerifications = input.maxVerifications ?? 4;
  let verifications = 0;

  const expectation = buildExpectation(input);

  const tryVerify = async (
    rawUrl: string,
    method: DiscoveryMethod,
  ): Promise<WebsiteCandidate | null> => {
    const domain = normaliseDomain(rawUrl);
    if (!domain || isExcludedHost(domain) || verified.has(domain)) return null;
    verified.add(domain);
    if (verifications >= maxVerifications) return null;
    verifications += 1;

    const url = domain.startsWith('http') ? domain : `https://${domain}/`;
    const page = await fetchPage(url, deps);
    if (!page.ok || !page.html) {
      logger.debug('discovery.candidate_unreachable', 'candidate site did not load', {
        domain,
        error: page.errorCode,
      });
      return null;
    }
    const facts = extractFacts(page.html, page.finalUrl ?? url);
    const matches = matchEvidence(facts.text, facts.title ?? '', expectation);
    if (matches.length === 0) return null;

    const confidence: Confidence = matches.length >= 2 ? 'HIGH' : 'MEDIUM';
    return {
      url: page.finalUrl ?? url,
      domain,
      method,
      matches,
      confidence,
      evidence: `homepage matched ${matches.join(' and ')}`,
    };
  };

  // 1. The source provider published a website field.
  if (company.website) {
    const domain = normaliseDomain(company.website);
    if (domain && !isExcludedHost(domain)) {
      candidates.push({
        url: company.website,
        domain,
        method: 'SOURCE_RECORD',
        matches: ['published by the company registry or listing source'],
        confidence: 'HIGH',
        evidence: 'the source record itself carries this website',
      });
      attempts.push({ method: 'SOURCE_RECORD', outcome: 'FOUND', note: `source record lists ${domain}` });
    } else {
      attempts.push({ method: 'SOURCE_RECORD', outcome: 'NO_RESULTS', note: 'source website was a directory or invalid' });
    }
  } else {
    attempts.push({ method: 'SOURCE_RECORD', outcome: 'NO_RESULTS', note: 'the source record has no website field' });
  }

  // 2. Business listing provider.
  if (candidates.length === 0) {
    try {
      const place =
        input.place !== undefined
          ? input.place
          : await deps.places.findPlace({
              name: company.name,
              ...(company.address.line1 ? { address: company.address.line1 } : {}),
              ...(company.address.city ? { city: company.address.city } : {}),
              countryCode: company.countryCode,
            });
      if (place?.websiteUri) {
        const candidate = await tryVerify(place.websiteUri, 'PLACES_PROVIDER');
        if (candidate) {
          candidates.push(candidate);
          attempts.push({ method: 'PLACES_PROVIDER', outcome: 'FOUND', note: `listing links ${candidate.domain}` });
        } else {
          attempts.push({
            method: 'PLACES_PROVIDER',
            outcome: 'NO_RESULTS',
            note: 'listing website did not verify against the company details',
          });
        }
      } else {
        attempts.push({ method: 'PLACES_PROVIDER', outcome: 'NO_RESULTS', note: 'no matching business listing with a website' });
      }
    } catch (err) {
      const { code, message } = describeError(err);
      attempts.push({
        method: 'PLACES_PROVIDER',
        outcome: code === 'PROVIDER_NOT_CONFIGURED' ? 'SKIPPED' : 'UNAVAILABLE',
        note: message,
      });
    }
  }

  // 3-5. Web search by name+location, then name, then phone.
  const searchPlans: { method: DiscoveryMethod; query: string | null }[] = [
    {
      method: 'WEB_SEARCH_NAME_LOCATION',
      query: company.address.city ? `"${company.name}" ${company.address.city}` : null,
    },
    { method: 'WEB_SEARCH_NAME', query: `"${company.name}"` },
    {
      method: 'WEB_SEARCH_PHONE',
      query: company.phone ? `"${company.phone}"` : null,
    },
  ];

  for (const plan of searchPlans) {
    if (candidates.length > 0) break;
    if (!plan.query) {
      attempts.push({ method: plan.method, outcome: 'SKIPPED', note: 'not enough data to build this query' });
      continue;
    }
    try {
      const results = await deps.webSearch.search(plan.query, { count: 8, countryCode: company.countryCode });
      const usable = results.filter((r) => !isExcludedHost(normaliseDomain(r.url)));
      if (usable.length === 0) {
        attempts.push({ method: plan.method, outcome: 'NO_RESULTS', note: 'search returned no non-directory results' });
        continue;
      }
      let matched = false;
      for (const result of usable.slice(0, 4)) {
        const candidate = await tryVerify(result.url, plan.method);
        if (candidate) {
          candidates.push(candidate);
          matched = true;
          break;
        }
      }
      attempts.push({
        method: plan.method,
        outcome: matched ? 'FOUND' : 'NO_RESULTS',
        note: matched
          ? `verified ${candidates[candidates.length - 1]!.domain}`
          : `checked ${Math.min(usable.length, 4)} result(s); none matched the company details`,
      });
    } catch (err) {
      const { code, message } = describeError(err);
      attempts.push({
        method: plan.method,
        outcome: code === 'PROVIDER_NOT_CONFIGURED' ? 'SKIPPED' : 'UNAVAILABLE',
        note: message,
      });
    }
  }

  // 6. Speculative domains built from the company name.
  if (candidates.length === 0) {
    const probes = candidateDomains(company.name, input.legalSuffixes, input.domainSuffixes).slice(
      0,
      input.maxDomainProbes ?? 6,
    );
    if (probes.length === 0) {
      attempts.push({ method: 'DOMAIN_CANDIDATE', outcome: 'SKIPPED', note: 'company name is too generic to guess a domain' });
    } else {
      let matched: WebsiteCandidate | null = null;
      for (const probe of probes) {
        matched = await tryVerify(probe, 'DOMAIN_CANDIDATE');
        if (matched) break;
      }
      if (matched) {
        candidates.push(matched);
        attempts.push({ method: 'DOMAIN_CANDIDATE', outcome: 'FOUND', note: `verified ${matched.domain}` });
      } else {
        attempts.push({
          method: 'DOMAIN_CANDIDATE',
          outcome: 'NO_RESULTS',
          note: `probed ${probes.length} likely domain(s); none matched`,
        });
      }
    }
  }

  return summarise(candidates, attempts);
}

interface Expectation {
  normalisedName: string;
  nameTokens: string[];
  postcodeKey: string | null;
  postcodeDisplay: string | null;
  phoneKey: string | null;
  city: string | null;
}

function buildExpectation(input: DiscoveryInput): Expectation {
  const { company } = input;
  const normalisedName = normaliseCompanyName(company.name, input.legalSuffixes);
  return {
    normalisedName,
    nameTokens: normalisedName.split(' ').filter((t) => t.length >= 3),
    postcodeKey: company.countryCode === 'GB' ? ukPostcodeKey(company.address.postcode) : null,
    postcodeDisplay: company.address.postcode ?? null,
    phoneKey: normalisePhone(company.phone, company.countryCode),
    city: company.address.city?.toLowerCase() ?? null,
  };
}

/** Which company facts the page actually repeats back to us. */
function matchEvidence(text: string, title: string, expected: Expectation): string[] {
  const haystack = `${title} ${text}`.toLowerCase();
  const compact = haystack.replace(/[^a-z0-9]/g, '');
  const matches: string[] = [];

  if (expected.normalisedName && compact.includes(expected.normalisedName.replace(/\s/g, ''))) {
    matches.push('the company name');
  } else if (expected.nameTokens.length >= 2 && expected.nameTokens.every((t) => haystack.includes(t))) {
    matches.push('every distinctive word of the company name');
  }

  if (expected.postcodeKey && compact.includes(expected.postcodeKey.toLowerCase())) {
    matches.push(`the registered postcode ${expected.postcodeDisplay}`);
  }

  if (expected.phoneKey) {
    const digits = haystack.replace(/\D/g, '');
    if (digits.includes(expected.phoneKey)) matches.push('the company phone number');
  }

  return matches;
}

/** Plausible domains for a business name, most likely first. */
export function candidateDomains(name: string, legalSuffixes: string[], tlds: string[]): string[] {
  const normalised = normaliseCompanyName(name, legalSuffixes);
  const tokens = normalised.split(' ').filter(Boolean);
  if (tokens.length === 0) return [];

  // A single very short or generic token is not distinctive enough to guess.
  const joined = tokens.join('');
  if (joined.length < 6) return [];

  const stems = new Set<string>([joined]);
  if (tokens.length >= 2) {
    stems.add(tokens.join('-'));
    stems.add(tokens.slice(0, 2).join(''));
  }

  const out: string[] = [];
  for (const stem of stems) {
    for (const tld of tlds) {
      out.push(`https://${stem}${tld.startsWith('.') ? tld : `.${tld}`}/`);
    }
  }
  return out;
}

function summarise(candidates: WebsiteCandidate[], attempts: MethodAttempt[]): WebsiteDiscoveryResult {
  const ranked = [...candidates].sort(
    (a, b) => rank(b.confidence) - rank(a.confidence) || b.matches.length - a.matches.length,
  );
  const best = ranked[0];

  if (best) {
    return {
      status: best.confidence === 'HIGH' ? 'WEBSITE_FOUND' : 'WEBSITE_UNCERTAIN',
      confidence: best.confidence,
      note:
        best.confidence === 'HIGH'
          ? `Found ${best.domain}; ${best.evidence}.`
          : `Possible website ${best.domain}; only ${best.matches.join(' and ')} matched, so this needs a human check.`,
      website: best,
      others: ranked.slice(1),
      attempts,
    };
  }

  // Only methods that actively went looking count towards "we searched".
  // SOURCE_RECORD is not a search: a registry record simply has no website
  // field, and treating that absence as a completed check is how a system ends
  // up asserting "no website" on the strength of having looked nowhere.
  const ran = attempts.filter((a) => a.outcome === 'NO_RESULTS' && a.method !== 'SOURCE_RECORD');
  const blocked = attempts.filter((a) => a.outcome === 'UNAVAILABLE' || a.outcome === 'SKIPPED');

  if (ran.length >= 2) {
    return {
      status: 'NO_WEBSITE_FOUND',
      // Capped at MEDIUM by design: absence of evidence is not evidence of
      // absence, and a website can exist under a name we never searched for.
      confidence: 'MEDIUM',
      note:
        `No website found after ${ran.length} discovery method(s): ` +
        `${ran.map((a) => methodLabel(a.method)).join(', ')}.` +
        (blocked.length ? ` ${blocked.length} further method(s) were unavailable.` : ''),
      others: [],
      attempts,
    };
  }

  return {
    status: 'WEBSITE_UNCERTAIN',
    confidence: 'LOW',
    note:
      `Website not checked properly: only ${ran.length} discovery method(s) could run. ` +
      `${blocked.map((a) => `${methodLabel(a.method)} (${a.note})`).join('; ')}`,
    others: [],
    attempts,
  };
}

const rank = (c: Confidence): number => (c === 'HIGH' ? 2 : c === 'MEDIUM' ? 1 : 0);

export function methodLabel(method: DiscoveryMethod): string {
  switch (method) {
    case 'SOURCE_RECORD': return 'registry record';
    case 'DOMAIN_CANDIDATE': return 'likely domain probe';
    case 'WEB_SEARCH_NAME': return 'web search by name';
    case 'WEB_SEARCH_NAME_LOCATION': return 'web search by name and town';
    case 'WEB_SEARCH_PHONE': return 'web search by phone number';
    case 'WEB_SEARCH_ADDRESS': return 'web search by address';
    case 'PLACES_PROVIDER': return 'business listing lookup';
    case 'SOCIAL_PROFILE_LINK': return 'link from a social profile';
    case 'WEBSITE_LINK': return 'link from another site';
    case 'MANUAL': return 'entered by a user';
  }
}
