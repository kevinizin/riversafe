import type { CountryCode, Lookup, SourceCompany } from '../../domain/types.js';

/**
 * An officer of a company, reduced to what a B2B approach actually needs.
 *
 * The registry publishes far more than this — correspondence address, month and
 * year of birth, nationality, country of residence, former names, an internal
 * person number. None of it is represented here, because a type that cannot
 * carry a field is a stronger guarantee than a policy saying we will not read
 * it. See PRIVACY.md.
 */
export interface OfficerRecord {
  /** Present only when the deployment sets COLLECT_OFFICER_NAMES=true. */
  name?: string;
  /** Registry role string, e.g. "director", "llp-designated-member". */
  role: string;
  appointedOn?: Date;
  /** Self-declared occupation, when the registry has one. */
  occupation?: string;
  /** True when the officer is another company rather than a person. */
  isCorporate: boolean;
  /** True when the registry still lists the appointment as current. */
  isActive: boolean;
  sourceUrl?: string;
}

export interface CompanySearchFilters {
  countryCode: CountryCode;
  /** Registry classification codes (SIC for GB). Empty means "any". */
  registryCodes?: string[];
  /** Free-text town/city passed to the provider's own location filter. */
  location?: string;
  incorporatedFrom?: Date;
  incorporatedTo?: Date;
  /** Provider-native status values; the provider maps them. Defaults to active. */
  statuses?: string[];
  nameIncludes?: string;
  nameExcludes?: string;
}

export interface CompanySearchPage {
  companies: SourceCompany[];
  /** Total matches the provider reports, when it reports one. */
  total?: number;
  /** Cursor for the next page, or undefined when the results are exhausted. */
  nextStartIndex?: number;
}

export interface CompanySearchOptions {
  startIndex?: number;
  pageSize?: number;
  signal?: AbortSignal;
}

/**
 * A source of companies for one or more countries.
 *
 * Everything downstream — enrichment, scoring, the dashboard — is written
 * against this interface, so a second UK source or a first German source is an
 * additive change.
 */
export interface CompanySourceProvider {
  readonly name: string;
  readonly countries: CountryCode[];
  /** False when the deployment has no credentials for it. Callers must check. */
  isConfigured(): boolean;
  searchCompanies(filters: CompanySearchFilters, options?: CompanySearchOptions): Promise<CompanySearchPage>;
  getCompanyDetails(companyId: string): Promise<Lookup<SourceCompany>>;
  /**
   * Officers, where the registry publishes them. Optional: a source that has no
   * officer register simply does not implement it, and the pipeline records the
   * stage as SKIPPED rather than failing.
   */
  getOfficers?(companyId: string, options?: { includeNames?: boolean }): Promise<Lookup<OfficerRecord[]>>;
}
