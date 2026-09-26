import { z } from 'zod';

/**
 * Every environment variable the system reads, validated once at startup.
 *
 * Rules:
 *  - No variable is prefixed NEXT_PUBLIC_: no secret ever reaches the browser.
 *  - Optional integrations default to a disabled ("none") provider so the app
 *    boots and degrades gracefully instead of crashing.
 */

const bool = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

const int = (def: number) =>
  z.coerce.number().int().positive().default(def);

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_URL: z.string().url().default('http://localhost:3000'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    AUTH_SECRET: z
      .string()
      .min(32, 'AUTH_SECRET must be at least 32 characters'),

    QUEUE_DRIVER: z.enum(['inline', 'redis']).default('inline'),
    REDIS_URL: z.string().default('redis://localhost:6379'),

    COMPANIES_HOUSE_API_KEY: z.string().default(''),
    COMPANIES_HOUSE_BASE_URL: z
      .string()
      .url()
      .default('https://api.company-information.service.gov.uk'),
    COMPANIES_HOUSE_RATE_LIMIT: int(600),
    COMPANIES_HOUSE_RATE_WINDOW_MS: int(300_000),

    SEARCH_PROVIDER: z.enum(['none', 'brave', 'google_cse']).default('none'),
    BRAVE_SEARCH_API_KEY: z.string().default(''),
    GOOGLE_CSE_API_KEY: z.string().default(''),
    GOOGLE_CSE_CX: z.string().default(''),
    SEARCH_RATE_LIMIT: int(60),
    SEARCH_RATE_WINDOW_MS: int(60_000),

    PLACES_PROVIDER: z.enum(['none', 'google_places']).default('none'),
    GOOGLE_PLACES_API_KEY: z.string().default(''),

    WEBSITE_FETCH_TIMEOUT_MS: int(12_000),
    WEBSITE_MAX_BYTES: int(2_500_000),
    WEBSITE_ANALYSIS_TTL_HOURS: int(168),
    WEBSITE_USER_AGENT: z
      .string()
      .default('WebsiteOpportunityHunter/0.1 (+https://example.com/bot)'),
    RESPECT_ROBOTS_TXT: bool.default(true),

    /**
     * Whether to store officer names from the public register.
     *
     * Off by default. Role and appointment date already tell you whether a
     * company is owner-operated; a name is personal data, so collecting it is
     * an explicit choice the controller makes, not a default.
     */
    COLLECT_OFFICER_NAMES: bool.default(false),

    AI_PROVIDER: z.enum(['none', 'anthropic']).default('none'),
    ANTHROPIC_API_KEY: z.string().default(''),
    AI_MODEL: z.string().default('claude-sonnet-5'),
    AI_MONTHLY_BUDGET_GBP: z.coerce.number().nonnegative().default(20),

    DATA_RETENTION_DAYS: int(365),
  })
  .superRefine((env, ctx) => {
    const require = (cond: boolean, path: string, message: string) => {
      if (!cond) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    };
    if (env.SEARCH_PROVIDER === 'brave')
      require(!!env.BRAVE_SEARCH_API_KEY, 'BRAVE_SEARCH_API_KEY', 'required when SEARCH_PROVIDER=brave');
    if (env.SEARCH_PROVIDER === 'google_cse') {
      require(!!env.GOOGLE_CSE_API_KEY, 'GOOGLE_CSE_API_KEY', 'required when SEARCH_PROVIDER=google_cse');
      require(!!env.GOOGLE_CSE_CX, 'GOOGLE_CSE_CX', 'required when SEARCH_PROVIDER=google_cse');
    }
    if (env.PLACES_PROVIDER === 'google_places')
      require(!!env.GOOGLE_PLACES_API_KEY, 'GOOGLE_PLACES_API_KEY', 'required when PLACES_PROVIDER=google_places');
    if (env.AI_PROVIDER === 'anthropic')
      require(!!env.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY', 'required when AI_PROVIDER=anthropic');
    if (env.QUEUE_DRIVER === 'redis')
      require(!!env.REDIS_URL, 'REDIS_URL', 'required when QUEUE_DRIVER=redis');
    if (env.NODE_ENV === 'production')
      require(
        !env.AUTH_SECRET.startsWith('change-me'),
        'AUTH_SECRET',
        'the placeholder AUTH_SECRET must not be used in production',
      );
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Parse and cache process.env. Throws a readable error listing every problem. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper: forget the cached env so the next loadEnv() re-reads. */
export function resetEnvCache(): void {
  cached = null;
}

/** Which optional integrations are actually configured. Surfaced in the UI so
 *  the user can tell "not found" from "not configured". */
export function integrationStatus(env: Env) {
  return {
    companiesHouse: env.COMPANIES_HOUSE_API_KEY ? 'configured' : 'missing',
    webSearch: env.SEARCH_PROVIDER === 'none' ? 'disabled' : env.SEARCH_PROVIDER,
    places: env.PLACES_PROVIDER === 'none' ? 'disabled' : env.PLACES_PROVIDER,
    ai: env.AI_PROVIDER === 'none' ? 'disabled' : env.AI_PROVIDER,
    queue: env.QUEUE_DRIVER,
  } as const;
}
