import type { BusinessActivitySignal, Confidence } from '../domain/types.js';
import type { PageFacts } from '../analyzer/extract.js';

export interface SignalInput {
  companyName: string;
  incorporationDate?: Date | undefined;
  /** Registry record URL, used as the evidence link for incorporation. */
  registryUrl?: string | undefined;
  websiteFacts?: PageFacts | undefined;
  websiteUrl?: string | undefined;
  underConstruction?: boolean;
  underConstructionEvidence?: string | undefined;
  /** Only supplied when a provider reports an actual review date. */
  latestReviewAt?: Date | undefined;
  /** Only supplied when a provider reports an actual post date. */
  latestSocialPostAt?: Date | undefined;
  socialSourceUrl?: string | undefined;
  now?: Date;
}

/** Wording that indicates a business is opening, has just opened, or is hiring. */
const PHRASE_SIGNALS: { type: BusinessActivitySignal['type']; phrases: string[] }[] = [
  { type: 'OPENING_SOON', phrases: ['opening soon', 'opening in', 'we open on'] },
  { type: 'NOW_OPEN', phrases: ['now open', 'we are open', "we're now open"] },
  { type: 'GRAND_OPENING', phrases: ['grand opening', 'launch party', 'official opening'] },
  { type: 'NEW_BUSINESS', phrases: ['newly established', 'new business', 'recently founded', 'we launched in'] },
  { type: 'NEW_LOCATION', phrases: ['new location', 'our new branch', 'second location', 'new premises'] },
  { type: 'COMING_SOON', phrases: ['coming soon', 'watch this space'] },
  { type: 'HIRING', phrases: ['we are hiring', "we're hiring", 'join our team', 'current vacancies', 'now recruiting'] },
];

const RECENT_INCORPORATION_DAYS = 90;
const RECENT_ACTIVITY_DAYS = 60;

const daysBetween = (a: Date, b: Date): number => Math.floor((a.getTime() - b.getTime()) / 86_400_000);

/**
 * Turns observations into business-activity signals.
 *
 * Every signal quotes the thing that produced it. Where a fact is not available
 * — for example, when no provider tells us when the last review was written —
 * no signal is emitted at all. A missing signal is correct; an invented one is
 * not.
 */
export function detectSignals(input: SignalInput): BusinessActivitySignal[] {
  const now = input.now ?? new Date();
  const signals: BusinessActivitySignal[] = [];

  if (input.incorporationDate) {
    const age = daysBetween(now, input.incorporationDate);
    if (age >= 0 && age <= RECENT_INCORPORATION_DAYS) {
      signals.push({
        type: 'RECENT_INCORPORATION',
        source: 'company_registry',
        ...(input.registryUrl ? { sourceUrl: input.registryUrl } : {}),
        detectedAt: now,
        occurredAt: input.incorporationDate,
        confidence: 'HIGH',
        evidence: `incorporated on ${input.incorporationDate.toISOString().slice(0, 10)} (${age} day(s) ago)`,
      });
    }
  }

  if (input.websiteFacts) {
    const text = input.websiteFacts.text.toLowerCase();
    for (const group of PHRASE_SIGNALS) {
      const phrase = group.phrases.find((p) => text.includes(p));
      if (!phrase) continue;
      signals.push({
        type: group.type,
        source: `website:${input.websiteFacts.domain ?? 'homepage'}`,
        ...(input.websiteUrl ? { sourceUrl: input.websiteUrl } : {}),
        detectedAt: now,
        confidence: 'MEDIUM',
        evidence: `homepage text contains "${phrase}": ${excerptAround(input.websiteFacts.text, phrase)}`,
      });
    }
  }

  if (input.underConstruction && input.underConstructionEvidence) {
    signals.push({
      type: 'UNDER_CONSTRUCTION_WEBSITE',
      source: `website:${input.websiteFacts?.domain ?? 'homepage'}`,
      ...(input.websiteUrl ? { sourceUrl: input.websiteUrl } : {}),
      detectedAt: now,
      confidence: 'HIGH',
      evidence: input.underConstructionEvidence,
    });
  }

  if (input.latestReviewAt && daysBetween(now, input.latestReviewAt) <= RECENT_ACTIVITY_DAYS) {
    signals.push({
      type: 'RECENT_REVIEWS',
      source: 'places_provider',
      detectedAt: now,
      occurredAt: input.latestReviewAt,
      confidence: 'HIGH',
      evidence: `most recent review dated ${input.latestReviewAt.toISOString().slice(0, 10)}`,
    });
  }

  if (input.latestSocialPostAt && daysBetween(now, input.latestSocialPostAt) <= RECENT_ACTIVITY_DAYS) {
    signals.push({
      type: 'RECENT_SOCIAL_ACTIVITY',
      source: 'social_profile',
      ...(input.socialSourceUrl ? { sourceUrl: input.socialSourceUrl } : {}),
      detectedAt: now,
      occurredAt: input.latestSocialPostAt,
      confidence: 'MEDIUM',
      evidence: `most recent public post dated ${input.latestSocialPostAt.toISOString().slice(0, 10)}`,
    });
  }

  return dedupeSignals(signals);
}

function dedupeSignals(signals: BusinessActivitySignal[]): BusinessActivitySignal[] {
  const rank: Record<Confidence, number> = { HIGH: 2, MEDIUM: 1, LOW: 0 };
  const best = new Map<string, BusinessActivitySignal>();
  for (const s of signals) {
    const key = `${s.type}:${s.source}`;
    const existing = best.get(key);
    if (!existing || rank[s.confidence] > rank[existing.confidence]) best.set(key, s);
  }
  return [...best.values()];
}

function excerptAround(text: string, phrase: string, radius = 60): string {
  const index = text.toLowerCase().indexOf(phrase);
  if (index === -1) return '';
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + phrase.length + radius);
  return `"...${text.slice(start, end).trim()}..."`;
}
