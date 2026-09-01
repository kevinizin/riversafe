/**
 * Vocabulary shared by every module.
 *
 * The central idea: nothing in this system is allowed to be a bare value.
 * Anything obtained from the outside world travels as a `Sourced<T>` — a value
 * plus where it came from, when, and how sure we are. That is what makes the
 * "never invent anything" rule mechanically enforceable rather than aspirational.
 */

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export const CONFIDENCE_ORDER: Record<Confidence, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

export function minConfidence(...values: Confidence[]): Confidence {
  return values.reduce<Confidence>(
    (lowest, v) => (CONFIDENCE_ORDER[v] < CONFIDENCE_ORDER[lowest] ? v : lowest),
    'HIGH',
  );
}

export function maxConfidence(...values: Confidence[]): Confidence {
  return values.reduce<Confidence>(
    (highest, v) => (CONFIDENCE_ORDER[v] > CONFIDENCE_ORDER[highest] ? v : highest),
    'LOW',
  );
}

/** Where a fact came from, precise enough for a human to re-check it. */
export interface Evidence {
  /** Machine name of the origin, e.g. "companies_house", "website:example.co.uk". */
  source: string;
  /** Public URL backing the claim, when one exists and may be stored. */
  sourceUrl?: string;
  /** When we observed it. */
  detectedAt: Date;
  /** The literal thing we saw: a matched postcode, a <title>, a JSON field name. */
  excerpt?: string;
}

/** A value we obtained from somewhere, never a value we assumed. */
export interface Sourced<T> {
  value: T;
  confidence: Confidence;
  evidence: Evidence;
  /** True when the value was derived rather than read verbatim from a source. */
  inferred: boolean;
}

export function sourced<T>(
  value: T,
  confidence: Confidence,
  evidence: Evidence,
  inferred = false,
): Sourced<T> {
  return { value, confidence, evidence, inferred };
}

/**
 * The result of looking for something. `NOT_FOUND` is a first-class outcome and
 * is deliberately different from `UNAVAILABLE` (we were blocked or the source
 * errored) — conflating them is how systems start asserting that a company has
 * no website when in truth nobody looked successfully.
 */
export type Lookup<T> =
  | { kind: 'FOUND'; data: Sourced<T> }
  | { kind: 'NOT_FOUND'; searchedWith: string[]; note?: string }
  | { kind: 'UNAVAILABLE'; reason: string; retryable: boolean };

export const found = <T>(data: Sourced<T>): Lookup<T> => ({ kind: 'FOUND', data });
export const notFound = <T>(searchedWith: string[], note?: string): Lookup<T> => ({
  kind: 'NOT_FOUND',
  searchedWith,
  note,
});
export const unavailable = <T>(reason: string, retryable = true): Lookup<T> => ({
  kind: 'UNAVAILABLE',
  reason,
  retryable,
});

/** ISO 3166-1 alpha-2. Only 'GB' is implemented in the MVP. */
export type CountryCode = string;

export interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postcode?: string;
  country?: string;
}

export type CompanyStatus =
  | 'ACTIVE'
  | 'DISSOLVED'
  | 'LIQUIDATION'
  | 'ADMINISTRATION'
  | 'CLOSED'
  | 'OTHER'
  | 'UNKNOWN';

/** A company exactly as a source provider described it — before enrichment. */
export interface SourceCompany {
  countryCode: CountryCode;
  /** Registry number where the source has one. */
  companyNumber?: string;
  name: string;
  status: CompanyStatus;
  incorporationDate?: Date;
  sicCodes: string[];
  address: Address;
  /** Only when the source itself publishes it. Never guessed. */
  website?: string;
  phone?: string;
  /** Provider identity, so CompanySource rows stay unique and auditable. */
  provider: string;
  externalId: string;
  sourceUrl?: string;
  /** Untouched provider payload, stored for auditability. */
  raw: unknown;
}

export type SocialPlatform =
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'LINKEDIN'
  | 'X'
  | 'TIKTOK'
  | 'YOUTUBE'
  | 'GOOGLE_BUSINESS';

export type DiscoveryMethod =
  | 'SOURCE_RECORD'
  | 'DOMAIN_CANDIDATE'
  | 'WEB_SEARCH_NAME'
  | 'WEB_SEARCH_NAME_LOCATION'
  | 'WEB_SEARCH_PHONE'
  | 'WEB_SEARCH_ADDRESS'
  | 'PLACES_PROVIDER'
  | 'SOCIAL_PROFILE_LINK'
  | 'WEBSITE_LINK'
  | 'MANUAL';

export type SignalType =
  | 'RECENT_INCORPORATION'
  | 'OPENING_SOON'
  | 'NOW_OPEN'
  | 'GRAND_OPENING'
  | 'NEW_BUSINESS'
  | 'NEW_LOCATION'
  | 'COMING_SOON'
  | 'RECENT_REVIEWS'
  | 'RECENT_SOCIAL_ACTIVITY'
  | 'RECENTLY_REGISTERED_DOMAIN'
  | 'UNDER_CONSTRUCTION_WEBSITE'
  | 'HIRING';

export interface BusinessActivitySignal {
  type: SignalType;
  source: string;
  sourceUrl?: string;
  detectedAt: Date;
  occurredAt?: Date;
  confidence: Confidence;
  /** Never empty. If we cannot quote what we saw, we do not record the signal. */
  evidence: string;
}

export type Classification =
  | 'HOT'
  | 'HIGH_OPPORTUNITY'
  | 'WARM'
  | 'LOW_PRIORITY'
  | 'IGNORE';

export type WebsiteStatus =
  | 'NOT_CHECKED'
  | 'NO_WEBSITE_FOUND'
  | 'WEBSITE_UNCERTAIN'
  | 'WEBSITE_FOUND';
