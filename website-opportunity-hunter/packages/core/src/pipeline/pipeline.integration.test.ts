import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { envSchema, type Env } from '@woh/config';
import { AppError } from '../domain/errors.js';
import { HttpClient } from '../net/httpClient.js';
import { resetCircuitBreakers } from '../net/circuitBreaker.js';
import { resetRateLimiters } from '../net/rateLimiter.js';
import { RobotsChecker } from '../net/robots.js';
import { FixtureCompanyProvider } from '../providers/companies/fixtureProvider.js';
import { DisabledPlaceProvider } from '../providers/places/disabled.js';
import type { WebSearchProvider, WebSearchResult } from '../providers/search/types.js';
import type { ProviderSet } from '../providers/registry.js';
import { createPipelineContext, type PipelineContext } from './context.js';
import { runSearch } from './runSearch.js';

/**
 * End-to-end pipeline test against a real Postgres database.
 *
 * Set TEST_DATABASE_URL to a database with the migrations applied:
 *   createdb woh_test
 *   DATABASE_URL=postgresql://…/woh_test npm run -w @woh/db deploy
 *
 * Without it the suite skips rather than silently passing.
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const maybe = TEST_DATABASE_URL ? describe : describe.skip;

class EmptySearch implements WebSearchProvider {
  readonly name = 'empty';
  isConfigured() {
    return true;
  }
  async search(): Promise<WebSearchResult[]> {
    return [];
  }
}

class BrokenSearch implements WebSearchProvider {
  readonly name = 'broken';
  isConfigured() {
    return true;
  }
  async search(): Promise<WebSearchResult[]> {
    throw new AppError('PROVIDER_UNAVAILABLE', 'search API is down', { retryable: true });
  }
}

/** Every website request fails, as if none of the guessed domains resolved. */
const deadWeb = (async (url: string | URL) => {
  const href = typeof url === 'string' ? url : url.toString();
  if (href.endsWith('/robots.txt')) {
    return new Response('User-agent: *\nDisallow:\n', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    });
  }
  throw new TypeError('fetch failed: ENOTFOUND');
}) as unknown as typeof fetch;

function buildTestProviders(search: WebSearchProvider, db?: PrismaClient): ProviderSet {
  const websiteHttp = new HttpClient({
    name: 'website',
    fetchImpl: deadWeb,
    maxRetries: 0,
    circuitBreaker: false,
    defaultTimeoutMs: 2000,
    ...(db
      ? {
          onCall: (info) => {
            void db.apiUsage
              .create({
                data: {
                  provider: info.provider,
                  endpoint: info.endpoint,
                  ok: info.ok,
                  durationMs: info.durationMs,
                },
              })
              .catch(() => {});
          },
        }
      : {}),
  });
  return {
    companySources: [new FixtureCompanyProvider()],
    webSearch: search,
    places: new DisabledPlaceProvider(),
    websiteHttp,
    robots: new RobotsChecker(websiteHttp, 'test-bot', true),
    usingFixtures: true,
  };
}

