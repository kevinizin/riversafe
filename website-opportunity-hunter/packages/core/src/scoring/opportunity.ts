import type {
  BusinessActivitySignal,
  Classification,
  CompanyStatus,
  Confidence,
  SocialPlatform,
  WebsiteStatus,
} from '../domain/types.js';
import { commercialWeightOf } from '../industry/classify.js';
import { getIndustry } from '../industry/taxonomy.js';
import {
  CLASSIFICATION_EMOJI,
  CLASSIFICATION_LABEL,
  COMPONENT_MAX,
  CONFIDENCE_FACTOR,
  DEFAULT_THRESHOLDS,
  RECENCY_BANDS,
  SIGNAL_POINTS,
  type ClassificationThresholds,
  type ComponentKey,
  classifyScore,
} from './config.js';

export interface ScoreComponent {
  component: ComponentKey;
  points: number;
  max: number;
  /** Why these points were awarded, in the operator's language. */
  reason: string;
}

export interface OpportunityScore {
  score: number;
  classification: Classification;
  confidence: Confidence;
  /** Signed one-liners, e.g. "+28 Incorporated 4 days ago". */
  reasons: string[];
  components: ScoreComponent[];
  /** Facts we could not establish, and which therefore capped the confidence. */
  gaps: string[];
  /** Activity signal types that contributed. */
  signals: string[];
}

export interface ScoreInput {
  now?: Date;
  companyStatus: CompanyStatus;
  incorporationDate?: Date | null | undefined;

  websiteStatus: WebsiteStatus;
  websiteStatusConfidence?: Confidence | null | undefined;
  /** 0–100 from the website analyzer. Undefined when no site was analysed. */
  websiteQualityScore?: number | null | undefined;
  websiteUnderConstruction?: boolean;
  /** True when a website exists but could not be fetched. */
  websiteUnreachable?: boolean;

  socialProfiles?: { platform: SocialPlatform; confidence: Confidence }[];
  reviewCount?: number | null | undefined;
  rating?: number | null | undefined;

  industryKey?: string | null | undefined;
  industryConfidence?: Confidence | null | undefined;

  signals?: BusinessActivitySignal[];

  thresholds?: ClassificationThresholds;
}

const DAY_MS = 86_400_000;

/**
 * The Website Opportunity Score: how good a moment this is for the business to
 * buy a website, on a 0–100 scale.
 *
 * The design constraint is explainability. Every point is attributable to a
 * named component with a sentence the operator can read out loud on a call, and
 * `gaps` records what we could not establish rather than quietly scoring it as
 * zero. A company that is dissolved or in liquidation is capped and classified
 * IGNORE regardless of how attractive the rest of the profile looks.
 */
export function calculateOpportunityScore(input: ScoreInput): OpportunityScore {
  const now = input.now ?? new Date();
  const thresholds = input.thresholds ?? DEFAULT_THRESHOLDS;
  const gaps: string[] = [];
  const components: ScoreComponent[] = [];

  components.push(scoreRecency(input, now, gaps));
  components.push(scoreWebsiteComponent(input, gaps));
  components.push(scoreDigitalPresence(input, gaps));
  components.push(scoreCommercialPotential(input, gaps));
  const activity = scoreActivity(input);
  components.push(activity.component);

  let total = components.reduce((sum, c) => sum + c.points, 0);
  total = Math.max(0, Math.min(100, Math.round(total)));

  const inactive = input.companyStatus !== 'ACTIVE' && input.companyStatus !== 'UNKNOWN';
  let classification: Classification;
  if (inactive) {
    total = Math.min(total, 20);
    classification = 'IGNORE';
    components.push({
      component: 'COMMERCIAL_POTENTIAL',
      points: 0,
      max: 0,
      reason: `Company status is ${input.companyStatus.toLowerCase()}, so the lead is capped and ignored`,
    });
  } else {
    classification = classifyScore(total, thresholds);
  }

  const confidence = scoreConfidence(input, gaps);

  const reasons = components
    .filter((c) => c.max > 0)
    .sort((a, b) => b.points - a.points)
    .map((c) => `${c.points > 0 ? '+' : ''}${c.points} ${c.reason}`);

  return {
    score: total,
    classification,
    confidence,
    reasons,
    components,
    gaps,
    signals: activity.usedSignals,
  };
}

