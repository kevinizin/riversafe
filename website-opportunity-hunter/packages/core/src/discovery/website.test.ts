import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../domain/errors.js';
import { HttpClient } from '../net/httpClient.js';
import { resetCircuitBreakers } from '../net/circuitBreaker.js';
import { RobotsChecker } from '../net/robots.js';
import { DisabledPlaceProvider } from '../providers/places/disabled.js';
import { DisabledSearchProvider } from '../providers/search/disabled.js';
import type { PlaceProvider, PlaceRecord } from '../providers/places/types.js';
import type { WebSearchProvider, WebSearchResult } from '../providers/search/types.js';
import { candidateDomains, discoverWebsite, type DiscoveryDeps } from './website.js';
import { isExcludedHost } from './excluded.js';

beforeEach(() => resetCircuitBreakers());

const COMPANY = {
  name: 'DEMO DENTAL STUDIO LTD',
  countryCode: 'GB',
  address: { line1: '1 Example Street', city: 'Manchester', postcode: 'M1 1AA' },
};

const page = (body: string) =>
  new Response(body, { status: 200, headers: { 'content-type': 'text/html' } });

/** Serves robots.txt permissively and canned HTML per host. */
function fakeWeb(pages: Record<string, string>) {
  return vi.fn(async (url: string | URL) => {
    const href = typeof url === 'string' ? url : url.toString();
    if (href.endsWith('/robots.txt')) {
      return new Response('User-agent: *\nDisallow:\n', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      });
    }
    const host = new URL(href).hostname.replace(/^www\./, '');
    const body = pages[host];
    if (!body) return new Response('nope', { status: 404, headers: { 'content-type': 'text/html' } });
    return page(body);
  });
}

function deps(
  pages: Record<string, string>,
  webSearch: WebSearchProvider = new DisabledSearchProvider(),
  places: PlaceProvider = new DisabledPlaceProvider(),
): DiscoveryDeps {
  const fetchImpl = fakeWeb(pages) as unknown as typeof fetch;
  const http = new HttpClient({ name: 'website', fetchImpl, maxRetries: 0, circuitBreaker: false });
  return { http, robots: new RobotsChecker(http, 'test-bot', true), webSearch, places };
}

const INPUT = {
  company: COMPANY,
  domainSuffixes: ['.co.uk', '.com'],
  legalSuffixes: ['limited', 'ltd', 'company'],
};

const matchingSite = `<html><head><title>Demo Dental Studio</title></head><body>
<p>Demo Dental Studio, 1 Example Street, Manchester M1 1AA. Call 0161 496 0000.</p></body></html>`;

const nameOnlySite = `<html><head><title>Demo Dental Studio</title></head><body>
<p>Welcome to Demo Dental Studio.</p></body></html>`;

const unrelatedSite = `<html><head><title>Unrelated Shop</title></head><body>
<p>We sell garden furniture.</p></body></html>`;

class StubSearch implements WebSearchProvider {
  readonly name = 'stub';
  constructor(private readonly results: WebSearchResult[]) {}
  isConfigured() {
    return true;
  }
  async search() {
    return this.results;
  }
}

class StubPlaces implements PlaceProvider {
  readonly name = 'stub';
  constructor(private readonly record: PlaceRecord | null) {}
  isConfigured() {
    return true;
  }
  async findPlace() {
    return this.record;
  }
}

