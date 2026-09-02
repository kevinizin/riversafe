import { describe, expect, it } from 'vitest';
import { classify, needsAiFallback, primaryIndustry } from './classify.js';
import { INDUSTRIES, registryCodesFor } from './taxonomy.js';

describe('classify', () => {
  it('matches a dental practice from its SIC code with high confidence', () => {
    const matches = classify({ countryCode: 'GB', name: 'DEMO DENTAL STUDIO LTD', sicCodes: ['86230'] });
    const primary = primaryIndustry(matches);
    expect(primary?.industryKey).toBe('dental');
    expect(primary?.confidence).toBe('HIGH');
    expect(primary?.evidence).toContain('86230');
  });

  it('downgrades a SIC code that several sectors share', () => {
    const matches = classify({ countryCode: 'GB', name: 'DEMO SERVICES LTD', sicCodes: ['43220'] });
    const plumbing = matches.find((m) => m.industryKey === 'plumbing');
    expect(plumbing?.confidence).toBe('MEDIUM');
  });

  it('uses the name to break a shared-code tie', () => {
    const matches = classify({ countryCode: 'GB', name: 'DEMO BOILER & HEATING LTD', sicCodes: ['43220'] });
    expect(primaryIndustry(matches)?.industryKey).toBe('heating_hvac');
    expect(primaryIndustry(matches)?.confidence).toBe('HIGH');
  });

  it('honours negative keywords', () => {
    const matches = classify({ countryCode: 'GB', name: 'DEMO DENTAL SUPPLIES LTD', sicCodes: [] });
    expect(matches.find((m) => m.industryKey === 'dental')).toBeUndefined();
  });

  it('identifies a sub-industry when the wording supports it', () => {
    const matches = classify({
      countryCode: 'GB',
      name: 'DEMO SMILE LTD',
      sicCodes: ['86230'],
      text: 'We offer dental implants and cosmetic veneers',
    });
    expect(primaryIndustry(matches)?.subIndustryKey).toBeDefined();
  });

  it('returns nothing and asks for a fallback when there is no evidence', () => {
    const matches = classify({ countryCode: 'GB', name: 'DEMO HOLDINGS LTD', sicCodes: ['99999'] });
    expect(matches).toHaveLength(0);
    expect(needsAiFallback(matches)).toBe(true);
  });
});

describe('taxonomy', () => {
  it('has unique keys and non-empty UK codes or keywords', () => {
    const keys = INDUSTRIES.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const industry of INDUSTRIES) {
      expect(industry.keywords.length).toBeGreaterThan(0);
      expect((industry.registryCodes.GB ?? []).length).toBeGreaterThan(0);
      expect(industry.commercialWeight).toBeGreaterThan(0);
      expect(industry.commercialWeight).toBeLessThanOrEqual(1);
    }
  });

  it('collects registry codes across several industries without duplicates', () => {
    const codes = registryCodesFor(['plumbing', 'heating_hvac'], 'GB');
    expect(codes).toEqual(['43220']);
  });

  it('returns an empty list for a country with no codes', () => {
    expect(registryCodesFor(['dental'], 'DE')).toEqual([]);
  });
});
