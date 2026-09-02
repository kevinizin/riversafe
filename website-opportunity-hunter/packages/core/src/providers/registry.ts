import type { Env } from '@woh/config';
import { HttpClient, type HttpClientOptions } from '../net/httpClient.js';
import { RobotsChecker } from '../net/robots.js';
import { CompaniesHouseProvider } from './companies/companiesHouse.js';
import { FixtureCompanyProvider } from './companies/fixtureProvider.js';
import type { CompanySourceProvider } from './companies/types.js';
import { DisabledPlaceProvider } from './places/disabled.js';
import { GooglePlacesProvider } from './places/googlePlaces.js';
import type { PlaceProvider } from './places/types.js';
import { BraveSearchProvider } from './search/brave.js';
import { DisabledSearchProvider } from './search/disabled.js';
import { GoogleCseProvider } from './search/googleCse.js';
import type { WebSearchProvider } from './search/types.js';

export type ApiCallRecorder = NonNullable<HttpClientOptions['onCall']>;

export interface ProviderSet {
  /** Company sources, best first. Never empty: the fixture provider backstops. */
  companySources: CompanySourceProvider[];
  webSearch: WebSearchProvider;
  places: PlaceProvider;
  /** Shared client for fetching prospect websites, with its own rate limit. */
  websiteHttp: HttpClient;
  robots: RobotsChecker;
  /** True when the only company source is the fictional fixture dataset. */
  usingFixtures: boolean;
}

/**
 * Builds every outbound integration from validated configuration.
 *
 * When Companies House is unconfigured the system falls back to the clearly
 * labelled fixture dataset rather than failing to boot — a first-run user can
 * click through the whole product before obtaining an API key.
 */
export function buildProviders(env: Env, onCall?: ApiCallRecorder): ProviderSet {
  const shared = onCall ? { onCall } : {};

  const companySources: CompanySourceProvider[] = [];
  const companiesHouse = new CompaniesHouseProvider({
    apiKey: env.COMPANIES_HOUSE_API_KEY,
    baseUrl: env.COMPANIES_HOUSE_BASE_URL,
    rateLimit: env.COMPANIES_HOUSE_RATE_LIMIT,
    rateWindowMs: env.COMPANIES_HOUSE_RATE_WINDOW_MS,
    ...shared,
  });
  if (companiesHouse.isConfigured()) companySources.push(companiesHouse);
  const usingFixtures = companySources.length === 0;
  if (usingFixtures) companySources.push(new FixtureCompanyProvider());

  let webSearch: WebSearchProvider;
  if (env.SEARCH_PROVIDER === 'brave') {
    webSearch = new BraveSearchProvider(env.BRAVE_SEARCH_API_KEY, {
      rateLimit: env.SEARCH_RATE_LIMIT,
      rateWindowMs: env.SEARCH_RATE_WINDOW_MS,
      ...shared,
    });
  } else if (env.SEARCH_PROVIDER === 'google_cse') {
    webSearch = new GoogleCseProvider(env.GOOGLE_CSE_API_KEY, env.GOOGLE_CSE_CX, {
      rateLimit: env.SEARCH_RATE_LIMIT,
      rateWindowMs: env.SEARCH_RATE_WINDOW_MS,
      ...shared,
    });
  } else {
    webSearch = new DisabledSearchProvider();
  }

  const places: PlaceProvider =
    env.PLACES_PROVIDER === 'google_places'
      ? new GooglePlacesProvider(env.GOOGLE_PLACES_API_KEY, shared)
      : new DisabledPlaceProvider();

  const websiteHttp = new HttpClient({
    name: 'website',
    // Prospect sites are unrelated hosts; a global cap keeps us polite overall
    // and the per-host crawl delay is honoured separately by the analyzer.
    maxRetries: 1,
    defaultTimeoutMs: env.WEBSITE_FETCH_TIMEOUT_MS,
    defaultMaxBytes: env.WEBSITE_MAX_BYTES,
    userAgent: env.WEBSITE_USER_AGENT,
    circuitBreaker: false,
    ...shared,
  });

  const robots = new RobotsChecker(websiteHttp, env.WEBSITE_USER_AGENT, env.RESPECT_ROBOTS_TXT);

  return { companySources, webSearch, places, websiteHttp, robots, usingFixtures };
}
