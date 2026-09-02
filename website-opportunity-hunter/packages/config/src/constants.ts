/** Values that are part of the product definition rather than deployment config. */

export const APP_NAME = 'Website Opportunity Hunter';

/** Everything the MVP ships is UK-only. Adding a country means adding a
 *  CountryProfile in @woh/core/countries — never hardcoding it here. */
export const DEFAULT_COUNTRY = 'GB';

export const SCORE_VERSION = 1;

/** Classification thresholds. Overridable per-installation via Settings. */
export const DEFAULT_CLASSIFICATION_THRESHOLDS = {
  HOT: 90,
  HIGH_OPPORTUNITY: 75,
  WARM: 60,
  LOW_PRIORITY: 40,
} as const;

/** Maximum companies a single search run will pull from a source provider.
 *  Guards both cost and the provider's rate limit. */
export const MAX_COMPANIES_PER_RUN = 500;

/** Page size used when paginating source providers. */
export const SOURCE_PAGE_SIZE = 100;
