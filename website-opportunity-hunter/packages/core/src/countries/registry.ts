import type { CountryCode } from '../domain/types.js';
import type { CountryProfile } from './types.js';
import { UNITED_KINGDOM } from './uk.js';

/**
 * Countries the installation can search.
 *
 * The MVP ships the United Kingdom only. Germany, the Netherlands, France,
 * Spain, Ireland, Portugal and Italy are intentionally absent rather than
 * half-implemented: each needs its own registry provider and its own privacy
 * review before it can be switched on.
 */
const PROFILES = new Map<CountryCode, CountryProfile>([[UNITED_KINGDOM.code, UNITED_KINGDOM]]);

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
