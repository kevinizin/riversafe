import { describe, expect, it } from 'vitest';
import { buildOutreachFacts } from './facts.js';
import {
  generateOutreachDraft,
  outreachReadiness,
  validatePersonalisation,
} from './message.js';
import { buildPreviewBriefing } from './preview.js';

const NOW = new Date('2026-09-01T00:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const baseFacts = () =>
  buildOutreachFacts({
    companyName: 'Demo Dental Studio Ltd',
    city: 'Manchester',
    incorporationDate: daysAgo(4),
    industryKey: 'dental',
    websiteStatus: 'NO_WEBSITE_FOUND',
    websiteStatusNote: 'no website found after 3 discovery methods',
    socialProfiles: [
      { platform: 'INSTAGRAM', url: 'https://instagram.com/demo', confidence: 'MEDIUM' },
    ],
    reviewCount: 127,
    rating: 4.9,
    now: NOW,
  });

describe('buildOutreachFacts', () => {
  it('gives every fact an evidence string and a source', () => {
    for (const fact of baseFacts()) {
      expect(fact.evidence.length).toBeGreaterThan(0);
      expect(fact.source.length).toBeGreaterThan(0);
    }
  });

  it('phrases a missing website as what we searched, not what the company has', () => {
    const fact = baseFacts().find((f) => f.key === 'no_website_found');
    expect(fact?.statement).toContain('could not find');
    expect(fact?.statement).not.toMatch(/has no website|does not have a website/i);
  });

  it('produces no review fact when no review data is held', () => {
    const facts = buildOutreachFacts({
      companyName: 'Demo Ltd',
      websiteStatus: 'NOT_CHECKED',
      reviewCount: null,
      now: NOW,
    });
    expect(facts.find((f) => f.key === 'reviews')).toBeUndefined();
  });

  it('omits the incorporation fact for a long-established company', () => {
    const facts = buildOutreachFacts({
      companyName: 'Demo Ltd',
      incorporationDate: daysAgo(3000),
      websiteStatus: 'NOT_CHECKED',
      now: NOW,
    });
    expect(facts.find((f) => f.key === 'recent_incorporation')).toBeUndefined();
  });

  it('turns website weaknesses into observations tied to the domain', () => {
    const facts = buildOutreachFacts({
      companyName: 'Demo Ltd',
      websiteStatus: 'WEBSITE_FOUND',
      websiteDomain: 'demo.example.com',
      websiteQualityScore: 30,
      websiteWeaknesses: ['Not built for mobile — no viewport tag'],
      now: NOW,
    });
    const weakness = facts.find((f) => f.key === 'website_weakness_0');
    expect(weakness?.kind).toBe('observation');
    expect(weakness?.sourceUrl).toContain('demo.example.com');
  });
});

describe('generateOutreachDraft', () => {
  it('opens with a real observation and names only used facts', () => {
    const facts = baseFacts();
    const draft = generateOutreachDraft({
      companyName: 'Demo Dental Studio Ltd',
      senderName: 'Alex',
      industryKey: 'dental',
      city: 'Manchester',
      facts,
    });

    expect(draft.blockedReason).toBeUndefined();
    expect(draft.subject).toBe('Quick question about Demo Dental Studio Ltd');
    expect(draft.body).toContain('I noticed');
    expect(draft.usedFacts.length).toBeGreaterThan(0);
    for (const fact of draft.usedFacts) expect(draft.body).toContain(fact.statement);
  });

  it('refuses to write anything when there is no observation to make', () => {
    const contextOnly = baseFacts().filter((f) => f.kind === 'context');
    const draft = generateOutreachDraft({
      companyName: 'Demo Ltd',
      senderName: 'Alex',
      facts: contextOnly,
    });
    expect(draft.body).toBe('');
    expect(draft.blockedReason).toContain('No factual observation');
  });

  it('greets generically when no recipient name is known', () => {
    const draft = generateOutreachDraft({
      companyName: 'Demo Ltd',
      senderName: 'Alex',
      facts: baseFacts(),
    });
    expect(draft.body.startsWith('Hello,')).toBe(true);
  });
});

describe('validatePersonalisation', () => {
  const facts = baseFacts();

  it('accepts a rewrite that stays within the facts', () => {
    const text =
      'Hello, I came across Demo Dental Studio Ltd and noticed you registered it 4 days ago. ' +
      'I could not find a website for Demo Dental Studio Ltd. Would a preview be useful?';
    expect(validatePersonalisation(text, facts, 'Demo Dental Studio Ltd').ok).toBe(true);
  });

  it('rejects an invented URL, email address or number', () => {
    const withUrl = validatePersonalisation(
      'Hello, see https://not-a-real-site.example.org for details, it is a long enough message.',
      facts,
      'Demo Dental Studio Ltd',
    );
    expect(withUrl.ok).toBe(false);

    const withEmail = validatePersonalisation(
      'Hello, please reply to invented@example.org about your new dental practice today.',
      facts,
      'Demo Dental Studio Ltd',
    );
    expect(withEmail.ok).toBe(false);

    const withNumber = validatePersonalisation(
      'Hello, I noticed you have 9999 reviews, which is remarkable for a new practice in Manchester.',
      facts,
      'Demo Dental Studio Ltd',
    );
    expect(withNumber.ok).toBe(false);
  });

  it('rejects a rewrite that is too short to be an email', () => {
    expect(validatePersonalisation('Hi', facts, 'Demo').ok).toBe(false);
  });
});

describe('outreachReadiness', () => {
  it('is ready with a good score, an observation and a contact route', () => {
    expect(
      outreachReadiness({ score: 91, facts: baseFacts(), hasContactRoute: true }).ready,
    ).toBe(true);
  });

  it('explains every reason it is not ready', () => {
    const result = outreachReadiness({ score: 10, facts: [], hasContactRoute: false });
    expect(result.ready).toBe(false);
    expect(result.reasons).toHaveLength(3);
  });
});

describe('buildPreviewBriefing', () => {
  const briefing = buildPreviewBriefing({
    companyName: 'Demo Dental Studio Ltd',
    industryKey: 'dental',
    city: 'Manchester',
    countryName: 'United Kingdom',
    currency: 'GBP',
    language: 'en-GB',
    facts: baseFacts(),
    brandColourHints: ['#1f6feb'],
    brandSourceDomain: 'demo.example.com',
    reviewCount: 127,
    rating: 4.9,
    now: NOW,
  });

  it('labels sector-derived services as suggestions, not as facts', () => {
    expect(briefing.suggestedServices.every((s) => s.status === 'SUGGESTED_FROM_INDUSTRY')).toBe(true);
    expect(briefing.toConfirm.join(' ')).toContain('confirm before showing it');
  });

  it('forbids publishing to the prospect domain', () => {
    expect(briefing.constraints.join(' ')).toMatch(/never publish/i);
  });

  it('flags missing contact details as things to confirm', () => {
    expect(briefing.toConfirm).toEqual(expect.arrayContaining(['A phone number to display']));
  });

  it('says so plainly when there is no review data', () => {
    const noReviews = buildPreviewBriefing({
      companyName: 'Demo Ltd',
      countryName: 'United Kingdom',
      currency: 'GBP',
      language: 'en-GB',
      facts: [],
      reviewCount: null,
      now: NOW,
    });
    const trust = noReviews.sections.find((s) => s.key === 'trust');
    expect(trust?.contentNotes.join(' ')).toContain('rather than inventing any');
  });

  it('marks observed services differently from suggested ones', () => {
    const withObserved = buildPreviewBriefing({
      companyName: 'Demo Ltd',
      industryKey: 'dental',
      countryName: 'United Kingdom',
      currency: 'GBP',
      language: 'en-GB',
      facts: [],
      observedServices: ['Teeth whitening'],
      now: NOW,
    });
    expect(withObserved.suggestedServices[0]).toEqual({
      name: 'Teeth whitening',
      status: 'OBSERVED_ON_WEBSITE',
    });
  });
});
