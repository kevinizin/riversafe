import { z } from 'zod';
import { INDUSTRIES } from '../industry/taxonomy.js';

/**
 * The search a user builds in the dashboard.
 *
 * This schema is the single definition of a valid search: the API validates
 * against it, the worker reads it back, and the search history stores it
 * verbatim so an old search can be re-run exactly as it was.
 */

export const COMPANY_AGE_PRESETS = {
  TODAY: 1,
  LAST_3_DAYS: 3,
  LAST_7_DAYS: 7,
  LAST_14_DAYS: 14,
  LAST_30_DAYS: 30,
  LAST_60_DAYS: 60,
  LAST_90_DAYS: 90,
  ANY: null,
} as const;

export type CompanyAgePreset = keyof typeof COMPANY_AGE_PRESETS;

export const COMPANY_AGE_LABELS: Record<CompanyAgePreset, string> = {
  TODAY: 'Incorporated today',
  LAST_3_DAYS: 'Last 3 days',
  LAST_7_DAYS: 'Last 7 days',
  LAST_14_DAYS: 'Last 14 days',
  LAST_30_DAYS: 'Last 30 days',
  LAST_60_DAYS: 'Last 60 days',
  LAST_90_DAYS: 'Last 90 days',
  ANY: 'Any age',
};

export const WEBSITE_FILTERS = ['ANY', 'NO_WEBSITE', 'WEAK_WEBSITE', 'NO_OR_WEAK', 'HAS_WEBSITE'] as const;
export type WebsiteFilter = (typeof WEBSITE_FILTERS)[number];

export const WEBSITE_FILTER_LABELS: Record<WebsiteFilter, string> = {
  ANY: 'Any',
  NO_WEBSITE: 'No website found',
  WEAK_WEBSITE: 'Weak website',
  NO_OR_WEAK: 'No website or weak website',
  HAS_WEBSITE: 'Has a website',
};

const industryKeys = INDUSTRIES.map((i) => i.key) as [string, ...string[]];

export const searchFiltersSchema = z.object({
  countryCode: z.string().length(2).default('GB'),
  /** Empty means every industry in the catalogue. */
  industryKeys: z.array(z.enum(industryKeys)).default([]),
  region: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  postcodePrefix: z.string().trim().max(8).optional(),
  companyAge: z.enum(Object.keys(COMPANY_AGE_PRESETS) as [CompanyAgePreset, ...CompanyAgePreset[]]).default('LAST_30_DAYS'),
  websiteFilter: z.enum(WEBSITE_FILTERS).default('ANY'),
  /** Only companies scoring at least this much are surfaced as results. */
  minScore: z.number().int().min(0).max(100).default(0),
  minReviews: z.number().int().min(0).optional(),
  minRating: z.number().min(0).max(5).optional(),
  requireSocialPresence: z.boolean().default(false),
  /** Registry statuses to include. Defaults to active companies only. */
  statuses: z.array(z.string()).default(['active']),
  nameIncludes: z.string().trim().max(120).optional(),
  /** Hard ceiling on how many companies one run will process. */
  maxCompanies: z.number().int().min(1).max(2000).default(200),
  /** Skip the website analysis stage; much cheaper, much less useful. */
  skipWebsiteAnalysis: z.boolean().default(false),
});

export type SearchFilters = z.infer<typeof searchFiltersSchema>;

export function parseFilters(input: unknown): SearchFilters {
  return searchFiltersSchema.parse(input);
}

/** The incorporation window implied by the age preset, relative to `now`. */
export function incorporationWindow(
  filters: Pick<SearchFilters, 'companyAge'>,
  now = new Date(),
): { from?: Date; to?: Date } {
  const days = COMPANY_AGE_PRESETS[filters.companyAge];
  if (days === null) return {};
  const to = new Date(now);
  to.setUTCHours(0, 0, 0, 0);
  const from = new Date(to);
  // "Last 7 days" includes today, so the window spans days-1 whole days back.
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return { from, to };
}

/** Human summary used in the search history list. */
export function describeFilters(filters: SearchFilters): string {
  const parts: string[] = [];
  parts.push(filters.countryCode);
  parts.push(filters.industryKeys.length ? filters.industryKeys.join(', ') : 'all industries');
  if (filters.city) parts.push(filters.city);
  else if (filters.region) parts.push(filters.region);
  parts.push(COMPANY_AGE_LABELS[filters.companyAge]);
  if (filters.websiteFilter !== 'ANY') parts.push(WEBSITE_FILTER_LABELS[filters.websiteFilter]);
  if (filters.minScore > 0) parts.push(`score ${filters.minScore}+`);
  return parts.join(' · ');
}
