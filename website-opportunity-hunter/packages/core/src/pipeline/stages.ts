import type { Company, Db, Prisma, StageStatus } from '@woh/db';
import { analyzeWebsite } from '../analyzer/index.js';
import type { PageFacts } from '../analyzer/extract.js';
import { requireCountry } from '../countries/registry.js';
import { describeError } from '../domain/errors.js';
import type { BusinessActivitySignal, Confidence } from '../domain/types.js';
import { discoverWebsite } from '../discovery/website.js';
import { classify, primaryIndustry } from '../industry/classify.js';
import type { PlaceRecord } from '../providers/places/types.js';
import { calculateOpportunityScore } from '../scoring/opportunity.js';
import { detectSignals } from '../signals/detect.js';
import { discoverSocialProfiles } from '../social/discover.js';
import type { PipelineContext } from './context.js';
import { SCORE_VERSION } from '@woh/config';

/** Which company column records the outcome of each stage. */
type StageField =
  | 'enrichmentStatus'
  | 'websiteDiscoveryStatus'
  | 'websiteAnalysisStatus'
  | 'socialDiscoveryStatus'
  | 'signalsStatus'
  | 'scoringStatus';

export interface EnrichmentOptions {
  /** Industries the operator asked for; used to break classification ties. */
  requestedIndustryKeys?: string[];
  skipWebsiteAnalysis?: boolean;
  /** Re-analyse a website only if the last analysis is older than this. */
  analysisTtlHours?: number;
}

export interface EnrichmentOutcome {
  companyId: string;
  score?: number;
  classification?: string;
  stageFailures: number;
  failedStages: string[];
}

/**
 * Runs every enrichment stage for one company.
 *
 * The whole point of this function is that no single failure loses the lead.
 * Each stage records its own status on the company row, an exception is caught
 * and turned into FAILED or UNAVAILABLE, and the pipeline carries on to the
 * next stage with whatever it has.
 */
