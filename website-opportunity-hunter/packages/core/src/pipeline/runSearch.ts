import { MAX_COMPANIES_PER_RUN, SOURCE_PAGE_SIZE } from '@woh/config';
import type { Prisma } from '@woh/db';
import { requireCountry } from '../countries/registry.js';
import { describeError } from '../domain/errors.js';
import { registryCodesFor } from '../industry/taxonomy.js';
import type { CompanySourceProvider } from '../providers/companies/types.js';
import { incorporationWindow, parseFilters, type SearchFilters } from '../search/filters.js';
import { mapWithConcurrency } from './concurrency.js';
import type { PipelineContext } from './context.js';
import { enrichCompany } from './stages.js';
import { upsertCompany } from './persist.js';

export interface RunSummary {
  searchRunId: string;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  companiesFound: number;
  companiesNew: number;
  companiesDuplicate: number;
  hotLeads: number;
  highOpportunity: number;
  warmLeads: number;
  noWebsite: number;
  weakWebsite: number;
  stageFailures: number;
  error?: string;
}

const ENRICHMENT_CONCURRENCY = 4;

/**
 * Executes one search run end to end: source → dedupe → enrich → score.
 *
 * Failure handling is deliberately layered. A failure inside one company's
 * enrichment is contained by `enrichCompany`. A failure fetching one page of
 * results ends pagination but keeps everything already collected, and the run
 * finishes as PARTIAL. Only a failure before any company is stored marks the
 * run FAILED.
 */
export async function runSearch(ctx: PipelineContext, searchRunId: string): Promise<RunSummary> {
  const log = ctx.log.child({ jobId: searchRunId });

  const run = await ctx.db.searchRun.findUnique({
    where: { id: searchRunId },
    include: { search: true },
  });
  if (!run) throw new Error(`search run ${searchRunId} not found`);

  const filters = parseFilters(run.search.filters);
  await ctx.db.searchRun.update({
    where: { id: searchRunId },
    data: { status: 'RUNNING', startedAt: ctx.now() },
  });

  const summary: RunSummary = {
    searchRunId,
    status: 'COMPLETED',
    companiesFound: 0,
    companiesNew: 0,
    companiesDuplicate: 0,
    hotLeads: 0,
    highOpportunity: 0,
    warmLeads: 0,
    noWebsite: 0,
    weakWebsite: 0,
    stageFailures: 0,
  };

  try {
    const country = requireCountry(filters.countryCode);
    const provider = pickProvider(ctx, filters.countryCode);
    log.info('run.started', `search run started using ${provider.name}`, {
      country: country.code,
      industries: filters.industryKeys,
      age: filters.companyAge,
    });

    const companyIds = await collectCompanies(ctx, provider, filters, summary, log);

    if (companyIds.length === 0) {
      await finish(ctx, searchRunId, summary, { collected: 0 });
      return summary;
    }

    const outcomes = await mapWithConcurrency(companyIds, ENRICHMENT_CONCURRENCY, (companyId) =>
      enrichCompany(ctx, companyId, {
        requestedIndustryKeys: filters.industryKeys,
        skipWebsiteAnalysis: filters.skipWebsiteAnalysis,
      }),
    );

    summary.stageFailures = outcomes.reduce((sum, o) => sum + o.stageFailures, 0);
    if (summary.stageFailures > 0) summary.status = 'PARTIAL';

    const counts = await ctx.db.company.groupBy({
      by: ['currentClassification'],
      where: { runResults: { some: { searchRunId } } },
      _count: { _all: true },
    });
    for (const row of counts) {
      const n = row._count._all;
      if (row.currentClassification === 'HOT') summary.hotLeads = n;
      if (row.currentClassification === 'HIGH_OPPORTUNITY') summary.highOpportunity = n;
      if (row.currentClassification === 'WARM') summary.warmLeads = n;
    }

    summary.noWebsite = await ctx.db.company.count({
      where: { runResults: { some: { searchRunId } }, websiteStatus: 'NO_WEBSITE_FOUND' },
    });
    summary.weakWebsite = await ctx.db.company.count({
      where: {
        runResults: { some: { searchRunId } },
        websites: { some: { analyses: { some: { qualityScore: { lt: 55 } } } } },
      },
    });

    await finish(ctx, searchRunId, summary, { collected: companyIds.length });
    log.info('run.finished', 'search run finished', { ...summary });
    return summary;
  } catch (err) {
    const { code, message } = describeError(err);
    summary.status = summary.companiesFound > 0 ? 'PARTIAL' : 'FAILED';
    summary.error = `${code}: ${message}`;
    log.error('run.failed', 'search run failed', { code, message });
    await finish(ctx, searchRunId, summary, {});
    return summary;
  }
}

