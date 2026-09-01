-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'DISSOLVED', 'LIQUIDATION', 'ADMINISTRATION', 'CLOSED', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "WebsiteStatus" AS ENUM ('NOT_CHECKED', 'NO_WEBSITE_FOUND', 'WEBSITE_UNCERTAIN', 'WEBSITE_FOUND');

-- CreateEnum
CREATE TYPE "DiscoveryMethod" AS ENUM ('SOURCE_RECORD', 'DOMAIN_CANDIDATE', 'WEB_SEARCH_NAME', 'WEB_SEARCH_NAME_LOCATION', 'WEB_SEARCH_PHONE', 'WEB_SEARCH_ADDRESS', 'PLACES_PROVIDER', 'SOCIAL_PROFILE_LINK', 'WEBSITE_LINK', 'MANUAL');

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'X', 'TIKTOK', 'YOUTUBE', 'GOOGLE_BUSINESS');

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('RECENT_INCORPORATION', 'OPENING_SOON', 'NOW_OPEN', 'GRAND_OPENING', 'NEW_BUSINESS', 'NEW_LOCATION', 'COMING_SOON', 'RECENT_REVIEWS', 'RECENT_SOCIAL_ACTIVITY', 'RECENTLY_REGISTERED_DOMAIN', 'UNDER_CONSTRUCTION_WEBSITE', 'HIRING');

-- CreateEnum
CREATE TYPE "Classification" AS ENUM ('HOT', 'HIGH_OPPORTUNITY', 'WARM', 'LOW_PRIORITY', 'IGNORE');

-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'SKIPPED', 'FAILED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'QUALIFIED', 'PREVIEW_CREATED', 'CONTACT_READY', 'CONTACTED', 'REPLIED', 'INTERESTED', 'DEMO', 'PROPOSAL', 'WON', 'LOST', 'DISCARDED');

-- CreateEnum
CREATE TYPE "ContactKind" AS ENUM ('BUSINESS_EMAIL', 'BUSINESS_PHONE', 'CONTACT_FORM', 'OFFICER_ROLE');

-- CreateEnum
CREATE TYPE "RetentionStatus" AS ENUM ('ACTIVE', 'ANONYMISED', 'DELETED');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "IndustryMethod" AS ENUM ('SIC_CODE', 'KEYWORD', 'AI_CLASSIFIER', 'MANUAL');

