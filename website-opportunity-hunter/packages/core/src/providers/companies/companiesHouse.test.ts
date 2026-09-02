import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetCircuitBreakers } from '../../net/circuitBreaker.js';
import { resetRateLimiters } from '../../net/rateLimiter.js';
import { CompaniesHouseProvider, formatChDate, parseChDate } from './companiesHouse.js';
import { FixtureCompanyProvider } from './fixtureProvider.js';

beforeEach(() => {
  resetCircuitBreakers();
  resetRateLimiters();
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const SEARCH_BODY = {
  hits: '2',
  items: [
    {
      company_name: 'DEMO DENTAL STUDIO LTD',
      company_number: '11111111',
      company_status: 'active',
      company_type: 'ltd',
      date_of_creation: '2026-08-28',
      registered_office_address: {
        address_line_1: '1 Example Street',
        locality: 'Manchester',
        postal_code: 'M1 1AA',
        country: 'England',
      },
      sic_codes: ['86230'],
    },
    {
      company_name: 'DEMO ROOFING CO LTD',
      company_number: '22222222',
      company_status: 'liquidation',
      date_of_creation: '2026-08-30',
      sic_codes: ['43910'],
    },
  ],
};

const provider = (fetchImpl: typeof fetch) =>
  new CompaniesHouseProvider({ apiKey: 'test-key', fetchImpl, rateLimit: 1000, rateWindowMs: 1000 });

describe('parseChDate', () => {
  it('parses the documented YYYY-MM-DD form as UTC', () => {
    expect(parseChDate('2026-08-28')?.toISOString()).toBe('2026-08-28T00:00:00.000Z');
  });
  it('returns undefined for anything else', () => {
    expect(parseChDate('28/08/2026')).toBeUndefined();
    expect(parseChDate(undefined)).toBeUndefined();
  });
  it('round-trips through formatChDate', () => {
    expect(formatChDate(parseChDate('2026-08-28')!)).toBe('2026-08-28');
  });
});

describe('CompaniesHouseProvider', () => {
  it('reports itself unconfigured without an API key', async () => {
    const p = new CompaniesHouseProvider({ apiKey: '' });
    expect(p.isConfigured()).toBe(false);
    await expect(p.searchCompanies({ countryCode: 'GB' })).rejects.toMatchObject({
      code: 'PROVIDER_NOT_CONFIGURED',
    });
  });

  it('builds the documented advanced-search query', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(SEARCH_BODY));
    await provider(fetchImpl as unknown as typeof fetch).searchCompanies(
      {
        countryCode: 'GB',
        registryCodes: ['86230', '43910'],
        location: 'Manchester',
        incorporatedFrom: new Date('2026-08-01T00:00:00Z'),
        incorporatedTo: new Date('2026-09-01T00:00:00Z'),
      },
      { pageSize: 50 },
    );

    const url = new URL((fetchImpl.mock.calls[0]![0] as string));
    expect(url.origin + url.pathname).toBe('https://api.company-information.service.gov.uk/advanced-search/companies');
    expect(url.searchParams.getAll('sic_codes')).toEqual(['86230', '43910']);
    expect(url.searchParams.get('incorporated_from')).toBe('2026-08-01');
    expect(url.searchParams.get('incorporated_to')).toBe('2026-09-01');
    expect(url.searchParams.get('location')).toBe('Manchester');
    expect(url.searchParams.get('size')).toBe('50');
    expect(url.searchParams.getAll('company_status')).toEqual(['active']);

    const headers = (fetchImpl.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBe(`Basic ${Buffer.from('test-key:').toString('base64')}`);
  });

  it('maps the documented response fields and statuses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(SEARCH_BODY));
    const page = await provider(fetchImpl as unknown as typeof fetch).searchCompanies({ countryCode: 'GB' });

    expect(page.total).toBe(2);
    const [first, second] = page.companies;
    expect(first!.name).toBe('DEMO DENTAL STUDIO LTD');
    expect(first!.status).toBe('ACTIVE');
    expect(first!.address.city).toBe('Manchester');
    expect(first!.address.postcode).toBe('M1 1AA');
    expect(first!.sicCodes).toEqual(['86230']);
    expect(first!.sourceUrl).toContain('11111111');
    expect(second!.status).toBe('LIQUIDATION');
  });

  it('signals more pages only while results remain', async () => {
    const items = Array.from({ length: 2 }, (_, i) => ({
      company_name: `DEMO ${i} LTD`,
      company_number: `0000000${i}`,
      company_status: 'active',
    }));
    const fetchImpl = vi.fn().mockResolvedValue(json({ hits: '10', items }));
    const page = await provider(fetchImpl as unknown as typeof fetch).searchCompanies(
      { countryCode: 'GB' },
      { pageSize: 2 },
    );
    expect(page.nextStartIndex).toBe(2);

    const last = vi.fn().mockResolvedValue(json({ hits: '2', items }));
    const finalPage = await provider(last as unknown as typeof fetch).searchCompanies(
      { countryCode: 'GB' },
      { pageSize: 2, startIndex: 0 },
    );
    expect(finalPage.nextStartIndex).toBeUndefined();
  });

  it('treats a 404 search as an empty result rather than an error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({}, 404));
    const page = await provider(fetchImpl as unknown as typeof fetch).searchCompanies({ countryCode: 'GB' });
    expect(page.companies).toEqual([]);
    expect(page.total).toBe(0);
  });

  it('returns NOT_FOUND for an unknown company number', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({}, 404));
    const result = await provider(fetchImpl as unknown as typeof fetch).getCompanyDetails('99999999');
    expect(result.kind).toBe('NOT_FOUND');
  });

  it('rejects a malformed company number without calling the API', async () => {
    const fetchImpl = vi.fn();
    const result = await provider(fetchImpl as unknown as typeof fetch).getCompanyDetails('not a number');
    expect(result.kind).toBe('NOT_FOUND');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('surfaces a non-JSON response as INVALID_RESPONSE', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('<html>maintenance</html>', { status: 200, headers: { 'content-type': 'application/json' } }));
    await expect(
      provider(fetchImpl as unknown as typeof fetch).searchCompanies({ countryCode: 'GB' }),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('refuses a country it does not serve', async () => {
    const fetchImpl = vi.fn();
    await expect(
      provider(fetchImpl as unknown as typeof fetch).searchCompanies({ countryCode: 'DE' }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('gives up after retrying a persistent 500', async () => {
    // A fresh Response per call: a body can only be consumed once.
    const fetchImpl = vi.fn().mockImplementation(async () => json({ error: 'boom' }, 500));
    await expect(
      new CompaniesHouseProvider({
        apiKey: 'k',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }).searchCompanies({ countryCode: 'GB' }),
    ).rejects.toMatchObject({ code: 'HTTP_ERROR', status: 500 });
    expect(fetchImpl.mock.calls.length).toBeGreaterThan(1);
  }, 30_000);
});

describe('FixtureCompanyProvider', () => {
  it('applies the same filters as a real provider', async () => {
    const p = new FixtureCompanyProvider();
    const dental = await p.searchCompanies({ countryCode: 'GB', registryCodes: ['86230'] });
    expect(dental.companies.length).toBeGreaterThan(0);
    expect(dental.companies.every((c) => c.sicCodes.includes('86230'))).toBe(true);

    const manchester = await p.searchCompanies({ countryCode: 'GB', location: 'Manchester' });
    expect(manchester.companies.every((c) => c.address.city === 'Manchester')).toBe(true);
  });

  it('excludes companies with no incorporation date from a date-filtered search', async () => {
    const p = new FixtureCompanyProvider();
    const page = await p.searchCompanies({
      countryCode: 'GB',
      incorporatedFrom: new Date(Date.now() - 30 * 86_400_000),
    });
    expect(page.companies.every((c) => c.incorporationDate !== undefined)).toBe(true);
  });
});
