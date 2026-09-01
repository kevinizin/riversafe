import { loadEnv } from '@woh/config';
import {
  FIXTURE_COMPANIES,
  FixtureCompanyProvider,
  buildOutreachFacts,
  calculateOpportunityScore,
  classify,
  createPipelineContext,
  detectSignals,
  extractFacts,
  getIndustry,
  hashPassword,
  primaryIndustry,
  qualityBand,
  scoreWebsite,
  selectDecisionMaker,
  upsertCompany,
  type PageFacts,
} from '@woh/core';
import { loadEnvFileIfPresent } from '../../../scripts/load-env.mjs';
import { prisma, type Prisma } from '@woh/db';

/**
 * Development seed.
 *
 * Every company here is fictional and named so it cannot be confused with a
 * real business; no real person, address, phone number or domain appears
 * anywhere in it. The seed runs the *real* dedup, analysis and scoring code
 * against canned HTML, so what you see in the dashboard is produced by the same
 * engine that will run against live data — not by hardcoded numbers.
 */
// Must run before loadEnv(): a plain Node process does not read .env itself.
loadEnvFileIfPresent();

async function main(): Promise<void> {
  const env = loadEnv();
  const ctx = createPipelineContext(env, { db: prisma, persistLogs: false });

  const fixtureProvider = new FixtureCompanyProvider();
  const password = process.env.SEED_PASSWORD ?? 'demo-password-1';
  const email = process.env.SEED_EMAIL ?? 'demo@example.com';

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: 'Demo operator',
      role: 'ADMIN',
      passwordHash: await hashPassword(password),
    },
    update: {},
  });
  console.log(`user: ${email} / ${password}`);

  const search = await prisma.search.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      userId: user.id,
      name: 'UK dental, last 30 days, no website',
      filters: {
        countryCode: 'GB',
        industryKeys: ['dental'],
        city: 'Manchester',
        companyAge: 'LAST_30_DAYS',
        websiteFilter: 'NO_OR_WEAK',
        minScore: 0,
        statuses: ['active'],
        requireSocialPresence: false,
        maxCompanies: 200,
        skipWebsiteAnalysis: false,
      } satisfies Prisma.InputJsonValue,
    },
    update: {},
  });

  const run = await prisma.searchRun.create({
    data: { searchId: search.id, status: 'RUNNING', startedAt: new Date() },
  });

  let hot = 0;
  let high = 0;
  let warm = 0;
  let noWebsite = 0;
  let weakWebsite = 0;
  let created = 0;
  let duplicates = 0;

  for (const fixture of FIXTURE_COMPANIES) {
    const { fixture: extras, ...sourceFields } = fixture;
    const { company, isNew } = await upsertCompany(
      prisma,
      { ...sourceFields, provider: 'fixture', externalId: fixture.externalId, raw: sourceFields },
      'fixture',
    );
    if (isNew) created += 1;
    else duplicates += 1;

    await prisma.searchRunResult.upsert({
      where: { searchRunId_companyId: { searchRunId: run.id, companyId: company.id } },
      create: { searchRunId: run.id, companyId: company.id, isNew },
      update: {},
    });

    // --- industry -----------------------------------------------------------
    const matches = classify({
      countryCode: company.countryCode,
      name: company.name,
      sicCodes: company.sicCodes,
    });
    const primary = primaryIndustry(matches);
    for (const [index, match] of matches.slice(0, 3).entries()) {
      await prisma.companyIndustry.upsert({
        where: { companyId_industryKey: { companyId: company.id, industryKey: match.industryKey } },
        create: {
          companyId: company.id,
          industryKey: match.industryKey,
          subIndustryKey: match.subIndustryKey ?? null,
          method: match.method,
          confidence: match.confidence,
          isPrimary: index === 0,
          evidence: match.evidence,
        },
        update: { isPrimary: index === 0 },
      });
    }

    // --- decision maker ------------------------------------------------------
    const officerLookup = await fixtureProvider.getOfficers(fixture.externalId, {
      includeNames: env.COLLECT_OFFICER_NAMES,
    });
    if (officerLookup.kind === 'FOUND') {
      const selection = selectDecisionMaker(officerLookup.data.value, company.incorporationDate);
      await prisma.contact.deleteMany({ where: { companyId: company.id, kind: 'OFFICER_ROLE' } });
      for (const candidate of [selection.best, ...selection.others].filter(Boolean).slice(0, 3)) {
        await prisma.contact.create({
          data: {
            companyId: company.id,
            kind: 'OFFICER_ROLE',
            role: candidate!.roleLabel,
            name: candidate!.officer.name ?? null,
            isPersonal: !!candidate!.officer.name,
            source: 'fixture:officers',
            confidence: 'HIGH',
            evidence: candidate!.reason,
          },
        });
      }
    }

    // --- website + analysis --------------------------------------------------
    let facts: PageFacts | undefined;
    let qualityScore: number | undefined;
    if (extras.website && extras.html) {
      const domain = new URL(extras.website).hostname.replace(/^www\./, '');
      const website = await prisma.website.upsert({
        where: { companyId_domain: { companyId: company.id, domain } },
        create: {
          companyId: company.id,
          url: extras.website,
          domain,
          discoveryMethod: 'SOURCE_RECORD',
          confidence: 'HIGH',
          evidence: 'fixture dataset',
          isPrimary: true,
          lastCheckedAt: new Date(),
        },
        update: { lastCheckedAt: new Date() },
      });

      facts = extractFacts(extras.html, extras.website);
      const profile = primary ? getIndustry(primary.industryKey) : undefined;
      const quality = scoreWebsite(facts, {
        responseTimeMs: 620,
        bookingExpected: profile?.bookingExpected ?? false,
      });
      qualityScore = quality.score;
      if (quality.score < 55) weakWebsite += 1;

      await prisma.websiteAnalysis.create({
        data: {
          websiteId: website.id,
          httpStatus: 200,
          finalUrl: extras.website,
          responseTimeMs: 620,
          htmlBytes: Buffer.byteLength(extras.html),
          https: facts.https,
          hasViewportMeta: facts.hasViewportMeta,
          mobileResponsive: facts.hasViewportMeta,
          title: facts.title,
          titleLength: facts.title?.length ?? null,
          metaDescription: facts.metaDescription,
          h1Count: facts.h1Texts.length,
          hasCta: facts.hasCtaButton,
          hasPhone: facts.phones.length > 0,
          hasEmail: facts.emails.length > 0,
          hasContactForm: facts.hasContactForm,
          hasOnlineBooking: facts.hasBookingSignal,
          hasWhatsApp: facts.hasWhatsApp,
          hasMap: facts.hasMap,
          hasSocialLinks: facts.socialLinks.length > 0,
          servicePageCount: facts.servicePages.length,
          locationPageCount: facts.locationPages.length,
          hasTestimonials: facts.hasTestimonials,
          hasTrustSignals: facts.hasTrustSignals,
          hasPrivacyPage: facts.hasPrivacyPage,
          hasCookieNotice: facts.hasCookieNotice,
          imagesMissingAlt: facts.imagesMissingAlt,
          totalImages: facts.totalImages,
          hasLangAttribute: !!facts.lang,
          outdatedTechHints: facts.outdatedHints,
          detectedPlatform: facts.detectedPlatform,
          brandColourHints: facts.brandColourHints,
          qualityScore: quality.score,
          weaknesses: quality.weaknesses,
          checks: quality.checks as unknown as Prisma.InputJsonValue,
        },
      });

      await prisma.company.update({
        where: { id: company.id },
        data: {
          primaryWebsiteId: website.id,
          websiteStatus: 'WEBSITE_FOUND',
          websiteConfidence: 'HIGH',
          websiteStatusNote: `Found ${domain} in the fixture dataset. Quality band: ${qualityBand(quality.score)}.`,
          websiteDiscoveryStatus: 'DONE',
          websiteAnalysisStatus: 'DONE',
        },
      });
    } else {
      noWebsite += 1;
      await prisma.company.update({
        where: { id: company.id },
        data: {
          websiteStatus: 'NO_WEBSITE_FOUND',
          websiteConfidence: 'MEDIUM',
          websiteStatusNote:
            'No website found after 3 discovery methods: registry record, web search by name and town, likely domain probe.',
          websiteDiscoveryStatus: 'DONE',
          websiteAnalysisStatus: 'SKIPPED',
        },
      });
    }

    // --- social + listing ----------------------------------------------------
    for (const social of extras.socials ?? []) {
      await prisma.socialProfile.upsert({
        where: {
          companyId_platform_url: {
            companyId: company.id,
            platform: social.platform as 'INSTAGRAM',
            url: social.url,
          },
        },
        create: {
          companyId: company.id,
          platform: social.platform as 'INSTAGRAM',
          url: social.url,
          handle: `@${social.url.split('/').filter(Boolean).pop()}`,
          discoveryMethod: 'WEB_SEARCH_NAME_LOCATION',
          confidence: 'MEDIUM',
          evidence: 'fixture dataset',
        },
        update: {},
      });
    }
    if (extras.reviewCount !== undefined) {
      await prisma.company.update({
        where: { id: company.id },
        data: {
          reviewCount: extras.reviewCount,
          ...(extras.rating !== undefined ? { rating: extras.rating } : {}),
        },
      });
    }

    // --- signals -------------------------------------------------------------
    const signals = detectSignals({
      companyName: company.name,
      incorporationDate: company.incorporationDate ?? undefined,
      websiteFacts: facts,
      websiteUrl: extras.website,
      latestReviewAt: extras.latestReviewAt,
    });
    for (const signal of signals) {
      await prisma.businessSignal.upsert({
        where: { companyId_type_source: { companyId: company.id, type: signal.type, source: signal.source } },
        create: {
          companyId: company.id,
          type: signal.type,
          source: signal.source,
          sourceUrl: signal.sourceUrl ?? null,
          occurredAt: signal.occurredAt ?? null,
          confidence: signal.confidence,
          evidence: signal.evidence,
        },
        update: {},
      });
    }

    // --- score ---------------------------------------------------------------
    const fresh = await prisma.company.findUniqueOrThrow({
      where: { id: company.id },
      include: { socials: true, signals: true },
    });
    const score = calculateOpportunityScore({
      companyStatus: fresh.status,
      incorporationDate: fresh.incorporationDate,
      websiteStatus: fresh.websiteStatus,
      websiteStatusConfidence: fresh.websiteConfidence,
      websiteQualityScore: qualityScore,
      socialProfiles: fresh.socials.map((s) => ({ platform: s.platform, confidence: s.confidence })),
      reviewCount: fresh.reviewCount,
      rating: fresh.rating,
      industryKey: primary?.industryKey,
      industryConfidence: primary?.confidence,
      signals: fresh.signals.map((s) => ({
        type: s.type,
        source: s.source,
        detectedAt: s.detectedAt,
        confidence: s.confidence,
        evidence: s.evidence,
      })),
    });

    await prisma.score.create({
      data: {
        companyId: company.id,
        version: 1,
        score: score.score,
        classification: score.classification,
        confidence: score.confidence,
        breakdown: score.components as unknown as Prisma.InputJsonValue,
        reasons: score.reasons,
        gaps: score.gaps,
      },
    });
    await prisma.company.update({
      where: { id: company.id },
      data: {
        currentScore: score.score,
        currentClassification: score.classification,
        scoredAt: new Date(),
        scoringStatus: 'DONE',
        enrichmentStatus: 'DONE',
        socialDiscoveryStatus: 'DONE',
        signalsStatus: 'DONE',
      },
    });

    if (score.classification === 'HOT') hot += 1;
    if (score.classification === 'HIGH_OPPORTUNITY') high += 1;
    if (score.classification === 'WARM') warm += 1;

    const outreachFacts = buildOutreachFacts({
      companyName: fresh.name,
      city: fresh.city,
      incorporationDate: fresh.incorporationDate,
      industryKey: primary?.industryKey,
      websiteStatus: fresh.websiteStatus,
      websiteStatusNote: fresh.websiteStatusNote,
      reviewCount: fresh.reviewCount,
      rating: fresh.rating,
      socialProfiles: fresh.socials.map((s) => ({ platform: s.platform, url: s.url, confidence: s.confidence })),
    });
    console.log(
      `  ${fresh.name}: ${score.score}/100 ${score.classification} (${outreachFacts.length} facts)`,
    );
  }

  await prisma.searchRun.update({
    where: { id: run.id },
    data: {
      status: 'COMPLETED',
      finishedAt: new Date(),
      companiesFound: FIXTURE_COMPANIES.length,
      companiesNew: created,
      companiesDuplicate: duplicates,
      hotLeads: hot,
      highOpportunity: high,
      warmLeads: warm,
      noWebsite,
      weakWebsite,
      stats: { seeded: true } satisfies Prisma.InputJsonValue,
    },
  });

  console.log(
    `\nseeded ${created} companies (${duplicates} recognised as duplicates), ${hot} hot, ${high} high opportunity, ${warm} warm`,
  );
  await ctx.db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