maybe('search pipeline (integration)', () => {
  let db: PrismaClient;
  let env: Env;

  beforeAll(() => {
    db = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL! } } });
    env = envSchema.parse({
      DATABASE_URL: TEST_DATABASE_URL,
      AUTH_SECRET: 'a-test-secret-that-is-long-enough-to-pass',
      QUEUE_DRIVER: 'inline',
      NODE_ENV: 'test',
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    resetCircuitBreakers();
    resetRateLimiters();
    // A clean slate per test: the pipeline is about identity and deduplication,
    // so leftover rows would make results depend on test order.
    await db.$executeRawUnsafe(
      'TRUNCATE companies, searches, search_runs, users, system_logs, api_usage, job_records RESTART IDENTITY CASCADE',
    );
  });

  async function createRun(ctx: PipelineContext, filters: Record<string, unknown> = {}) {
    const user = await db.user.create({
      data: { email: `t-${Date.now()}@example.com`, name: 'Test', passwordHash: 'x' },
    });
    const search = await db.search.create({
      data: {
        userId: user.id,
        name: 'integration search',
        filters: {
          countryCode: 'GB',
          industryKeys: [],
          companyAge: 'ANY',
          websiteFilter: 'ANY',
          minScore: 0,
          statuses: ['active'],
          requireSocialPresence: false,
          maxCompanies: 50,
          skipWebsiteAnalysis: false,
          ...filters,
        },
      },
    });
    void ctx;
    return db.searchRun.create({ data: { searchId: search.id, status: 'QUEUED' } });
  }

  it('finds, deduplicates, enriches and scores every company', async () => {
    const ctx = createPipelineContext(env, {
      db,
      persistLogs: false,
      providers: buildTestProviders(new EmptySearch()),
    });
    const run = await createRun(ctx);

    const summary = await runSearch(ctx, run.id);

    expect(summary.companiesFound).toBeGreaterThan(0);
    // The fixture set contains one company twice under different legal names.
    expect(summary.companiesDuplicate).toBeGreaterThanOrEqual(1);

    const companies = await db.company.findMany({ include: { scores: true } });
    expect(companies.length).toBe(summary.companiesNew);
    for (const company of companies) {
      expect(company.currentScore).not.toBeNull();
      expect(company.currentClassification).not.toBeNull();
      expect(company.scores.length).toBeGreaterThan(0);
      expect(company.scoringStatus).toBe('DONE');
    }

    const results = await db.searchRunResult.count({ where: { searchRunId: run.id } });
    expect(results).toBe(companies.length);
  }, 90_000);

  it('reports "not found" only after methods actually ran', async () => {
    const ctx = createPipelineContext(env, {
      db,
      persistLogs: false,
      providers: buildTestProviders(new EmptySearch()),
    });
    const run = await createRun(ctx);
    await runSearch(ctx, run.id);

    const companies = await db.company.findMany();
    for (const company of companies) {
      expect(company.websiteStatus).not.toBe('NOT_CHECKED');
      if (company.websiteStatus === 'NO_WEBSITE_FOUND') {
        // Never asserted with HIGH confidence: absence of evidence is not proof.
        expect(company.websiteConfidence).toBe('MEDIUM');
        expect(company.websiteStatusNote).toMatch(/discovery method/);
      }
    }
  }, 90_000);

  it('keeps the lead when a provider is unavailable, and says the check was inconclusive', async () => {
    const ctx = createPipelineContext(env, {
      db,
      persistLogs: false,
      providers: buildTestProviders(new BrokenSearch()),
    });
    const run = await createRun(ctx);
    await runSearch(ctx, run.id);

    const companies = await db.company.findMany();
    expect(companies.length).toBeGreaterThan(0);
    for (const company of companies) {
      // The lead survives and is still scored.
      expect(company.currentScore).not.toBeNull();
    }
    const uncertain = companies.filter((c) => c.websiteStatus === 'WEBSITE_UNCERTAIN');
    expect(uncertain.length).toBeGreaterThan(0);
    expect(uncertain[0]!.websiteStatusNote).toMatch(/could run|unavailable/i);
  }, 90_000);

  it('does not create a second company when the same search runs twice', async () => {
    const ctx = createPipelineContext(env, {
      db,
      persistLogs: false,
      providers: buildTestProviders(new EmptySearch()),
    });
    const first = await createRun(ctx);
    await runSearch(ctx, first.id);
    const countAfterFirst = await db.company.count();

    const search = await db.search.findFirstOrThrow();
    const second = await db.searchRun.create({ data: { searchId: search.id, status: 'QUEUED' } });
    const summary = await runSearch(ctx, second.id);

    expect(await db.company.count()).toBe(countAfterFirst);
    expect(summary.companiesNew).toBe(0);
    expect(summary.companiesDuplicate).toBe(summary.companiesFound);
  }, 120_000);

  it('applies the industry filter through to the source provider', async () => {
    const ctx = createPipelineContext(env, {
      db,
      persistLogs: false,
      providers: buildTestProviders(new EmptySearch()),
    });
    const run = await createRun(ctx, { industryKeys: ['dental'] });
    await runSearch(ctx, run.id);

    const companies = await db.company.findMany();
    expect(companies.length).toBeGreaterThan(0);
    for (const company of companies) expect(company.sicCodes).toContain('86230');
  }, 90_000);

  it('records external calls and stage outcomes for the system health page', async () => {
    const ctx = createPipelineContext(env, {
      db,
      persistLogs: false,
      providers: buildTestProviders(new EmptySearch(), db),
    });
    const run = await createRun(ctx);
    await runSearch(ctx, run.id);

    // The recorder writes asynchronously; give it a moment to land.
    await new Promise((resolve) => setTimeout(resolve, 250));
    const usage = await db.apiUsage.count();
    expect(usage).toBeGreaterThan(0);

    const finished = await db.searchRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(['COMPLETED', 'PARTIAL']).toContain(finished.status);
    expect(finished.finishedAt).not.toBeNull();
    expect(finished.companiesFound).toBeGreaterThan(0);
  }, 90_000);
});
