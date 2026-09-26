import { describe, expect, it } from 'vitest';
import { extractFacts } from '../analyzer/extract.js';
import { detectSignals } from './detect.js';

const NOW = new Date('2026-09-01T00:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

describe('detectSignals', () => {
  it('records a recent incorporation with the date as evidence', () => {
    const signals = detectSignals({
      companyName: 'Demo Ltd',
      incorporationDate: daysAgo(4),
      now: NOW,
    });
    expect(signals).toHaveLength(1);
    expect(signals[0]!.type).toBe('RECENT_INCORPORATION');
    expect(signals[0]!.evidence).toContain('2026-08-28');
    expect(signals[0]!.confidence).toBe('HIGH');
  });

  it('ignores an incorporation that is no longer recent', () => {
    expect(detectSignals({ companyName: 'Demo Ltd', incorporationDate: daysAgo(400), now: NOW })).toEqual([]);
  });

  it('quotes the page text that triggered a phrase signal', () => {
    const facts = extractFacts(
      '<html><body><h1>Demo</h1><p>We are now open in Manchester, come and visit us.</p></body></html>',
      'https://demo.example.com/',
    );
    const signals = detectSignals({ companyName: 'Demo Ltd', websiteFacts: facts, now: NOW });
    const nowOpen = signals.find((s) => s.type === 'NOW_OPEN');
    expect(nowOpen).toBeDefined();
    expect(nowOpen!.evidence).toContain('now open');
    expect(nowOpen!.evidence).toContain('...');
  });

  it('never invents review or social activity without a date from a source', () => {
    const signals = detectSignals({ companyName: 'Demo Ltd', now: NOW });
    expect(signals.find((s) => s.type === 'RECENT_REVIEWS')).toBeUndefined();
    expect(signals.find((s) => s.type === 'RECENT_SOCIAL_ACTIVITY')).toBeUndefined();
  });

  it('records recent reviews only when the source reports a date', () => {
    const signals = detectSignals({ companyName: 'Demo Ltd', latestReviewAt: daysAgo(3), now: NOW });
    expect(signals.find((s) => s.type === 'RECENT_REVIEWS')).toBeDefined();
    const stale = detectSignals({ companyName: 'Demo Ltd', latestReviewAt: daysAgo(300), now: NOW });
    expect(stale.find((s) => s.type === 'RECENT_REVIEWS')).toBeUndefined();
  });

  it('records an under-construction website with its evidence', () => {
    const signals = detectSignals({
      companyName: 'Demo Ltd',
      underConstruction: true,
      underConstructionEvidence: 'page text contains "coming soon"',
      now: NOW,
    });
    expect(signals[0]!.type).toBe('UNDER_CONSTRUCTION_WEBSITE');
  });

  it('keeps only the strongest signal per type and source', () => {
    const facts = extractFacts(
      '<html><body><p>We are now open. We are open seven days a week.</p></body></html>',
      'https://demo.example.com/',
    );
    const signals = detectSignals({ companyName: 'Demo Ltd', websiteFacts: facts, now: NOW });
    const nowOpenSignals = signals.filter((s) => s.type === 'NOW_OPEN');
    expect(nowOpenSignals).toHaveLength(1);
  });
});