function scoreRecency(input: ScoreInput, now: Date, gaps: string[]): ScoreComponent {
  const max = COMPONENT_MAX.RECENCY;
  if (!input.incorporationDate) {
    gaps.push('Incorporation date unknown');
    return { component: 'RECENCY', points: 0, max, reason: 'Incorporation date unknown' };
  }
  const ageDays = Math.floor((now.getTime() - input.incorporationDate.getTime()) / DAY_MS);
  if (ageDays < 0) {
    return { component: 'RECENCY', points: 0, max, reason: 'Incorporation date is in the future; ignored' };
  }
  const band = RECENCY_BANDS.find((b) => ageDays <= b.maxDays);
  if (!band) {
    return {
      component: 'RECENCY',
      points: 0,
      max,
      reason: `Established business (incorporated ${Math.floor(ageDays / 365)} year(s) ago)`,
    };
  }
  return {
    component: 'RECENCY',
    points: band.points,
    max,
    reason: `Incorporated ${ageDays} day(s) ago — ${band.label}`,
  };
}

function scoreWebsiteComponent(input: ScoreInput, gaps: string[]): ScoreComponent {
  const max = COMPONENT_MAX.WEBSITE;
  const mk = (points: number, reason: string): ScoreComponent => ({ component: 'WEBSITE', points, max, reason });

  switch (input.websiteStatus) {
    case 'NO_WEBSITE_FOUND':
      // Full marks regardless of the discovery confidence. Website discovery
      // deliberately caps "not found" at MEDIUM (absence of evidence is not
      // evidence of absence); that uncertainty belongs in the score's own
      // `confidence` field, not in shaved points, or the top band becomes
      // unreachable for exactly the leads it exists to surface.
      return mk(30, 'No website found after the permitted discovery methods — the clearest opening there is');
    case 'WEBSITE_UNCERTAIN':
      gaps.push('Website status is uncertain and needs a human check');
      return mk(15, 'Website status uncertain — a possible site was found but could not be confirmed');
    case 'NOT_CHECKED':
      gaps.push('Website discovery has not run for this company');
      return mk(0, 'Website not checked yet');
    case 'WEBSITE_FOUND': {
      if (input.websiteUnderConstruction) {
        return mk(26, 'Website is a placeholder or under construction');
      }
      if (input.websiteUnreachable) {
        gaps.push('The website was found but did not load, so its quality is unknown');
        return mk(18, 'Website found but it did not load when we checked');
      }
      const quality = input.websiteQualityScore;
      if (quality === null || quality === undefined) {
        gaps.push('Website found but not yet analysed');
        return mk(0, 'Website found; quality not analysed yet');
      }
      if (quality < 35) return mk(20, `Website scores ${quality}/100 — weak on the basics`);
      if (quality < 55) return mk(14, `Website scores ${quality}/100 — noticeable gaps`);
      if (quality < 75) return mk(7, `Website scores ${quality}/100 — decent but improvable`);
      return mk(0, `Website scores ${quality}/100 — already strong`);
    }
  }
}

function scoreDigitalPresence(input: ScoreInput, gaps: string[]): ScoreComponent {
  const max = COMPONENT_MAX.DIGITAL_PRESENCE;
  const profiles = input.socialProfiles ?? [];
  const parts: string[] = [];
  let points = 0;

  const socialPlatforms = [...new Set(profiles.filter((p) => p.platform !== 'GOOGLE_BUSINESS').map((p) => p.platform))];
  if (socialPlatforms.length > 0) {
    const best = profiles.find((p) => p.platform === socialPlatforms[0]);
    const first = best?.confidence === 'HIGH' ? 5 : 3;
    const extra = Math.min((socialPlatforms.length - 1) * 2, 7 - first);
    points += first + Math.max(0, extra);
    parts.push(`active on ${socialPlatforms.map(platformLabel).join(' and ')}`);
  }

  if (profiles.some((p) => p.platform === 'GOOGLE_BUSINESS')) {
    points += 4;
    parts.push('has a Google Business listing');
  }

  const reviews = input.reviewCount;
  if (reviews === null || reviews === undefined) {
    gaps.push('Review count unknown (no places provider configured)');
  } else if (reviews >= 100) {
    points += 4;
    parts.push(`${reviews} reviews`);
  } else if (reviews >= 25) {
    points += 3;
    parts.push(`${reviews} reviews`);
  } else if (reviews >= 5) {
    points += 2;
    parts.push(`${reviews} reviews`);
  } else if (reviews >= 1) {
    points += 1;
    parts.push(`${reviews} review(s)`);
  }

  points = Math.min(points, max);
  return {
    component: 'DIGITAL_PRESENCE',
    points,
    max,
    reason: parts.length ? `Digital presence: ${parts.join(', ')}` : 'No social or listing presence found',
  };
}