describe('discoverWebsite', () => {
  it('accepts a website published by the source record', async () => {
    const result = await discoverWebsite(
      { ...INPUT, company: { ...COMPANY, website: 'https://demodentalstudio.co.uk' } },
      deps({}),
    );
    expect(result.status).toBe('WEBSITE_FOUND');
    expect(result.confidence).toBe('HIGH');
    expect(result.website?.method).toBe('SOURCE_RECORD');
  });

  it('never says "no website" when every method was unavailable', async () => {
    const result = await discoverWebsite(
      { ...INPUT, maxDomainProbes: 0 },
      deps({}),
    );
    expect(result.status).toBe('WEBSITE_UNCERTAIN');
    expect(result.status).not.toBe('NO_WEBSITE_FOUND');
    expect(result.confidence).toBe('LOW');
    expect(result.note).toContain('could run');
  });

  it('returns NO_WEBSITE_FOUND at MEDIUM confidence once methods have genuinely run', async () => {
    const search = new StubSearch([]);
    const result = await discoverWebsite({ ...INPUT }, deps({}, search));
    expect(result.status).toBe('NO_WEBSITE_FOUND');
    // Absence of evidence is never HIGH confidence.
    expect(result.confidence).toBe('MEDIUM');
    expect(result.note).toMatch(/discovery method/);
  });

  it('verifies a search hit against the postcode before accepting it', async () => {
    const search = new StubSearch([
      { title: 'Demo Dental Studio', url: 'https://demo-dental.example.com/', snippet: '' },
    ]);
    const result = await discoverWebsite(
      INPUT,
      deps({ 'demo-dental.example.com': matchingSite }, search),
    );
    expect(result.status).toBe('WEBSITE_FOUND');
    expect(result.website?.matches).toEqual(
      expect.arrayContaining(['the company name', 'the registered postcode M1 1AA']),
    );
  });

  it('downgrades to UNCERTAIN when only the name matches', async () => {
    const search = new StubSearch([
      { title: 'Demo Dental Studio', url: 'https://name-only.example.com/', snippet: '' },
    ]);
    const result = await discoverWebsite(INPUT, deps({ 'name-only.example.com': nameOnlySite }, search));
    expect(result.status).toBe('WEBSITE_UNCERTAIN');
    expect(result.confidence).toBe('MEDIUM');
    expect(result.note).toContain('human check');
  });

  it('rejects a search hit that does not mention the company at all', async () => {
    const search = new StubSearch([
      { title: 'Unrelated Shop', url: 'https://unrelated.example.com/', snippet: '' },
    ]);
    const result = await discoverWebsite(
      { ...INPUT, maxDomainProbes: 0 },
      deps({ 'unrelated.example.com': unrelatedSite }, search),
    );
    expect(result.status).toBe('NO_WEBSITE_FOUND');
  });

  it('ignores directory and social results', async () => {
    const search = new StubSearch([
      { title: 'Demo Dental Studio', url: 'https://www.yell.com/biz/demo-dental', snippet: '' },
      { title: 'Demo Dental Studio', url: 'https://www.facebook.com/demodental', snippet: '' },
    ]);
    const result = await discoverWebsite({ ...INPUT, maxDomainProbes: 0 }, deps({}, search));
    expect(result.website).toBeUndefined();
    const searchAttempt = result.attempts.find((a) => a.method === 'WEB_SEARCH_NAME_LOCATION');
    expect(searchAttempt?.note).toContain('no non-directory results');
  });

  it('takes a website from a business listing when one verifies', async () => {
    const places = new StubPlaces({
      providerPlaceId: 'p1',
      displayName: 'Demo Dental Studio',
      websiteUri: 'https://demo-dental.example.com/',
    });
    const result = await discoverWebsite(
      INPUT,
      deps({ 'demo-dental.example.com': matchingSite }, new DisabledSearchProvider(), places),
    );
    expect(result.website?.method).toBe('PLACES_PROVIDER');
  });

  it('probes likely domains as a last resort', async () => {
    const result = await discoverWebsite(
      INPUT,
      deps({ 'demodentalstudio.co.uk': matchingSite }, new StubSearch([])),
    );
    expect(result.status).toBe('WEBSITE_FOUND');
    expect(result.website?.method).toBe('DOMAIN_CANDIDATE');
  });

  it('records an unavailable provider separately from a genuine empty result', async () => {
    class BrokenSearch implements WebSearchProvider {
      readonly name = 'broken';
      isConfigured() {
        return true;
      }
      async search(): Promise<WebSearchResult[]> {
        throw new AppError('PROVIDER_UNAVAILABLE', 'search API is down', { retryable: true });
      }
    }
    const result = await discoverWebsite({ ...INPUT, maxDomainProbes: 0 }, deps({}, new BrokenSearch()));
    const attempt = result.attempts.find((a) => a.method === 'WEB_SEARCH_NAME');
    expect(attempt?.outcome).toBe('UNAVAILABLE');
    expect(result.status).toBe('WEBSITE_UNCERTAIN');
  });
});

describe('candidateDomains', () => {
  it('builds plausible stems across the given TLDs', () => {
    const domains = candidateDomains('DEMO DENTAL STUDIO LTD', ['limited', 'ltd'], ['.co.uk', '.com']);
    expect(domains).toEqual(expect.arrayContaining(['https://demodentalstudio.co.uk/']));
    expect(domains.some((d) => d.includes('demo-dental-studio'))).toBe(true);
  });

  it('refuses to guess from a name that is too short to be distinctive', () => {
    expect(candidateDomains('AB Ltd', ['ltd'], ['.co.uk'])).toEqual([]);
  });
});

describe('isExcludedHost', () => {
  it('excludes directories, socials and the registry, but not a real business domain', () => {
    expect(isExcludedHost('yell.com')).toBe(true);
    expect(isExcludedHost('www.facebook.com'.replace('www.', ''))).toBe(true);
    expect(isExcludedHost('find-and-update.company-information.service.gov.uk')).toBe(true);
    expect(isExcludedHost('demodentalstudio.co.uk')).toBe(false);
  });
});
