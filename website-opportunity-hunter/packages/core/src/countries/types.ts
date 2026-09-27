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
  /**
   * The comparison form of a postcode: punctuation and spacing removed, so two
   * sources that spell the same postcode differently still match. Distinct from
   * `normalisePostcode`, which produces the form a human expects to read.
   */
  postcodeKey(value: string | null | undefined): string | null;
  /** Notes surfaced in the UI about lawful processing in this jurisdiction. */
  privacyNotes: string[];
  /**
   * What to say when a prospect asks where their contact details came from.
   *
   * This is the operator's script, not a legal notice, so it is written in the
   * language they will be speaking and in the second person. It exists because
   * the honest answer is short and specific — a named public register, which
   * the prospect can check — and improvising under pressure tends to produce
   * something vaguer and worse. The right to object is theirs, so the script
   * ends by offering erasure rather than waiting to be asked.
   */
  sourceDisclosure: {
    /** Where the details came from, in one or two sentences. */
    answer: string;
    /** Where the prospect can see the register for themselves. */
    verifyUrl: string;
    /** What the operator offers next, unprompted. */
    offer: string;
  };
  enabled: boolean;
}
