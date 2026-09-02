import { describe, expect, it } from 'vitest';
import { describeFilters, incorporationWindow, parseFilters } from './filters.js';

const NOW = new Date('2026-09-01T12:00:00Z');

describe('parseFilters', () => {
  it('applies sensible defaults', () => {
    const filters = parseFilters({});
    expect(filters.countryCode).toBe('GB');
    expect(filters.companyAge).toBe('LAST_30_DAYS');
    expect(filters.websiteFilter).toBe('ANY');
    expect(filters.statuses).toEqual(['active']);
    expect(filters.industryKeys).toEqual([]);
  });

  it('rejects an unknown industry key', () => {
    expect(() => parseFilters({ industryKeys: ['not-an-industry'] })).toThrow();
  });

  it('rejects an out-of-range score', () => {
    expect(() => parseFilters({ minScore: 250 })).toThrow();
  });

  it('caps the number of companies a run may process', () => {
    expect(() => parseFilters({ maxCompanies: 99_999 })).toThrow();
  });
});

describe('incorporationWindow', () => {
  it('spans the requested number of days, inclusive of today', () => {
    const window = incorporationWindow({ companyAge: 'LAST_7_DAYS' }, NOW);
    expect(window.from?.toISOString().slice(0, 10)).toBe('2026-08-26');
    expect(window.to?.toISOString().slice(0, 10)).toBe('2026-09-01');
  });

  it('is a single day for TODAY', () => {
    const window = incorporationWindow({ companyAge: 'TODAY' }, NOW);
    expect(window.from?.toISOString()).toBe(window.to?.toISOString());
  });

  it('is unbounded for ANY', () => {
    expect(incorporationWindow({ companyAge: 'ANY' }, NOW)).toEqual({});
  });
});

describe('describeFilters', () => {
  it('summarises a search for the history list', () => {
    const summary = describeFilters(
      parseFilters({ industryKeys: ['dental'], city: 'Manchester', companyAge: 'LAST_30_DAYS', websiteFilter: 'NO_WEBSITE', minScore: 75 }),
    );
    expect(summary).toContain('GB');
    expect(summary).toContain('dental');
    expect(summary).toContain('Manchester');
    expect(summary).toContain('Last 30 days');
    expect(summary).toContain('score 75+');
  });
});