function scoreCommercialPotential(input: ScoreInput, gaps: string[]): ScoreComponent {
  const max = COMPONENT_MAX.COMMERCIAL_POTENTIAL;
  const parts: string[] = [];
  let points = 0;

  if (!input.industryKey) {
    gaps.push('Industry not identified');
  } else {
    const weight = commercialWeightOf(input.industryKey);
    const profile = getIndustry(input.industryKey);
    const industryPoints = Math.round(weight * 9);
    points += industryPoints;
    parts.push(`${profile?.label ?? input.industryKey} is a ${weight >= 0.85 ? 'high' : weight >= 0.7 ? 'good' : 'moderate'}-value sector for a website`);
    if (profile?.highTicket) {
      points += 2;
      parts.push('high-ticket services');
    }
  }

  const reviews = input.reviewCount ?? 0;
  if (reviews >= 50) {
    points += 2;
    parts.push(`proven demand (${reviews} reviews)`);
  }
  if (input.rating !== null && input.rating !== undefined && input.rating >= 4.5 && reviews >= 10) {
    points += 2;
    parts.push(`${input.rating.toFixed(1)}★ average rating`);
  }

  points = Math.min(points, max);
  return {
    component: 'COMMERCIAL_POTENTIAL',
    points,
    max,
    reason: parts.length ? `Commercial potential: ${parts.join(', ')}` : 'Commercial potential unknown',
  };
}

function scoreActivity(input: ScoreInput): { component: ScoreComponent; usedSignals: string[] } {
  const max = COMPONENT_MAX.BUSINESS_ACTIVITY;
  const signals = input.signals ?? [];
  const used: string[] = [];
  let raw = 0;

  for (const signal of signals) {
    const base = SIGNAL_POINTS[signal.type] ?? 0;
    if (base === 0) continue;
    raw += base * CONFIDENCE_FACTOR[signal.confidence];
    used.push(signal.type);
  }

  const points = Math.min(Math.round(raw), max);
  return {
    component: {
      component: 'BUSINESS_ACTIVITY',
      points,
      max,
      reason: used.length
        ? `Recent activity signals: ${used.map(signalLabel).join(', ')}`
        : 'No recent activity signals detected',
    },
    usedSignals: used,
  };
}

function scoreConfidence(input: ScoreInput, gaps: string[]): Confidence {
  if (input.websiteStatus === 'NOT_CHECKED') return 'LOW';
  if (gaps.length === 0) return 'HIGH';
  if (gaps.length <= 2) return 'MEDIUM';
  return 'LOW';
}

export function platformLabel(platform: SocialPlatform): string {
  switch (platform) {
    case 'INSTAGRAM': return 'Instagram';
    case 'FACEBOOK': return 'Facebook';
    case 'LINKEDIN': return 'LinkedIn';
    case 'X': return 'X';
    case 'TIKTOK': return 'TikTok';
    case 'YOUTUBE': return 'YouTube';
    case 'GOOGLE_BUSINESS': return 'Google Business';
  }
}

export function signalLabel(type: string): string {
  return type.toLowerCase().replace(/_/g, ' ');
}

export { CLASSIFICATION_EMOJI, CLASSIFICATION_LABEL, DEFAULT_THRESHOLDS };
export type { ClassificationThresholds };
