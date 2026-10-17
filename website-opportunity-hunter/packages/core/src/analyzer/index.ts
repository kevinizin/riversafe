import { getIndustry } from '../industry/taxonomy.js';
import { extractFacts, type PageFacts } from './extract.js';
import { fetchPage, type FetchPageDeps, type PageFetch } from './fetchPage.js';
import { qualityBand, scoreWebsite, type WebsiteQuality, type WebsiteQualityBand } from './score.js';

export * from './extract.js';
export * from './fetchPage.js';
export * from './score.js';

export interface AnalyzeOptions {
  /** Primary industry key, used to decide whether booking is expected. */
  industryKey?: string;
  /** How many internal links to sample for broken-link checking. 0 disables. */
  linkSampleSize?: number;
}

export interface WebsiteAnalysisResult {
  fetch: PageFetch;
  facts?: PageFacts;
  quality?: WebsiteQuality;
  band?: WebsiteQualityBand;
  brokenLinkCount?: number;
  checkedLinkCount?: number;
  /** True when the page is a placeholder rather than a working site. */
  underConstruction: boolean;
  underConstructionEvidence?: string;
}

const PLACEHOLDER_PHRASES = [
  'under construction',
  'coming soon',
  'site is being updated',
  'website is being updated',
  'opening soon',
  'launching soon',
  'this domain is parked',
  'buy this domain',
  'default web page',
  'index of /',
];

const MIN_REAL_PAGE_TEXT = 300;

/**
 * Fetches and analyses one prospect website.
 *
 * The whole operation is best-effort: any failure produces a result with an
 * error code rather than an exception, because a website that will not load is
 * information about the lead, not a reason to abandon it.
 */
export async function analyzeWebsite(
  url: string,
  deps: FetchPageDeps,
  options: AnalyzeOptions = {},
): Promise<WebsiteAnalysisResult> {
  const page = await fetchPage(url, deps);
  if (!page.ok || !page.html) {
    return { fetch: page, underConstruction: false };
  }

  const facts = extractFacts(page.html, page.finalUrl ?? url);

  const lowerText = facts.text.toLowerCase();
  const placeholderHit = PLACEHOLDER_PHRASES.find((p) => lowerText.includes(p));
  const thin = facts.textLength < MIN_REAL_PAGE_TEXT;
  const underConstruction = !!placeholderHit || thin;
  const underConstructionEvidence = placeholderHit
    ? `page text contains "${placeholderHit}"`
    : thin
      ? `homepage has only ${facts.textLength} characters of text`
      : undefined;

  const sampleSize = options.linkSampleSize ?? 3;
  let brokenLinkCount: number | undefined;
  let checkedLinkCount: number | undefined;
  if (sampleSize > 0) {
    const sample = pickInternalLinks(facts, sampleSize);
    if (sample.length > 0) {
      const results = await Promise.all(sample.map((link) => fetchPage(link, deps)));
      checkedLinkCount = results.length;
      brokenLinkCount = results.filter(
        (r) => r.errorCode === 'HTTP_ERROR' || r.errorCode === 'WEBSITE_UNAVAILABLE',
      ).length;
    }
  }

  const profile = options.industryKey ? getIndustry(options.industryKey) : undefined;
  const quality = scoreWebsite(facts, {
    ...(page.responseTimeMs !== undefined ? { responseTimeMs: page.responseTimeMs } : {}),
    bookingExpected: profile?.bookingExpected ?? false,
    ...(brokenLinkCount !== undefined ? { brokenLinkCount } : {}),
    ...(checkedLinkCount !== undefined ? { checkedLinkCount } : {}),
  });

  return {
    fetch: page,
    facts,
    quality,
    band: qualityBand(quality.score),
    ...(brokenLinkCount !== undefined ? { brokenLinkCount } : {}),
    ...(checkedLinkCount !== undefined ? { checkedLinkCount } : {}),
    underConstruction,
    ...(underConstructionEvidence ? { underConstructionEvidence } : {}),
  };
}

/** Distinct internal pages, preferring the ones a customer would actually use. */
function pickInternalLinks(facts: PageFacts, limit: number): string[] {
  const seen = new Set<string>();
  const priority: string[] = [];
  const rest: string[] = [];
  for (const link of facts.links) {
    if (!link.internal || !link.absolute) continue;
    let url: URL;
    try {
      url = new URL(link.absolute);
    } catch {
      continue;
    }
    if (url.pathname === '/' || url.pathname === '') continue;
    const key = `${url.origin}${url.pathname}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (/contact|service|about|book|treatment/i.test(url.pathname)) priority.push(key);
    else rest.push(key);
  }
  return [...priority, ...rest].slice(0, limit);
}
