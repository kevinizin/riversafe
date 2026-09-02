import type { Confidence } from '../domain/types.js';
import { industryLabel } from '../industry/taxonomy.js';
import { platformLabel } from '../scoring/opportunity.js';

/**
 * A single thing the outreach message is permitted to say.
 *
 * The generator may only assemble statements from this list. That is the entire
 * mechanism preventing invented observations: if a claim is not backed by a row
 * in the database, there is no fact for it, and the template has nothing to put
 * in the sentence.
 */
export interface OutreachFact {
  key: string;
  /** The clause as it may appear in a message, in the second person. */
  statement: string;
  /** What in our data supports it. Shown to the operator before sending. */
  evidence: string;
  source: string;
  sourceUrl?: string;
  confidence: Confidence;
  /** Observation facts can fill the "I noticed ..." line; context facts cannot. */
  kind: 'observation' | 'context';
}

export interface FactInput {
  companyName: string;
  city?: string | null;
  incorporationDate?: Date | null;
  registryUrl?: string | null;
  industryKey?: string | null;
  websiteStatus: string;
  websiteStatusNote?: string | null;
  websiteDomain?: string | null;
  websiteQualityScore?: number | null;
  websiteWeaknesses?: string[];
  socialProfiles?: { platform: string; url: string; confidence: Confidence }[];
  reviewCount?: number | null;
  rating?: number | null;
  signals?: { type: string; evidence: string; confidence: Confidence; sourceUrl?: string | null }[];
  now?: Date;
}

const DAY_MS = 86_400_000;

export function buildOutreachFacts(input: FactInput): OutreachFact[] {
  const now = input.now ?? new Date();
  const facts: OutreachFact[] = [];

  if (input.incorporationDate) {
    const days = Math.floor((now.getTime() - input.incorporationDate.getTime()) / DAY_MS);
    if (days >= 0 && days <= 120) {
      facts.push({
        key: 'recent_incorporation',
        statement: `you registered ${input.companyName} ${days <= 1 ? 'this week' : `${days} days ago`}`,
        evidence: `Companies House records an incorporation date of ${input.incorporationDate.toISOString().slice(0, 10)}`,
        source: 'companies_house',
        ...(input.registryUrl ? { sourceUrl: input.registryUrl } : {}),
        confidence: 'HIGH',
        kind: 'observation',
      });
    }
  }

  if (input.websiteStatus === 'NO_WEBSITE_FOUND') {
    facts.push({
      key: 'no_website_found',
      // Phrased as what we did, not as a claim about what the business has.
      statement: `I could not find a website for ${input.companyName}`,
      evidence: input.websiteStatusNote ?? 'no website found by any permitted discovery method',
      source: 'website_discovery',
      confidence: 'MEDIUM',
      kind: 'observation',
    });
  }

  if (input.websiteStatus === 'WEBSITE_FOUND' && input.websiteDomain) {
    if (typeof input.websiteQualityScore === 'number') {
      facts.push({
        key: 'website_score',
        statement: `I had a look at ${input.websiteDomain}`,
        evidence: `automated check scored the homepage ${input.websiteQualityScore}/100`,
        source: `website:${input.websiteDomain}`,
        sourceUrl: `https://${input.websiteDomain}`,
        confidence: 'HIGH',
        kind: 'context',
      });
    }
    for (const [index, weakness] of (input.websiteWeaknesses ?? []).slice(0, 3).entries()) {
      facts.push({
        key: `website_weakness_${index}`,
        statement: lowerFirst(weakness),
        evidence: `homepage analysis of ${input.websiteDomain}`,
        source: `website:${input.websiteDomain}`,
        sourceUrl: `https://${input.websiteDomain}`,
        confidence: 'HIGH',
        kind: 'observation',
      });
    }
  }

  for (const profile of input.socialProfiles ?? []) {
    if (profile.platform === 'GOOGLE_BUSINESS') continue;
    facts.push({
      key: `social_${profile.platform.toLowerCase()}`,
      statement: `you are on ${platformLabel(profile.platform as never)}`,
      evidence: `profile found at ${profile.url}`,
      source: 'social_discovery',
      sourceUrl: profile.url,
      confidence: profile.confidence,
      kind: 'observation',
    });
  }

  if (typeof input.reviewCount === 'number' && input.reviewCount > 0) {
    const rating = typeof input.rating === 'number' ? ` at ${input.rating.toFixed(1)} stars` : '';
    facts.push({
      key: 'reviews',
      statement: `you have ${input.reviewCount} reviews${rating}`,
      evidence: `business listing reports ${input.reviewCount} ratings${rating}`,
      source: 'places_provider',
      confidence: 'HIGH',
      kind: 'observation',
    });
  }

  for (const signal of input.signals ?? []) {
    if (signal.type === 'RECENT_INCORPORATION') continue;
    const statement = SIGNAL_STATEMENTS[signal.type];
    if (!statement) continue;
    facts.push({
      key: `signal_${signal.type.toLowerCase()}`,
      statement,
      evidence: signal.evidence,
      source: 'activity_signals',
      ...(signal.sourceUrl ? { sourceUrl: signal.sourceUrl } : {}),
      confidence: signal.confidence,
      kind: 'observation',
    });
  }

  if (input.industryKey) {
    facts.push({
      key: 'industry',
      statement: `you work in ${industryLabel(input.industryKey).toLowerCase()}`,
      evidence: 'classified from the registered SIC code and the company name',
      source: 'industry_classification',
      confidence: 'MEDIUM',
      kind: 'context',
    });
  }

  if (input.city) {
    facts.push({
      key: 'location',
      statement: `you are based in ${input.city}`,
      evidence: 'registered office address',
      source: 'companies_house',
      confidence: 'HIGH',
      kind: 'context',
    });
  }

  return facts;
}

const SIGNAL_STATEMENTS: Record<string, string> = {
  NOW_OPEN: 'your site says you have just opened',
  GRAND_OPENING: 'your site mentions a grand opening',
  OPENING_SOON: 'your site says you are opening soon',
  COMING_SOON: 'your site currently says "coming soon"',
  NEW_LOCATION: 'your site mentions a new location',
  NEW_BUSINESS: 'your site describes the business as newly established',
  UNDER_CONSTRUCTION_WEBSITE: 'your website is still a placeholder page',
  HIRING: 'you are advertising vacancies',
  RECENT_REVIEWS: 'you have picked up reviews recently',
  RECENT_SOCIAL_ACTIVITY: 'you have been posting recently',
};

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}
