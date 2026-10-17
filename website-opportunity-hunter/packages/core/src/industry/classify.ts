import type { Confidence } from '../domain/types.js';
import { INDUSTRIES, INDUSTRY_BY_KEY } from './taxonomy.js';
import type { IndustryMatch, IndustryProfile } from './types.js';

export interface ClassifyInput {
  countryCode: string;
  name: string;
  sicCodes: string[];
  /** Optional extra text: website title, meta description, headings. */
  text?: string;
  /** Industries the operator asked for. Used to break genuine ties, never to
   *  invent a match that the evidence does not support. */
  requestedIndustryKeys?: string[];
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

function keywordHits(profile: IndustryProfile, haystack: string): string[] {
  return profile.keywords.filter((k) => haystack.includes(normalise(k)));
}

function vetoed(profile: IndustryProfile, haystack: string): string | null {
  return profile.negativeKeywords.find((k) => haystack.includes(normalise(k))) ?? null;
}

/**
 * Rule-based industry classification.
 *
 * Deliberately not an LLM call: SIC codes plus keywords settle the large
 * majority of cases for free and deterministically. `needsAiFallback()` marks
 * the residue where a model earns its cost.
 */
export function classify(input: ClassifyInput): IndustryMatch[] {
  const haystack = normalise([input.name, input.text ?? ''].join(' '));
  const sicSet = new Set(input.sicCodes.map((c) => c.trim()));
  const matches: IndustryMatch[] = [];

  for (const profile of INDUSTRIES) {
    const codes = profile.registryCodes[input.countryCode] ?? [];
    const matchedCodes = codes.filter((c) => sicSet.has(c));
    const hits = keywordHits(profile, haystack);

    if (matchedCodes.length === 0 && hits.length === 0) continue;

    const veto = vetoed(profile, haystack);
    if (veto) continue;

    // How many other industries claim the same code? A code shared by several
    // sectors (43220 covers plumbing and heating) is weaker evidence on its own.
    const shared = matchedCodes.length
      ? INDUSTRIES.filter(
          (other) =>
            other.key !== profile.key &&
            matchedCodes.some((c) => (other.registryCodes[input.countryCode] ?? []).includes(c)),
        ).length
      : 0;

    let confidence: Confidence;
    let method: IndustryMatch['method'];
    const evidenceParts: string[] = [];

    if (matchedCodes.length > 0) {
      method = 'SIC_CODE';
      evidenceParts.push(`SIC ${matchedCodes.join(', ')}`);
      if (hits.length > 0) {
        confidence = 'HIGH';
        evidenceParts.push(`name/text matched: ${hits.join(', ')}`);
      } else {
        confidence = shared > 0 ? 'MEDIUM' : 'HIGH';
        if (shared > 0) evidenceParts.push(`code also used by ${shared} other sector(s)`);
      }
    } else {
      method = 'KEYWORD';
      confidence = hits.length >= 2 ? 'MEDIUM' : 'LOW';
      evidenceParts.push(`name/text matched: ${hits.join(', ')}`);
    }

    const sub = profile.subIndustries.find((s) =>
      s.keywords.some((k) => haystack.includes(normalise(k))),
    );

    matches.push({
      industryKey: profile.key,
      ...(sub ? { subIndustryKey: sub.key } : {}),
      method,
      confidence,
      evidence: evidenceParts.join('; '),
    });
  }

  const rank: Record<Confidence, number> = { HIGH: 2, MEDIUM: 1, LOW: 0 };
  const requested = new Set(input.requestedIndustryKeys ?? []);
  return matches.sort((a, b) => {
    const byRequested = Number(requested.has(b.industryKey)) - Number(requested.has(a.industryKey));
    if (byRequested !== 0) return byRequested;
    return rank[b.confidence] - rank[a.confidence];
  });
}

/** The primary industry, or undefined when nothing matched. Never guesses. */
export function primaryIndustry(matches: IndustryMatch[]): IndustryMatch | undefined {
  return matches[0];
}

/**
 * True when rules produced nothing usable and a language model could plausibly
 * do better — the only situation in which the AI classifier is worth its cost.
 */
export function needsAiFallback(matches: IndustryMatch[]): boolean {
  const best = matches[0];
  return !best || best.confidence === 'LOW';
}

/** Commercial weight of the best match, or a neutral default when unknown. */
export function commercialWeightOf(industryKey: string | undefined): number {
  if (!industryKey) return 0.5;
  return INDUSTRY_BY_KEY.get(industryKey)?.commercialWeight ?? 0.5;
}