function pickProvider(ctx: PipelineContext, countryCode: string): CompanySourceProvider {
  const provider = ctx.providers.companySources.find(
    (p) => p.countries.includes(countryCode.toUpperCase()) && p.isConfigured(),
  );
  if (!provider) throw new Error(`No configured company source provider for ${countryCode}`);
  return provider;
}

/** Pages through the source provider, storing and deduplicating as it goes. */
async function collectCompanies(
  ctx: PipelineContext,
  provider: CompanySourceProvider,
  filters: SearchFilters,
  summary: RunSummary,
  log: PipelineContext['log'],
): Promise<string[]> {
  const window = incorporationWindow(filters, ctx.now());
  const registryCodes = filters.industryKeys.length
    ? registryCodesFor(filters.industryKeys, filters.countryCode)
    : [];

  const limit = Math.min(filters.maxCompanies, MAX_COMPANIES_PER_RUN);
  const location = filters.city ?? filters.postcodePrefix ?? filters.region;

  const ids: string[] = [];
  let startIndex = 0;

  while (ids.length < limit) {
    const pageSize = Math.min(SOURCE_PAGE_SIZE, limit - ids.length);
    let page;
    try {
      page = await provider.searchCompanies(
        {
          countryCode: filters.countryCode,
          ...(registryCodes.length ? { registryCodes } : {}),
          ...(location ? { location } : {}),
          ...(window.from ? { incorporatedFrom: window.from } : {}),
          ...(window.to ? { incorporatedTo: window.to } : {}),
          statuses: filters.statuses,
          ...(filters.nameIncludes ? { nameIncludes: filters.nameIncludes } : {}),
        },
        { startIndex, pageSize },
      );
    } catch (err) {
      const { code, message } = describeError(err);
      log.warn('run.source_page_failed', 'stopping pagination after a source error', {
        code,
        message,
        startIndex,
      });
      summary.status = ids.length > 0 ? 'PARTIAL' : 'FAILED';
      summary.error = `${code}: ${message}`;
      break;
    }

    for (const sourceCompany of page.companies) {
      if (ids.length >= limit) break;
      try {
        const { company, isNew } = await upsertCompany(ctx.db, sourceCompany, provider.name);
        summary.companiesFound += 1;
        if (isNew) summary.companiesNew += 1;
        else summary.companiesDuplicate += 1;

        await ctx.db.searchRunResult.upsert({
          where: { searchRunId_companyId: { searchRunId: summary.searchRunId, companyId: company.id } },
          create: { searchRunId: summary.searchRunId, companyId: company.id, isNew },
          update: {},
        });
        if (!ids.includes(company.id)) ids.push(company.id);
      } catch (err) {
        // One malformed record must never end the run.
        const { code, message } = describeError(err);
        log.warn('run.company_store_failed', 'skipped a company we could not store', {
          code,
          message,
          name: sourceCompany.name,
        });
        summary.status = 'PARTIAL';
      }
    }

    if (page.nextStartIndex === undefined) break;
    startIndex = page.nextStartIndex;
  }

  return ids;
}

async function finish(
  ctx: PipelineContext,
  searchRunId: string,
  summary: RunSummary,
  stats: Record<string, unknown>,
): Promise<void> {
  await ctx.db.searchRun.update({
    where: { id: searchRunId },
    data: {
      status: summary.status,
      finishedAt: ctx.now(),
      companiesFound: summary.companiesFound,
      companiesNew: summary.companiesNew,
      companiesDuplicate: summary.companiesDuplicate,
      hotLeads: summary.hotLeads,
      highOpportunity: summary.highOpportunity,
      warmLeads: summary.warmLeads,
      noWebsite: summary.noWebsite,
      weakWebsite: summary.weakWebsite,
      stageFailures: summary.stageFailures,
      error: summary.error ?? null,
      stats: stats as Prisma.InputJsonValue,
    },
  });
}
