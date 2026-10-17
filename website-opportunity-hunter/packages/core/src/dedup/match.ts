import { nameSimilarity } from './normalize.js';

export interface MatchCandidate {
  id: string;
  companyNumber?: string | null;
  normalisedName: string;
  postcodeKey?: string | null;
  domain?: string | null;
  phoneKey?: string | null;
}

export interface MatchResult {
  candidate: MatchCandidate;
  reason: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface MatchTarget {
  companyNumber?: string | null;
  normalisedName: string;
  postcodeKey?: string | null;
  domain?: string | null;
  phoneKey?: string | null;
}

/** Similarity above which two names at one postcode are treated as the same. */
export const NAME_MATCH_THRESHOLD = 0.8;

/**
 * Decides whether an incoming company is one we already have.
 *
 * Only an exact registry-number or domain match is treated as HIGH confidence.
 * Name-based matches require a corroborating postcode or phone number, because
 * "Smith Roofing Ltd" is a name many unrelated businesses share.
 */
export function findDuplicate(target: MatchTarget, candidates: MatchCandidate[]): MatchResult | null {
  const targetNumber = target.companyNumber?.trim().toUpperCase();
  if (targetNumber) {
    const hit = candidates.find((c) => c.companyNumber?.trim().toUpperCase() === targetNumber);
    if (hit) return { candidate: hit, reason: `same company number ${targetNumber}`, confidence: 'HIGH' };
  }

  if (target.domain) {
    const hit = candidates.find((c) => c.domain && c.domain === target.domain);
    if (hit) return { candidate: hit, reason: `same domain ${target.domain}`, confidence: 'HIGH' };
  }

  if (target.postcodeKey && target.normalisedName) {
    for (const c of candidates) {
      if (!c.postcodeKey || c.postcodeKey !== target.postcodeKey) continue;
      const similarity = nameSimilarity(target.normalisedName, c.normalisedName);
      if (similarity >= NAME_MATCH_THRESHOLD) {
        return {
          candidate: c,
          reason: `same postcode and ${Math.round(similarity * 100)}% name overlap`,
          confidence: similarity === 1 ? 'HIGH' : 'MEDIUM',
        };
      }
    }
  }

  if (target.phoneKey && target.normalisedName) {
    for (const c of candidates) {
      if (!c.phoneKey || c.phoneKey !== target.phoneKey) continue;
      const similarity = nameSimilarity(target.normalisedName, c.normalisedName);
      if (similarity >= 0.5) {
        return { candidate: c, reason: 'same phone number and similar name', confidence: 'MEDIUM' };
      }
    }
  }

  return null;
}
