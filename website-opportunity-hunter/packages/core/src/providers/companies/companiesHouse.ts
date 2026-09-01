import { AppError } from '../../domain/errors.js';
import {
  type CompanyStatus,
  type Lookup,
  type SourceCompany,
  found,
  notFound,
  sourced,
} from '../../domain/types.js';
import { HttpClient, type HttpClientOptions } from '../../net/httpClient.js';
import { getRateLimiter } from '../../net/rateLimiter.js';
import type {
  CompanySearchFilters,
  CompanySearchOptions,
  CompanySearchPage,
  CompanySourceProvider,
  OfficerRecord,
} from './types.js';

/**
 * Companies House Public Data API.
 *
 * Endpoints and field names are taken from the official specification:
 *   GET /advanced-search/companies  -> "A list of companies" resource
 *   GET /company/{companyNumber}    -> "Company profile" resource
 * Authentication is HTTP Basic with the API key as the username and an empty
 * password, exactly as the Companies House authentication guide describes.
 *
 * Rate limiting is applied client-side from configuration rather than guessed
 * from response headers; see DATA_SOURCES.md.
 */

/** Verbatim shape of the documented search response. */
interface ChSearchItem {
  company_name?: string;
  company_number?: string;
  company_status?: string;
  company_subtype?: string;
  company_type?: string;
  date_of_cessation?: string;
  date_of_creation?: string;
  kind?: string;
  links?: { company_profile?: string };
  registered_office_address?: {
    address_line_1?: string;
    address_line_2?: string;
    country?: string;
    locality?: string;
    postal_code?: string;
    region?: string;
  };
  sic_codes?: string[];
}

interface ChSearchResponse {
  etag?: string;
  hits?: string | number;
  items?: ChSearchItem[];
  kind?: string;
}

/**
 * The subset of the documented officerList resource we read.
 *
 * The full resource also carries `address`, `date_of_birth`, `nationality`,
 * `country_of_residence`, `former_names`, `person_number` and identity
 * verification details. They are deliberately absent from this interface so the
 * code physically cannot pick them up.
 */
interface ChOfficerItem {
  name?: string;
  officer_role?: string;
  appointed_on?: string;
  resigned_on?: string;
  occupation?: string;
  identification?: { identification_type?: string };
  links?: { self?: string };
}

interface ChOfficerListResponse {
  active_count?: number;
  items?: ChOfficerItem[];
  total_results?: number;
}

interface ChProfileResponse extends ChSearchItem {
  registered_office_is_in_dispute?: boolean;
  has_been_liquidated?: boolean;
  jurisdiction?: string;
}

/** Documented company_status enumeration -> our normalised status. */
const STATUS_MAP: Record<string, CompanyStatus> = {
  active: 'ACTIVE',
  dissolved: 'DISSOLVED',
  open: 'ACTIVE',
  closed: 'CLOSED',
  'converted-closed': 'CLOSED',
  receivership: 'ADMINISTRATION',
  administration: 'ADMINISTRATION',
  liquidation: 'LIQUIDATION',
  'insolvency-proceedings': 'LIQUIDATION',
  'voluntary-arrangement': 'OTHER',
  registered: 'ACTIVE',
  removed: 'CLOSED',
};

function mapStatus(raw: string | undefined): CompanyStatus {
  if (!raw) return 'UNKNOWN';
  return STATUS_MAP[raw.toLowerCase()] ?? 'OTHER';
}

/** Companies House dates are plain YYYY-MM-DD; parse them as UTC midnight. */
export function parseChDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return undefined;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function formatChDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface CompaniesHouseOptions {
  apiKey: string;
  baseUrl?: string;
  rateLimit?: number;
  rateWindowMs?: number;
  fetchImpl?: typeof fetch;
  onCall?: HttpClientOptions['onCall'];
}

const PROVIDER = 'companies_house';

export class CompaniesHouseProvider implements CompanySourceProvider {
  readonly name = PROVIDER;
  readonly countries = ['GB'];

