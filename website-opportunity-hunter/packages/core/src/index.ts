/** Public surface of the domain layer. */

export * from './domain/types.js';
export * from './domain/errors.js';
export * from './logging/logger.js';

export * from './countries/types.js';
export * from './countries/registry.js';
export { UNITED_KINGDOM } from './countries/uk.js';

export * from './geo/uk.js';

export * from './industry/types.js';
export * from './industry/taxonomy.js';
export * from './industry/classify.js';

export * from './dedup/normalize.js';
export * from './dedup/key.js';
export * from './dedup/match.js';

export * from './net/httpClient.js';
export * from './net/rateLimiter.js';
export * from './net/circuitBreaker.js';
export * from './net/robots.js';

export * from './providers/companies/types.js';
export { CompaniesHouseProvider } from './providers/companies/companiesHouse.js';
export { FixtureCompanyProvider } from './providers/companies/fixtureProvider.js';
export { FIXTURE_COMPANIES } from './providers/companies/fixtures.js';
export * from './providers/search/types.js';
export * from './providers/places/types.js';
export * from './providers/registry.js';

export * from './analyzer/index.js';
export * from './discovery/website.js';
export { isExcludedHost } from './discovery/excluded.js';
export * from './social/discover.js';
export * from './signals/detect.js';

export * from './scoring/config.js';
export * from './scoring/opportunity.js';

export * from './search/filters.js';

export * from './pipeline/context.js';
export * from './pipeline/persist.js';
export * from './pipeline/stages.js';
export * from './pipeline/runSearch.js';
export * from './pipeline/concurrency.js';

export * from './queue/index.js';

export * from './outreach/message.js';
export * from './outreach/preview.js';
export * from './ai/index.js';

export * from './export/csv.js';
export * from './auth/password.js';