export async function enrichCompany(
  ctx: PipelineContext,
  companyId: string,
  options: EnrichmentOptions = {},
): Promise<EnrichmentOutcome> {
  const log = ctx.log.child({ companyId });
  const failedStages: string[] = [];

  const company = await ctx.db.company.findUnique({ where: { id: companyId } });
  if (!company) return { companyId, stageFailures: 0, failedStages: [] };

  const country = requireCountry(company.countryCode);

  const stage = async <T>(field: StageField, name: string, fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      const result = await fn();
      await setStage(ctx.db, companyId, field, 'DONE');
      return result;
    } catch (err) {
      const { code, message } = describeError(err);
      // A provider that was never configured is not a failure — it is a
      // deployment choice. Counting it as one would mark every run PARTIAL on a
      // fresh install and bury the failures that actually need attention.
      const unavailable = code === 'PROVIDER_NOT_CONFIGURED' || code === 'BUDGET_EXCEEDED';
      const status: StageStatus = unavailable ? 'UNAVAILABLE' : 'FAILED';
      await setStage(ctx.db, companyId, field, status, unavailable ? undefined : `${name}: ${message}`);
      if (unavailable) {
        log.debug('pipeline.stage_unavailable', `${name} was skipped`, { code, message });
      } else {
        failedStages.push(name);
        log.warn('pipeline.stage_failed', `${name} did not complete`, { code, message });
      }
      return undefined;
    }
  };

  // --- 1. Industry -----------------------------------------------------------
  let industryKey: string | undefined;
  let industryConfidence: Confidence | undefined;
  await stage('enrichmentStatus', 'industry_classification', async () => {
    const matches = classify({
      countryCode: company.countryCode,
      name: company.name,
      sicCodes: company.sicCodes,
      ...(options.requestedIndustryKeys ? { requestedIndustryKeys: options.requestedIndustryKeys } : {}),
    });
    const primary = primaryIndustry(matches);
    industryKey = primary?.industryKey;
    industryConfidence = primary?.confidence;
    for (const [index, match] of matches.slice(0, 3).entries()) {
      await ctx.db.companyIndustry.upsert({
        where: { companyId_industryKey: { companyId, industryKey: match.industryKey } },
        create: {
          companyId,
          industryKey: match.industryKey,
          subIndustryKey: match.subIndustryKey ?? null,
          method: match.method,
          confidence: match.confidence,
          isPrimary: index === 0,
          evidence: match.evidence,
        },
        update: {
          subIndustryKey: match.subIndustryKey ?? null,
          method: match.method,
          confidence: match.confidence,
          isPrimary: index === 0,
          evidence: match.evidence,
        },
      });
    }
  });

  // --- 2. Business listing (reviews, rating, phone, hours) -------------------
  let place: PlaceRecord | null = null;
  let placeLookedUp = false;
  await stage('enrichmentStatus', 'places_lookup', async () => {
    place = await ctx.providers.places.findPlace({
      name: company.name,
      ...(company.addressLine1 ? { address: company.addressLine1 } : {}),
      ...(company.city ? { city: company.city } : {}),
      countryCode: company.countryCode,
    });
    placeLookedUp = true;
    if (place) {
      const record = place as PlaceRecord;
      await ctx.db.company.update({
        where: { id: companyId },
        data: {
          ...(record.userRatingCount !== undefined ? { reviewCount: record.userRatingCount } : {}),
          ...(record.rating !== undefined ? { rating: record.rating } : {}),
          ...(!company.phone && record.nationalPhoneNumber ? { phone: record.nationalPhoneNumber } : {}),
        },
      });
    }
  });

  // --- 3. Website discovery --------------------------------------------------
  let websiteId: string | undefined;
  let websiteUrl: string | undefined;
  const discovery = await stage('websiteDiscoveryStatus', 'website_discovery', async () => {
    const result = await discoverWebsite(
      {
        company: {
          name: company.name,
          countryCode: company.countryCode,
          address: {
            ...(company.addressLine1 ? { line1: company.addressLine1 } : {}),
            ...(company.city ? { city: company.city } : {}),
            ...(company.postcode ? { postcode: company.postcode } : {}),
          },
          ...(company.phone ? { phone: company.phone } : {}),
        },
        domainSuffixes: country.domainSuffixes,
        legalSuffixes: country.legalSuffixes,
        ...(placeLookedUp ? { place } : {}),
      },
      {
        http: ctx.providers.websiteHttp,
        robots: ctx.providers.robots,
        webSearch: ctx.providers.webSearch,
        places: ctx.providers.places,
      },
    );

    await ctx.db.company.update({
      where: { id: companyId },
      data: {
        websiteStatus: result.status,
        websiteConfidence: result.confidence,
        websiteStatusNote: result.note.slice(0, 1000),
      },
    });

    if (result.website) {
      const saved = await ctx.db.website.upsert({
        where: { companyId_domain: { companyId, domain: result.website.domain } },
        create: {
          companyId,
          url: result.website.url,
          domain: result.website.domain,
          discoveryMethod: result.website.method,
          confidence: result.website.confidence,
          evidence: result.website.evidence,
          isPrimary: true,
        },
        update: {
          url: result.website.url,
          discoveryMethod: result.website.method,
          confidence: result.website.confidence,
          evidence: result.website.evidence,
          isPrimary: true,
        },
      });
      websiteId = saved.id;
      websiteUrl = saved.url;
      await ctx.db.company.update({ where: { id: companyId }, data: { primaryWebsiteId: saved.id } });
    }
    return result;
  });

  // --- 4. Website analysis ---------------------------------------------------
  let websiteFacts: PageFacts | undefined;
  let websiteQualityScore: number | undefined;
  let underConstruction = false;
  let underConstructionEvidence: string | undefined;
  let websiteUnreachable = false;

  if (websiteId && websiteUrl && !options.skipWebsiteAnalysis) {
    await stage('websiteAnalysisStatus', 'website_analysis', async () => {
      const ttlHours = options.analysisTtlHours ?? ctx.env.WEBSITE_ANALYSIS_TTL_HOURS;
      const cutoff = new Date(ctx.now().getTime() - ttlHours * 3_600_000);
      const cached = await ctx.db.websiteAnalysis.findFirst({
        where: { websiteId, fetchedAt: { gte: cutoff } },
        orderBy: { fetchedAt: 'desc' },
      });
      if (cached) {
        websiteQualityScore = cached.qualityScore ?? undefined;
        websiteUnreachable = cached.httpStatus === null && cached.errorCode !== null;
        ctx.log.debug('pipeline.analysis_cached', 'reused a recent website analysis', { companyId });
        return;
      }

      const analysis = await analyzeWebsite(
        websiteUrl!,
        { http: ctx.providers.websiteHttp, robots: ctx.providers.robots },
        { ...(industryKey ? { industryKey } : {}) },
      );

      websiteFacts = analysis.facts;
      websiteQualityScore = analysis.quality?.score;
      underConstruction = analysis.underConstruction;
      underConstructionEvidence = analysis.underConstructionEvidence;
      websiteUnreachable = !analysis.fetch.ok;

      await ctx.db.websiteAnalysis.create({
        data: buildAnalysisRow(websiteId!, analysis),
      });
      await ctx.db.website.update({ where: { id: websiteId! }, data: { lastCheckedAt: ctx.now() } });
    });
  } else if (!websiteId) {
    await setStage(ctx.db, companyId, 'websiteAnalysisStatus', 'SKIPPED', 'no website to analyse');
  } else {
    await setStage(ctx.db, companyId, 'websiteAnalysisStatus', 'SKIPPED', 'analysis disabled for this search');
  }

  // --- 5. Social profiles ----------------------------------------------------
  await stage('socialDiscoveryStatus', 'social_discovery', async () => {
    const result = await discoverSocialProfiles(
      {
        companyName: company.name,
        ...(company.city ? { city: company.city } : {}),
        legalSuffixes: country.legalSuffixes,
        websiteFacts,
        place,
      },
      { webSearch: ctx.providers.webSearch },
    );
    for (const profile of result.profiles) {
      await ctx.db.socialProfile.upsert({
        where: {
          companyId_platform_url: { companyId, platform: profile.platform, url: profile.url },
        },
        create: {
          companyId,
          platform: profile.platform,
          url: profile.url,
          handle: profile.handle ?? null,
          discoveryMethod: profile.method,
          confidence: profile.confidence,
          evidence: profile.evidence,
        },
        update: { confidence: profile.confidence, evidence: profile.evidence },
      });
    }
  });

  // --- 6. Activity signals ---------------------------------------------------
  await stage('signalsStatus', 'activity_signals', async () => {
    const signals = detectSignals({
      companyName: company.name,
      incorporationDate: company.incorporationDate ?? undefined,
      registryUrl: await registryUrl(ctx.db, companyId),
      websiteFacts,
      websiteUrl,
      underConstruction,
      underConstructionEvidence,
      now: ctx.now(),
    });
    for (const signal of signals) {
      await ctx.db.businessSignal.upsert({
        where: { companyId_type_source: { companyId, type: signal.type, source: signal.source } },
        create: {
          companyId,
          type: signal.type,
          source: signal.source,
          sourceUrl: signal.sourceUrl ?? null,
          occurredAt: signal.occurredAt ?? null,
          confidence: signal.confidence,
          evidence: signal.evidence.slice(0, 1000),
        },
        update: {
          detectedAt: signal.detectedAt,
          confidence: signal.confidence,
          evidence: signal.evidence.slice(0, 1000),
        },
      });
    }
  });

  // --- 7. Score --------------------------------------------------------------
  const scored = await stage('scoringStatus', 'scoring', async () => {
    return scoreCompany(ctx, companyId);
  });

  return {
    companyId,
    ...(scored ? { score: scored.score, classification: scored.classification } : {}),
    stageFailures: failedStages.length,
    failedStages,
    ...(discovery ? {} : {}),
  };
}