  private readonly http: HttpClient;
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(private readonly options: CompaniesHouseOptions) {
    this.baseUrl = (options.baseUrl ?? 'https://api.company-information.service.gov.uk').replace(/\/$/, '');
    this.authHeader = `Basic ${Buffer.from(`${options.apiKey}:`).toString('base64')}`;
    this.http = new HttpClient({
      name: PROVIDER,
      rateLimiter: getRateLimiter(
        PROVIDER,
        options.rateLimit ?? 600,
        options.rateWindowMs ?? 300_000,
      ),
      maxRetries: 3,
      defaultTimeoutMs: 15_000,
      defaultMaxBytes: 4_000_000,
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      ...(options.onCall ? { onCall: options.onCall } : {}),
    });
  }

  isConfigured(): boolean {
    return this.options.apiKey.trim().length > 0;
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new AppError(
        'PROVIDER_NOT_CONFIGURED',
        'Companies House API key is not set. Add COMPANIES_HOUSE_API_KEY to run real UK searches.',
      );
    }
  }

  async searchCompanies(
    filters: CompanySearchFilters,
    options: CompanySearchOptions = {},
  ): Promise<CompanySearchPage> {
    this.assertConfigured();
    if (filters.countryCode.toUpperCase() !== 'GB') {
      throw new AppError('VALIDATION', `${PROVIDER} only serves GB, not ${filters.countryCode}`);
    }

    const pageSize = Math.min(Math.max(options.pageSize ?? 100, 1), 5000);
    const startIndex = options.startIndex ?? 0;

    const params = new URLSearchParams();
    params.set('size', String(pageSize));
    params.set('start_index', String(startIndex));
    if (filters.incorporatedFrom) params.set('incorporated_from', formatChDate(filters.incorporatedFrom));
    if (filters.incorporatedTo) params.set('incorporated_to', formatChDate(filters.incorporatedTo));
    if (filters.location) params.set('location', filters.location);
    if (filters.nameIncludes) params.set('company_name_includes', filters.nameIncludes);
    if (filters.nameExcludes) params.set('company_name_excludes', filters.nameExcludes);
    for (const code of filters.registryCodes ?? []) params.append('sic_codes', code);
    for (const status of filters.statuses ?? ['active']) params.append('company_status', status);

    const url = `${this.baseUrl}/advanced-search/companies?${params.toString()}`;
    const res = await this.http.request({
      url,
      headers: { authorization: this.authHeader, accept: 'application/json' },
      expectedStatuses: [404],
    });

    if (res.status === 404) return { companies: [], total: 0 };

    const body = parseJson<ChSearchResponse>(res.text, 'advanced-search/companies');
    const items = body.items ?? [];
    const total = typeof body.hits === 'string' ? Number(body.hits) : body.hits;

    const companies = items.map((item) => this.toSourceCompany(item));
    const consumed = startIndex + items.length;
    const hasMore = items.length === pageSize && (total === undefined || Number.isNaN(total) || consumed < total);

    return {
      companies,
      ...(total !== undefined && !Number.isNaN(total) ? { total } : {}),
      ...(hasMore ? { nextStartIndex: consumed } : {}),
    };
  }

  async getCompanyDetails(companyNumber: string): Promise<Lookup<SourceCompany>> {
    this.assertConfigured();
    const clean = companyNumber.trim().toUpperCase();
    if (!/^[A-Z0-9]{6,10}$/.test(clean)) {
      return notFound(['companies_house:company_profile'], `"${companyNumber}" is not a valid company number`);
    }

    const url = `${this.baseUrl}/company/${encodeURIComponent(clean)}`;
    const res = await this.http.request({
      url,
      headers: { authorization: this.authHeader, accept: 'application/json' },
      expectedStatuses: [404],
    });
    if (res.status === 404) {
      return notFound(['companies_house:company_profile'], `no Companies House record for ${clean}`);
    }

    const body = parseJson<ChProfileResponse>(res.text, `company/${clean}`);
    const company = this.toSourceCompany(body, clean);
    return found(
      sourced(company, 'HIGH', {
        source: PROVIDER,
        sourceUrl: `https://find-and-update.company-information.service.gov.uk/company/${clean}`,
        detectedAt: new Date(),
        excerpt: `company_status=${body.company_status ?? 'unknown'}`,
      }),
    );
  }

  /**
   * Active officers for a company.
   *
   * `includeNames` defaults to false: the role and appointment date are enough
   * to tell an owner-operated company from a large board, and a name is personal
   * data that a deployment must opt into collecting.
   */
  async getOfficers(
    companyNumber: string,
    options: { includeNames?: boolean } = {},
  ): Promise<Lookup<OfficerRecord[]>> {
    this.assertConfigured();
    const clean = companyNumber.trim().toUpperCase();
    if (!/^[A-Z0-9]{6,10}$/.test(clean)) {
      return notFound(['companies_house:officers'], `"${companyNumber}" is not a valid company number`);
    }

    const url = `${this.baseUrl}/company/${encodeURIComponent(clean)}/officers?items_per_page=50&order_by=appointed_on`;
    const res = await this.http.request({
      url,
      headers: { authorization: this.authHeader, accept: 'application/json' },
      expectedStatuses: [404],
    });
    if (res.status === 404) {
      return notFound(['companies_house:officers'], `no officer register for ${clean}`);
    }

    const body = parseJson<ChOfficerListResponse>(res.text, `company/${clean}/officers`);
    const officers = (body.items ?? []).map((item): OfficerRecord => {
      const role = (item.officer_role ?? 'unknown').toLowerCase();
      const appointedOn = parseChDate(item.appointed_on);
      return {
        ...(options.includeNames && item.name ? { name: item.name.trim() } : {}),
        role,
        ...(appointedOn ? { appointedOn } : {}),
        ...(item.occupation ? { occupation: item.occupation } : {}),
        isCorporate: role.startsWith('corporate-') || !!item.identification?.identification_type,
        isActive: !item.resigned_on,
        sourceUrl: `https://find-and-update.company-information.service.gov.uk/company/${clean}/officers`,
      };
    });

    if (officers.length === 0) {
      return notFound(['companies_house:officers'], `Companies House lists no officers for ${clean}`);
    }

    return found(
      sourced(officers, 'HIGH', {
        source: PROVIDER,
        sourceUrl: `https://find-and-update.company-information.service.gov.uk/company/${clean}/officers`,
        detectedAt: new Date(),
        excerpt: `${body.active_count ?? officers.filter((o) => o.isActive).length} active officer(s)`,
      }),
    );
  }

  private toSourceCompany(item: ChSearchItem, fallbackNumber?: string): SourceCompany {
    const number = item.company_number ?? fallbackNumber ?? '';
    const address = item.registered_office_address ?? {};
    const incorporationDate = parseChDate(item.date_of_creation);
    return {
      countryCode: 'GB',
      ...(number ? { companyNumber: number } : {}),
      name: (item.company_name ?? '').trim(),
      status: mapStatus(item.company_status),
      ...(incorporationDate ? { incorporationDate } : {}),
      sicCodes: item.sic_codes ?? [],
      address: {
        ...(address.address_line_1 ? { line1: address.address_line_1 } : {}),
        ...(address.address_line_2 ? { line2: address.address_line_2 } : {}),
        ...(address.locality ? { city: address.locality } : {}),
        ...(address.region ? { region: address.region } : {}),
        ...(address.postal_code ? { postcode: address.postal_code } : {}),
        ...(address.country ? { country: address.country } : {}),
      },
      provider: PROVIDER,
      externalId: number,
      sourceUrl: number
        ? `https://find-and-update.company-information.service.gov.uk/company/${number}`
        : undefined,
      raw: item,
    };
  }
}

function parseJson<T>(text: string, endpoint: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new AppError('INVALID_RESPONSE', `companies_house: ${endpoint} returned non-JSON`, {
      retryable: false,
      context: { snippet: text.slice(0, 200) },
      cause: err,
    });
  }
}
