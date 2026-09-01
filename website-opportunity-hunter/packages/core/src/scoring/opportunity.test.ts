import { describe, expect, it } from 'vitest';
import type { BusinessActivitySignal } from '../domain/types.js';
import { calculateOpportunityScore, type ScoreInput } from './opportunity.js';
import { COMPONENT_MAX } from './config.js';

const NOW = new Date('2026-09-01T00:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const base: ScoreInput = {
  now: NOW,
  companyStatus: 'ACTIVE',
  websiteStatus: 'NOT_CHECKED',
};

const signal = (
  type: BusinessActivitySignal['type'],
  confidence: BusinessActivitySignal['confidence'] = 'HIGH',
): BusinessActivitySignal => ({
  type,
  source: 'test',
  detectedAt: NOW,
  confidence,
  evidence: 'test evidence',
});

describe('calculateOpportunityScore', () => {
  it('scores a brand-new company with no website as HOT', () => {
    const result = calculateOpportunityScore({
      ...base,
      incorporationDate: daysAgo(4),
      websiteStatus: 'NO_WEBSITE_FOUND',
      websiteStatusConfidence: 'MEDIUM',
      socialProfiles: [
        { platform: 'INSTAGRAM', confidence: 'HIGH' },
        { platform: 'GOOGLE_BUSINESS', confidence: 'HIGH' },
      ],
      reviewCount: 127,
      rating: 4.9,
      industryKey: 'dental',
      industryConfidence: 'HIGH',
      signals: [signal('RECENT_INCORPORATION'), signal('NOW_OPEN')],
    });

    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.classification).toBe('HOT');
    expect(result.reasons.join(' ')).toContain('No website found');
  });

  it('scores an established company with a strong website as IGNORE', () => {
    const result = calculateOpportunityScore({
      ...base,
      incorporationDate: daysAgo(3000),
      websiteStatus: 'WEBSITE_FOUND',
      websiteQualityScore: 88,
      socialProfiles: [{ platform: 'INSTAGRAM', confidence: 'HIGH' }],
      reviewCount: 500,
      rating: 4.8,
      industryKey: 'dental',
      industryConfidence: 'HIGH',
    });

    expect(result.score).toBeLessThan(40);
    expect(result.classification).toBe('IGNORE');
  });

  it('treats an old company with a weak website and high ticket as an opportunity', () => {
    const result = calculateOpportunityScore({
      ...base,
      incorporationDate: daysAgo(2000),
      websiteStatus: 'WEBSITE_FOUND',
      websiteQualityScore: 22,
      socialProfiles: [{ platform: 'FACEBOOK', confidence: 'HIGH' }],
      reviewCount: 500,
      rating: 4.7,
      industryKey: 'heating_hvac',
      industryConfidence: 'HIGH',
    });

    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(result.classification).not.toBe('IGNORE');
    expect(result.reasons.join(' ')).toContain('22/100');
  });

  it('never awards website points for a company that has not been checked', () => {
    const result = calculateOpportunityScore({ ...base, incorporationDate: daysAgo(2) });
    const website = result.components.find((c) => c.component === 'WEBSITE');
    expect(website?.points).toBe(0);
    expect(result.confidence).toBe('LOW');
    expect(result.gaps).toContain('Website discovery has not run for this company');
  });

  it('caps and ignores dissolved companies however attractive they look', () => {
    const result = calculateOpportunityScore({
      ...base,
      companyStatus: 'DISSOLVED',
      incorporationDate: daysAgo(3),
      websiteStatus: 'NO_WEBSITE_FOUND',
      websiteStatusConfidence: 'MEDIUM',
      industryKey: 'dental',
    });
    expect(result.classification).toBe('IGNORE');
    expect(result.score).toBeLessThanOrEqual(20);
  });

  it('keeps the total within 0..100 for a maximal input', () => {
    const result = calculateOpportunityScore({
      ...base,
      incorporationDate: daysAgo(1),
      websiteStatus: 'NO_WEBSITE_FOUND',
      websiteStatusConfidence: 'HIGH',
      socialProfiles: [
        { platform: 'INSTAGRAM', confidence: 'HIGH' },
        { platform: 'FACEBOOK', confidence: 'HIGH' },
        { platform: 'TIKTOK', confidence: 'HIGH' },
        { platform: 'GOOGLE_BUSINESS', confidence: 'HIGH' },
      ],
      reviewCount: 900,
      rating: 5,
      industryKey: 'dental',
      signals: [
        signal('NOW_OPEN'),
        signal('GRAND_OPENING'),
        signal('NEW_LOCATION'),
        signal('RECENT_REVIEWS'),
        signal('HIRING'),
      ],
    });
    expect(result.score).toBeLessThanOrEqual(100);
    for (const component of result.components) {
      if (component.max > 0) expect(component.points).toBeLessThanOrEqual(component.max);
    }
  });

  it('discounts low-confidence activity signals', () => {
    const high = calculateOpportunityScore({ ...base, signals: [signal('NOW_OPEN', 'HIGH')] });
    const low = calculateOpportunityScore({ ...base, signals: [signal('NOW_OPEN', 'LOW')] });
    const points = (r: typeof high) => r.components.find((c) => c.component === 'BUSINESS_ACTIVITY')!.points;
    expect(points(high)).toBeGreaterThan(points(low));
  });

  it('does not double-count recent incorporation as an activity signal', () => {
    const withSignal = calculateOpportunityScore({
      ...base,
      incorporationDate: daysAgo(3),
      signals: [signal('RECENT_INCORPORATION')],
    });
    const without = calculateOpportunityScore({ ...base, incorporationDate: daysAgo(3) });
    expect(withSignal.score).toBe(without.score);
  });

  it('records a gap instead of scoring zero when the industry is unknown', () => {
    const result = calculateOpportunityScore({ ...base, websiteStatus: 'NO_WEBSITE_FOUND' });
    expect(result.gaps).toContain('Industry not identified');
    expect(result.confidence).not.toBe('HIGH');
  });

  it('component maximums sum to 100', () => {
    const total = Object.values(COMPONENT_MAX).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });
});