/** Recomputes the score from what is currently stored. Safe to call any time. */
export async function scoreCompany(
  ctx: PipelineContext,
  companyId: string,
): Promise<{ score: number; classification: string }> {
  const company = await ctx.db.company.findUniqueOrThrow({
    where: { id: companyId },
    include: {
      industries: { where: { isPrimary: true }, take: 1 },
      socials: true,
      signals: true,
      websites: { where: { isPrimary: true }, include: { analyses: { orderBy: { fetchedAt: 'desc' }, take: 1 } } },
    },
  });

  const analysis = company.websites[0]?.analyses[0];
  const primaryIndustryRow = company.industries[0];

  const signals: BusinessActivitySignal[] = company.signals.map((s) => ({
    type: s.type,
    source: s.source,
    ...(s.sourceUrl ? { sourceUrl: s.sourceUrl } : {}),
    detectedAt: s.detectedAt,
    ...(s.occurredAt ? { occurredAt: s.occurredAt } : {}),
    confidence: s.confidence,
    evidence: s.evidence,
  }));

  const result = calculateOpportunityScore({
    now: ctx.now(),
    companyStatus: company.status,
    incorporationDate: company.incorporationDate,
    websiteStatus: company.websiteStatus,
    websiteStatusConfidence: company.websiteConfidence,
    websiteQualityScore: analysis?.qualityScore,
    websiteUnderConstruction: company.signals.some((s) => s.type === 'UNDER_CONSTRUCTION_WEBSITE'),
    websiteUnreachable: !!analysis && analysis.qualityScore === null,
    socialProfiles: company.socials.map((s) => ({ platform: s.platform, confidence: s.confidence })),
    reviewCount: company.reviewCount,
    rating: company.rating,
    industryKey: primaryIndustryRow?.industryKey,
    industryConfidence: primaryIndustryRow?.confidence,
    signals,
    thresholds: ctx.thresholds,
  });

  await ctx.db.score.create({
    data: {
      companyId,
      version: SCORE_VERSION,
      score: result.score,
      classification: result.classification,
      confidence: result.confidence,
      breakdown: result.components as unknown as Prisma.InputJsonValue,
      reasons: result.reasons,
      gaps: result.gaps,
    },
  });

  await ctx.db.company.update({
    where: { id: companyId },
    data: {
      currentScore: result.score,
      currentClassification: result.classification,
      scoredAt: ctx.now(),
    },
  });

  return { score: result.score, classification: result.classification };
}