-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('DRAFT', 'READY', 'APPROVED', 'SENT', 'DISCARDED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "countryCode" VARCHAR(2) NOT NULL DEFAULT 'GB',
    "companyNumber" TEXT,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" "CompanyStatus" NOT NULL DEFAULT 'UNKNOWN',
    "incorporationDate" TIMESTAMP(3),
    "sicCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postcode" TEXT,
    "country" TEXT,
    "postcodeKey" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "websiteStatus" "WebsiteStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "websiteConfidence" "Confidence",
    "websiteStatusNote" TEXT,
    "primaryWebsiteId" UUID,
    "reviewCount" INTEGER,
    "rating" DOUBLE PRECISION,
    "enrichmentStatus" "StageStatus" NOT NULL DEFAULT 'PENDING',
    "websiteDiscoveryStatus" "StageStatus" NOT NULL DEFAULT 'PENDING',
    "websiteAnalysisStatus" "StageStatus" NOT NULL DEFAULT 'PENDING',
    "socialDiscoveryStatus" "StageStatus" NOT NULL DEFAULT 'PENDING',
    "signalsStatus" "StageStatus" NOT NULL DEFAULT 'PENDING',
    "scoringStatus" "StageStatus" NOT NULL DEFAULT 'PENDING',
    "lastPipelineError" TEXT,
    "leadStatus" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "leadStatusAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactedAt" TIMESTAMP(3),
    "discardedAt" TIMESTAMP(3),
    "currentScore" INTEGER,
    "currentClassification" "Classification",
    "scoredAt" TIMESTAMP(3),
    "dataSource" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purpose" TEXT NOT NULL DEFAULT 'B2B prospecting: assessing website need',
    "retentionStatus" "RetentionStatus" NOT NULL DEFAULT 'ACTIVE',
    "retentionUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_sources" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT,
    "sourceUrl" TEXT,
    "confidence" "Confidence" NOT NULL DEFAULT 'HIGH',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB,

    CONSTRAINT "company_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_industries" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "industryKey" TEXT NOT NULL,
    "subIndustryKey" TEXT,
    "method" "IndustryMethod" NOT NULL,
    "confidence" "Confidence" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "evidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_industries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "websites" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "discoveryMethod" "DiscoveryMethod" NOT NULL,
    "confidence" "Confidence" NOT NULL,
    "evidence" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMP(3),

    CONSTRAINT "websites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_analysis" (
    "id" UUID NOT NULL,
    "websiteId" UUID NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "httpStatus" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "finalUrl" TEXT,
    "responseTimeMs" INTEGER,
    "htmlBytes" INTEGER,
    "https" BOOLEAN,
    "validCertificate" BOOLEAN,
    "hasViewportMeta" BOOLEAN,
    "mobileResponsive" BOOLEAN,
    "title" TEXT,
    "titleLength" INTEGER,
    "metaDescription" TEXT,
    "h1Count" INTEGER,
    "hasCta" BOOLEAN,
    "hasPhone" BOOLEAN,
    "hasEmail" BOOLEAN,
    "hasContactForm" BOOLEAN,
    "hasOnlineBooking" BOOLEAN,
    "hasWhatsApp" BOOLEAN,
    "hasMap" BOOLEAN,
    "hasSocialLinks" BOOLEAN,
    "servicePageCount" INTEGER,
    "locationPageCount" INTEGER,
    "hasTestimonials" BOOLEAN,
    "hasTrustSignals" BOOLEAN,
    "hasPrivacyPage" BOOLEAN,
    "hasCookieNotice" BOOLEAN,
    "imagesMissingAlt" INTEGER,
    "totalImages" INTEGER,
    "hasLangAttribute" BOOLEAN,
    "brokenLinkCount" INTEGER,
    "checkedLinkCount" INTEGER,
    "outdatedTechHints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "detectedPlatform" TEXT,
    "qualityScore" INTEGER,
    "weaknesses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "checks" JSONB,

    CONSTRAINT "website_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_profiles" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "url" TEXT NOT NULL,
    "handle" TEXT,
    "discoveryMethod" "DiscoveryMethod" NOT NULL,
    "confidence" "Confidence" NOT NULL,
    "evidence" TEXT,
    "followers" INTEGER,
    "lastActivityAt" TIMESTAMP(3),
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_signals" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "type" "SignalType" NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "occurredAt" TIMESTAMP(3),
    "confidence" "Confidence" NOT NULL,
    "evidence" TEXT NOT NULL,

    CONSTRAINT "business_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "kind" "ContactKind" NOT NULL,
    "role" TEXT,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "url" TEXT,
    "isPersonal" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "confidence" "Confidence" NOT NULL,
    "evidence" TEXT,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purpose" TEXT NOT NULL DEFAULT 'B2B prospecting: contacting the business about its website',
    "retentionStatus" "RetentionStatus" NOT NULL DEFAULT 'ACTIVE',
    "retentionUntil" TIMESTAMP(3),

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scores" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "classification" "Classification" NOT NULL,
    "confidence" "Confidence" NOT NULL,
    "breakdown" JSONB NOT NULL,
    "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "gaps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "searches" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_runs" (
    "id" UUID NOT NULL,
    "searchId" UUID NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
    "jobId" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,
    "companiesFound" INTEGER NOT NULL DEFAULT 0,
    "companiesNew" INTEGER NOT NULL DEFAULT 0,
    "companiesDuplicate" INTEGER NOT NULL DEFAULT 0,
    "noWebsite" INTEGER NOT NULL DEFAULT 0,
    "weakWebsite" INTEGER NOT NULL DEFAULT 0,
    "hotLeads" INTEGER NOT NULL DEFAULT 0,
    "highOpportunity" INTEGER NOT NULL DEFAULT 0,
    "warmLeads" INTEGER NOT NULL DEFAULT 0,
    "stageFailures" INTEGER NOT NULL DEFAULT 0,
    "stats" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_run_results" (
    "id" UUID NOT NULL,
    "searchRunId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "isNew" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_run_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_candidates" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "status" "OutreachStatus" NOT NULL DEFAULT 'DRAFT',
    "channel" TEXT NOT NULL DEFAULT 'email',
    "subject" TEXT,
    "body" TEXT,
    "facts" JSONB,
    "previewBriefing" JSONB,
    "generatedBy" TEXT,
    "aiModel" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "markedSentAt" TIMESTAMP(3),

    CONSTRAINT "outreach_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_records" (
    "id" UUID NOT NULL,
    "jobId" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_logs" (
    "id" UUID NOT NULL,
    "level" "LogLevel" NOT NULL,
    "event" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "jobId" TEXT,
    "companyId" UUID,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_usage" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "status" INTEGER,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "durationMs" INTEGER,
    "cached" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostGbp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "companyId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "ip" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "settings_userId_key_key" ON "settings"("userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "companies_dedupeKey_key" ON "companies"("dedupeKey");

-- CreateIndex
CREATE INDEX "companies_countryCode_city_idx" ON "companies"("countryCode", "city");

-- CreateIndex
CREATE INDEX "companies_countryCode_region_idx" ON "companies"("countryCode", "region");

-- CreateIndex
CREATE INDEX "companies_postcodeKey_idx" ON "companies"("postcodeKey");

-- CreateIndex
CREATE INDEX "companies_incorporationDate_idx" ON "companies"("incorporationDate");

-- CreateIndex
CREATE INDEX "companies_websiteStatus_idx" ON "companies"("websiteStatus");

-- CreateIndex
CREATE INDEX "companies_currentScore_idx" ON "companies"("currentScore");

-- CreateIndex
CREATE INDEX "companies_currentClassification_idx" ON "companies"("currentClassification");

-- CreateIndex
CREATE INDEX "companies_leadStatus_idx" ON "companies"("leadStatus");

-- CreateIndex
CREATE INDEX "companies_normalizedName_idx" ON "companies"("normalizedName");

-- CreateIndex
CREATE INDEX "companies_companyNumber_idx" ON "companies"("companyNumber");

-- CreateIndex
CREATE INDEX "company_sources_companyId_idx" ON "company_sources"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "company_sources_provider_externalId_key" ON "company_sources"("provider", "externalId");

-- CreateIndex
CREATE INDEX "company_industries_industryKey_idx" ON "company_industries"("industryKey");

-- CreateIndex
CREATE UNIQUE INDEX "company_industries_companyId_industryKey_key" ON "company_industries"("companyId", "industryKey");

-- CreateIndex
CREATE INDEX "websites_domain_idx" ON "websites"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "websites_companyId_domain_key" ON "websites"("companyId", "domain");

-- CreateIndex
CREATE INDEX "website_analysis_websiteId_fetchedAt_idx" ON "website_analysis"("websiteId", "fetchedAt");

-- CreateIndex
CREATE INDEX "social_profiles_companyId_idx" ON "social_profiles"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "social_profiles_companyId_platform_url_key" ON "social_profiles"("companyId", "platform", "url");

-- CreateIndex
CREATE INDEX "business_signals_companyId_idx" ON "business_signals"("companyId");

-- CreateIndex
CREATE INDEX "business_signals_type_idx" ON "business_signals"("type");

-- CreateIndex
CREATE UNIQUE INDEX "business_signals_companyId_type_source_key" ON "business_signals"("companyId", "type", "source");

-- CreateIndex
CREATE INDEX "contacts_companyId_idx" ON "contacts"("companyId");

-- CreateIndex
CREATE INDEX "scores_companyId_computedAt_idx" ON "scores"("companyId", "computedAt");

-- CreateIndex
CREATE INDEX "scores_score_idx" ON "scores"("score");

-- CreateIndex
CREATE INDEX "searches_userId_createdAt_idx" ON "searches"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "search_runs_searchId_createdAt_idx" ON "search_runs"("searchId", "createdAt");

-- CreateIndex
CREATE INDEX "search_runs_status_idx" ON "search_runs"("status");

-- CreateIndex
CREATE INDEX "search_run_results_companyId_idx" ON "search_run_results"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "search_run_results_searchRunId_companyId_key" ON "search_run_results"("searchRunId", "companyId");

-- CreateIndex
CREATE INDEX "outreach_candidates_companyId_generatedAt_idx" ON "outreach_candidates"("companyId", "generatedAt");

-- CreateIndex
CREATE INDEX "outreach_candidates_status_idx" ON "outreach_candidates"("status");

-- CreateIndex
CREATE INDEX "notes_companyId_createdAt_idx" ON "notes"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "job_records_jobId_key" ON "job_records"("jobId");

-- CreateIndex
CREATE INDEX "job_records_queue_status_idx" ON "job_records"("queue", "status");

-- CreateIndex
CREATE INDEX "job_records_createdAt_idx" ON "job_records"("createdAt");

-- CreateIndex
CREATE INDEX "system_logs_level_createdAt_idx" ON "system_logs"("level", "createdAt");

-- CreateIndex
CREATE INDEX "system_logs_event_createdAt_idx" ON "system_logs"("event", "createdAt");

-- CreateIndex
CREATE INDEX "system_logs_companyId_idx" ON "system_logs"("companyId");

-- CreateIndex
CREATE INDEX "api_usage_provider_createdAt_idx" ON "api_usage"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_createdAt_idx" ON "ai_usage"("createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_purpose_createdAt_idx" ON "ai_usage"("purpose", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_sources" ADD CONSTRAINT "company_sources_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_industries" ADD CONSTRAINT "company_industries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "websites" ADD CONSTRAINT "websites_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_analysis" ADD CONSTRAINT "website_analysis_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_profiles" ADD CONSTRAINT "social_profiles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_signals" ADD CONSTRAINT "business_signals_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scores" ADD CONSTRAINT "scores_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "searches" ADD CONSTRAINT "searches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_runs" ADD CONSTRAINT "search_runs_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "searches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_run_results" ADD CONSTRAINT "search_run_results_searchRunId_fkey" FOREIGN KEY ("searchRunId") REFERENCES "search_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_run_results" ADD CONSTRAINT "search_run_results_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_candidates" ADD CONSTRAINT "outreach_candidates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
