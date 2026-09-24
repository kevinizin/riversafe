import { z } from 'zod';
import { INDUSTRIES } from '../industry/taxonomy.js';

/**
 * The search a user builds in the dashboard.
 *
 * This schema is the single definition of a valid search: the API validates
 * against it, the worker reads it back, and the search history stores it
 * verbatim so an old search can be re-run exactly as it was.
 */

/**
 * Age windows, in both directions.
 *
 * `maxDays` is "incorporated within the last N days" — the website axis, which
 * wants companies that have not got round to a site yet. `minDays` is
 * "incorporated at least N days ago" — the system axis, which wants the
 * opposite: a business with enough history to have a process worth organising.
 *
 * They are one enum rather than two filters because a search is asking one
 * question about age, and offering both directions at once invites a search for
 * companies both younger than a month and older than a year.
 */
export const COMPANY_AGE_PRESETS = {
  TODAY: { maxDays: 1 },
  LAST_3_DAYS: { maxDays: 3 },
  LAST_7_DAYS: { maxDays: 7 },
  LAST_14_DAYS: { maxDays: 14 },
  LAST_30_DAYS: { maxDays: 30 },
  LAST_60_DAYS: { maxDays: 60 },
  LAST_90_DAYS: { maxDays: 90 },
  OVER_1_YEAR: { minDays: 365 },
  OVER_2_YEARS: { minDays: 730 },
  OVER_5_YEARS: { minDays: 1825 },
  ANY: {},
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
  OVER_1_YEAR: 'Trading over 1 year',
  OVER_2_YEARS: 'Trading over 2 years',
  OVER_5_YEARS: 'Trading over 5 years',
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
  const preset: { maxDays?: number; minDays?: number } = COMPANY_AGE_PRESETS[filters.companyAge];
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);

  if (preset.minDays !== undefined) {
    // "Older than a year" is an open-ended window ending a year ago. There is no
    // `from`: a company incorporated in 1990 qualifies as much as one from 2023.
    const to = new Date(today);
    to.setUTCDate(to.getUTCDate() - preset.minDays);
    return { to };
  }

  if (preset.maxDays !== undefined) {
    const from = new Date(today);
    // "Last 7 days" includes today, so the window spans days-1 whole days back.
    from.setUTCDate(from.getUTCDate() - (preset.maxDays - 1));
    return { from, to: today };
  }

  return {};
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

/**
 * Named starting points for the two things this tool is actually used to find.
 *
 * They exist because the two axes want opposite searches, and building either
 * by hand means setting five controls correctly — including an age filter that
 * points the other way. Getting one of them wrong produces an empty result and
 * looks like the tool is broken.
 *
 * A preset is a starting point, not a lock: it fills the form and the operator
 * edits it from there.
 */
export interface SearchPreset {
  key: string;
  label: string;
  /** Which score the results should be read against once the run finishes. */
  axis: 'WEBSITE' | 'SYSTEM';
  description: string;
  filters: Partial<SearchFilters>;
}

export const SEARCH_PRESETS: SearchPreset[] = [
  {
    key: 'new_no_website',
    label: 'New companies with no website',
    axis: 'WEBSITE',
    description:
      'Opened in the last three months and no site found. They have not chosen a supplier yet, which is the whole opportunity.',
    filters: {
      companyAge: 'LAST_90_DAYS',
      websiteFilter: 'NO_OR_WEAK',
      minScore: 0,
    },
  },
  {
    key: 'established_needs_system',
    label: 'Established companies that need a system',
    axis: 'SYSTEM',
    description:
      'Trading over a year, in sectors built on jobs, deadlines and records. Sorted by the system score, not the website one.',
    filters: {
      companyAge: 'OVER_1_YEAR',
      websiteFilter: 'ANY',
      industryKeys: [
        'architecture',
        'engineering',
        'training_courses',
        'construction',
        'legal',
        'accounting',
        'real_estate',
        'auto_repair',
        'cleaning',
        'heating_hvac',
      ],
      minScore: 0,
    },
  },
];

export function getSearchPreset(key: string | null | undefined): SearchPreset | undefined {
  return SEARCH_PRESETS.find((p) => p.key === key);
}