async function setStage(
  db: Db,
  companyId: string,
  field: StageField,
  status: StageStatus,
  error?: string,
): Promise<void> {
  await db.company.update({
    where: { id: companyId },
    data: {
      [field]: status,
      ...(error ? { lastPipelineError: error.slice(0, 500) } : {}),
    } as Prisma.CompanyUpdateInput,
  });
}

async function registryUrl(db: Db, companyId: string): Promise<string | undefined> {
  const source = await db.companySource.findFirst({
    where: { companyId, sourceUrl: { not: null } },
    orderBy: { fetchedAt: 'desc' },
  });
  return source?.sourceUrl ?? undefined;
}

function buildAnalysisRow(
  websiteId: string,
  analysis: Awaited<ReturnType<typeof analyzeWebsite>>,
): Prisma.WebsiteAnalysisUncheckedCreateInput {
  const { fetch: page, facts, quality } = analysis;
  return {
    websiteId,
    httpStatus: page.status ?? null,
    errorCode: page.errorCode ?? null,
    errorMessage: page.errorMessage ?? null,
    finalUrl: page.finalUrl ?? null,
    responseTimeMs: page.responseTimeMs ?? null,
    htmlBytes: page.bytes ?? null,
    https: facts?.https ?? null,
    hasViewportMeta: facts?.hasViewportMeta ?? null,
    mobileResponsive: facts?.hasViewportMeta ?? null,
    title: facts?.title ?? null,
    titleLength: facts?.title?.length ?? null,
    metaDescription: facts?.metaDescription ?? null,
    h1Count: facts?.h1Texts.length ?? null,
    hasCta: facts?.hasCtaButton ?? null,
    hasPhone: facts ? facts.phones.length > 0 : null,
    hasEmail: facts ? facts.emails.length > 0 : null,
    hasContactForm: facts?.hasContactForm ?? null,
    hasOnlineBooking: facts?.hasBookingSignal ?? null,
    hasWhatsApp: facts?.hasWhatsApp ?? null,
    hasMap: facts?.hasMap ?? null,
    hasSocialLinks: facts ? facts.socialLinks.length > 0 : null,
    servicePageCount: facts?.servicePages.length ?? null,
    locationPageCount: facts?.locationPages.length ?? null,
    hasTestimonials: facts?.hasTestimonials ?? null,
    hasTrustSignals: facts?.hasTrustSignals ?? null,
    hasPrivacyPage: facts?.hasPrivacyPage ?? null,
    hasCookieNotice: facts?.hasCookieNotice ?? null,
    imagesMissingAlt: facts?.imagesMissingAlt ?? null,
    totalImages: facts?.totalImages ?? null,
    hasLangAttribute: facts ? !!facts.lang : null,
    brokenLinkCount: analysis.brokenLinkCount ?? null,
    checkedLinkCount: analysis.checkedLinkCount ?? null,
    outdatedTechHints: facts?.outdatedHints ?? [],
    detectedPlatform: facts?.detectedPlatform ?? null,
    brandColourHints: facts?.brandColourHints ?? [],
    qualityScore: quality?.score ?? null,
    weaknesses: quality?.weaknesses ?? [],
    checks: (quality?.checks ?? []) as unknown as Prisma.InputJsonValue,
  };
}
