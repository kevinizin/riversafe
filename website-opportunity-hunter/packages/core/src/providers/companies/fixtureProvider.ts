import { type Lookup, type SourceCompany, found, notFound, sourced } from '../../domain/types.js';
import { FIXTURE_COMPANIES, type FixtureCompany } from './fixtures.js';
import type {
  CompanySearchFilters,
  CompanySearchOptions,
  CompanySearchPage,
  CompanySourceProvider,
  OfficerRecord,
} from './types.js';

const PROVIDER = 'fixture';

/**
 * An in-memory source provider used when no Companies House key is configured,
 * and by the test suite.
 *
 * It is always clearly labelled in the UI: fixture rows must never be mistaken
 * for real companies. It applies the same filters as a real provider so the
 * pipeline exercises identical code paths.
 */
export class FixtureCompanyProvider implements CompanySourceProvider {
  readonly name = PROVIDER;
  readonly countries = ['GB'];

  constructor(private readonly data: FixtureCompany[] = FIXTURE_COMPANIES) {}

  isConfigured(): boolean {
    return true;
  }

  async searchCompanies(
    filters: CompanySearchFilters,
    options: CompanySearchOptions = {},
  ): Promise<CompanySearchPage> {
    const pageSize = options.pageSize ?? 100;
    const startIndex = options.startIndex ?? 0;

    const matched = this.data.filter((c) => {
      if (c.countryCode !== filters.countryCode.toUpperCase()) return false;
      if (filters.registryCodes?.length && !c.sicCodes.some((s) => filters.registryCodes!.includes(s))) {
        return false;
      }
      if (filters.location) {
        const needle = filters.location.toLowerCase();
        const haystack = [c.address.city, c.address.region, c.address.postcode]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (filters.incorporatedFrom && (!c.incorporationDate || c.incorporationDate < filters.incorporatedFrom)) {
        return false;
      }
      if (filters.incorporatedTo && (!c.incorporationDate || c.incorporationDate > filters.incorporatedTo)) {
        return false;
      }
      if (filters.nameIncludes && !c.name.toLowerCase().includes(filters.nameIncludes.toLowerCase())) {
        return false;
      }
      return true;
    });

    const slice = matched.slice(startIndex, startIndex + pageSize);
    const consumed = startIndex + slice.length;
    return {
      companies: slice.map(toSourceCompany),
      total: matched.length,
      ...(consumed < matched.length ? { nextStartIndex: consumed } : {}),
    };
  }

  async getOfficers(
    companyId: string,
    options: { includeNames?: boolean } = {},
  ): Promise<Lookup<OfficerRecord[]>> {
    const match = this.data.find((c) => c.externalId === companyId);
    const officers = match?.fixture.officers ?? [];
    if (officers.length === 0) {
      return notFound(['fixture:officers'], `no fixture officers for ${companyId}`);
    }
    const records = officers.map((o): OfficerRecord => ({
      ...(options.includeNames ? { name: o.name } : {}),
      role: o.role,
      appointedOn: new Date(Date.now() - o.appointedDaysAgo * 86_400_000),
      ...(o.occupation ? { occupation: o.occupation } : {}),
      isCorporate: o.corporate ?? false,
      isActive: true,
    }));
    return found(
      sourced(records, 'HIGH', {
        source: PROVIDER,
        detectedAt: new Date(),
        excerpt: 'fixture dataset (fictional officers)',
      }),
    );
  }

  async getCompanyDetails(companyId: string): Promise<Lookup<SourceCompany>> {
    const match = this.data.find((c) => c.externalId === companyId);
    if (!match) return notFound(['fixture'], `no fixture company with id ${companyId}`);
    return found(
      sourced(toSourceCompany(match), 'HIGH', {
        source: PROVIDER,
        detectedAt: new Date(),
        excerpt: 'fixture dataset (fictional company)',
      }),
    );
  }
}

function toSourceCompany(c: FixtureCompany): SourceCompany {
  const { fixture: _fixture, ...rest } = c;
  return { ...rest, provider: PROVIDER, externalId: c.externalId, raw: { fixture: true, ...rest } };
}
