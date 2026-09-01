import type { CountryCode, Lookup, SourceCompany } from '../../domain/types.js';

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
}
