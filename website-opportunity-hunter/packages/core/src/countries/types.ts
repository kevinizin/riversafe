import type { CountryCode } from '../domain/types.js';

/**
 * Everything country-specific lives behind this interface. Adding Germany means
 * writing one `CountryProfile` and one `CompanySourceProvider`; no scoring,
 * pipeline or UI code changes.
 */
export interface CountryProfile {
  code: CountryCode;
  name: string;
  currency: string;
  currencySymbol: string;
  language: string;
  timezone: string;
  /** Providers that can enumerate companies for this country, best first. */
  companyProviders: string[];
  /** Top-level administrative divisions offered in the search UI. */
  regions: string[];
  /** Shortlist of cities; free text is always accepted too. */
  cities: string[];
  /** Country-code TLDs used when generating candidate domains. */
  domainSuffixes: string[];
  /** Legal-entity suffixes stripped during name normalisation. */
  legalSuffixes: string[];
  /** Normalises a postcode to a canonical form, or null if it is not valid. */
  normalisePostcode(value: string | null | undefined): string | null;
  /** Notes surfaced in the UI about lawful processing in this jurisdiction. */
  privacyNotes: string[];
  enabled: boolean;
}
