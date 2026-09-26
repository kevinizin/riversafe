import type { CountryCode } from '../domain/types.js';
import type { CountryProfile } from './types.js';
import { BRAZIL } from './br.js';
import { UNITED_KINGDOM } from './uk.js';

/**
 * Countries the installation can search.
 *
 * Two are implemented: the United Kingdom, through the Companies House search
 * API, and Brazil, through a local load of the Receita Federal open data.
 * They behave differently enough to be worth stating — the UK answers live
 * queries, Brazil answers from the last monthly import — and the country
 * profile is where that difference is declared rather than hidden.
 *
 * Other countries are intentionally absent rather than half-implemented: each
 * needs its own registry provider and its own privacy review first.
 */
const PROFILES = new Map<CountryCode, CountryProfile>([
  [UNITED_KINGDOM.code, UNITED_KINGDOM],
  [BRAZIL.code, BRAZIL],
]);

export function registerCountry(profile: CountryProfile): void {
  PROFILES.set(profile.code, profile);
}

export function getCountry(code: CountryCode): CountryProfile | undefined {
  return PROFILES.get(code.toUpperCase());
}

export function requireCountry(code: CountryCode): CountryProfile {
  const profile = getCountry(code);
  if (!profile) throw new Error(`Country ${code} is not supported in this installation`);
  return profile;
}

export function enabledCountries(): CountryProfile[] {
  return [...PROFILES.values()].filter((p) => p.enabled);
}
