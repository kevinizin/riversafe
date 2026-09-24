import { describe, expect, it } from 'vitest';
import type { Evidence } from '../domain/types.js';
import { estimateSizeFromPorte } from '../enrichment/size.js';
import { calculateOpportunityScore } from './opportunity.js';
import { SYSTEM_COMPONENT_MAX, calculateSystemScore, type SystemScoreInput } from './system.js';

const evidence: Evidence = { source: 'receita_federal', detectedAt: new Date('2026-09-01T00:00:00Z') };
const NOW = new Date('2026-09-24T00:00:00Z');

function yearsAgo(years: number): Date {
  return new Date(NOW.getTime() - years * 365 * 86_400_000);
}

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 86_400_000);
}

/** An EPP architecture practice, three years old — the operator's stated target. */
function targetLead(overrides: Partial<SystemScoreInput> = {}): SystemScoreInput {
  return {
    now: NOW,
    companyStatus: 'ACTIVE',
    incorporationDate: yearsAgo(3),
    industryKey: 'architecture',
    industryConfidence: 'HIGH',
    sizeEstimate: estimateSizeFromPorte('03', 150_000, evidence)?.value,
    websiteAnalysed: true,
    websitePassedChecks: ['https', 'title'],
    ...overrides,
  };
}

describe('calculateSystemScore', () => {
  it('components sum to exactly 100', () => {
    const total = Object.values(SYSTEM_COMPONENT_MAX).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });

  it('puts the top band within reach of the best lead the open data can produce', () => {
    // The point of this test: Brazilian registry data can never confirm a
    // headcount, so if an EPP could not reach HOT, the band would be dead for
    // the one market this tool is aimed at.
    const score = calculateSystemScore(
      targetLead({
        locationCount: 2,
        signals: [
          {
            type: 'HIRING',
            source: 'website:example.com.br',
            detectedAt: NOW,
            confidence: 'MEDIUM',
            evidence: 'página "Trabalhe conosco" com duas vagas abertas',
          },
        ],
      }),
    );
    expect(score.score).toBeGreaterThanOrEqual(90);
    expect(score.classification).toBe('HOT');
  });

  it('never claims more than MEDIUM confidence, because the size is always an estimate', () => {
    const score = calculateSystemScore(targetLead());
    expect(score.confidence).not.toBe('HIGH');
  });

  it('always records that internal system use is unknowable from public sources', () => {
    const score = calculateSystemScore(targetLead({ noWebsiteFound: true, websiteAnalysed: false }));
    expect(score.gaps.join(' ')).toContain('sistema interno');
  });

  it('scores a company under a year old at zero for maturity', () => {
    const score = calculateSystemScore(targetLead({ incorporationDate: daysAgo(45) }));
    const maturity = score.components.find((c) => c.component === 'MATURITY');
    expect(maturity?.points).toBe(0);
    expect(maturity?.reason).toContain('cedo demais');
  });

  it('rules out a micro company on size without zeroing an unknown one', () => {
    const micro = calculateSystemScore(
      targetLead({ sizeEstimate: estimateSizeFromPorte('01', undefined, evidence)?.value }),
    );
    const unknown = calculateSystemScore(targetLead({ sizeEstimate: undefined }));
    const pointsFor = (s: typeof micro) => s.components.find((c) => c.component === 'SIZE_FIT')?.points ?? -1;

    expect(micro.sizeFit).toBe('UNLIKELY');
    expect(pointsFor(micro)).toBe(0);
    expect(unknown.sizeFit).toBe('UNKNOWN');
    // Not knowing must rank above knowing it is the wrong size.
    expect(pointsFor(unknown)).toBeGreaterThan(pointsFor(micro));
  });

  it('scores a cafe far below an architecture practice on sector fit alone', () => {
    const cafe = calculateSystemScore(targetLead({ industryKey: 'cafe' }));
    const architects = calculateSystemScore(targetLead());
    expect(cafe.score).toBeLessThan(architects.score);
  });

  it('gives an unidentified sector nothing and says so, rather than assuming an average', () => {
    const score = calculateSystemScore(targetLead({ industryKey: null }));
    expect(score.components.find((c) => c.component === 'SECTOR_FIT')?.points).toBe(0);
    expect(score.gaps.join(' ')).toContain('Setor não identificado');
    expect(score.useCases).toEqual([]);
  });

  it('carries the sector use cases through for the pitch', () => {
    const score = calculateSystemScore(targetLead({ industryKey: 'training_courses' }));
    expect(score.useCases.join(' ')).toContain('Alunos');
  });

  it('caps and ignores a company that is not trading', () => {
    const score = calculateSystemScore(targetLead({ companyStatus: 'DISSOLVED' }));
    expect(score.classification).toBe('IGNORE');
    expect(score.score).toBeLessThanOrEqual(20);
  });

  it('treats an existing booking system as evidence against the gap, not for it', () => {
    const withBooking = calculateSystemScore(targetLead({ websitePassedChecks: ['booking'] }));
    const without = calculateSystemScore(targetLead({ websitePassedChecks: [] }));
    const gapOf = (s: typeof withBooking) => s.components.find((c) => c.component === 'SYSTEM_GAP')?.points ?? -1;
    expect(gapOf(withBooking)).toBeLessThan(gapOf(without));
  });

  it('keeps every reason signed and attributable', () => {
    const score = calculateSystemScore(targetLead());
    for (const reason of score.reasons) {
      expect(reason).toMatch(/^[+]?-?\d+ \S/);
    }
  });
});

describe('the two axes disagree, which is the point', () => {
  const brandNewNoSite = {
    now: NOW,
    companyStatus: 'ACTIVE' as const,
    incorporationDate: daysAgo(10),
    industryKey: 'architecture',
    industryConfidence: 'HIGH' as const,
  };

  it('rates a ten-day-old company high for a website and low for a system', () => {
    const website = calculateOpportunityScore({
      ...brandNewNoSite,
      websiteStatus: 'NO_WEBSITE_FOUND',
      websiteStatusConfidence: 'MEDIUM',
    });
    const system = calculateSystemScore({ ...brandNewNoSite, noWebsiteFound: true });

    expect(website.score).toBeGreaterThan(system.score);
    expect(system.components.find((c) => c.component === 'MATURITY')?.points).toBe(0);
  });

  it('rates a five-year-old company with a decent site the other way round', () => {
    const established = {
      now: NOW,
      companyStatus: 'ACTIVE' as const,
      incorporationDate: yearsAgo(5),
      industryKey: 'architecture',
      industryConfidence: 'HIGH' as const,
    };
    const website = calculateOpportunityScore({
      ...established,
      websiteStatus: 'WEBSITE_FOUND',
      websiteQualityScore: 78,
    });
    const system = calculateSystemScore({
      ...established,
      sizeEstimate: estimateSizeFromPorte('03', 200_000, evidence)?.value,
      websiteAnalysed: true,
      websitePassedChecks: ['https', 'title', 'responsive'],
    });

    expect(system.score).toBeGreaterThan(website.score);
  });
});
