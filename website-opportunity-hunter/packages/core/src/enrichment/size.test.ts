import { describe, expect, it } from 'vitest';
import type { Evidence } from '../domain/types.js';
import {
  DEFAULT_SYSTEM_TARGET,
  describeSize,
  estimateSizeFromAccounts,
  estimateSizeFromPorte,
  fitsEmployeeTarget,
} from './size.js';

const evidence: Evidence = {
  source: 'receita_federal',
  detectedAt: new Date('2026-09-01T00:00:00Z'),
};

describe('estimateSizeFromPorte', () => {
  it('reads EPP as the small band and never claims a headcount', () => {
    const result = estimateSizeFromPorte('03', 120_000, evidence);
    expect(result?.value.band).toBe('SMALL');
    expect(result?.value.employeesFrom).toBe(10);
    expect(result?.value.employeesTo).toBe(49);
    // The whole point: derived, not read.
    expect(result?.inferred).toBe(true);
    expect(result?.confidence).not.toBe('HIGH');
    expect(result?.value.basis.join(' ')).toContain('estimate');
  });

  it('reads ME as micro', () => {
    const result = estimateSizeFromPorte('01', undefined, evidence);
    expect(result?.value.band).toBe('MICRO');
    expect(result?.value.employeesTo).toBe(9);
  });

  it('leaves "demais" open-ended and low confidence, because the band has no ceiling', () => {
    const result = estimateSizeFromPorte('05', undefined, evidence);
    expect(result?.value.band).toBe('MEDIUM');
    expect(result?.value.employeesTo).toBeUndefined();
    expect(result?.confidence).toBe('LOW');
  });

  it('returns nothing when the porte is absent or not stated', () => {
    expect(estimateSizeFromPorte(undefined, 50_000, evidence)).toBeUndefined();
    expect(estimateSizeFromPorte('00', 50_000, evidence)).toBeUndefined();
    expect(estimateSizeFromPorte('99', undefined, evidence)).toBeUndefined();
  });

  it('accepts an unpadded porte, as CSV loads often produce', () => {
    expect(estimateSizeFromPorte('1', undefined, evidence)?.value.band).toBe('MICRO');
  });

  it('lets a symbolic capital lower confidence without changing the band', () => {
    const result = estimateSizeFromPorte('03', 1_000, evidence);
    expect(result?.value.band).toBe('SMALL');
    expect(result?.confidence).toBe('LOW');
  });

  it('treats a missing capital as no evidence, not as evidence of smallness', () => {
    const withCapital = estimateSizeFromPorte('03', 500_000, evidence);
    const without = estimateSizeFromPorte('03', undefined, evidence);
    expect(without?.value.band).toBe(withCapital?.value.band);
    expect(without?.confidence).toBe('MEDIUM');
    expect(without?.value.basis.join(' ')).toContain('not stated');
  });
});

describe('estimateSizeFromAccounts', () => {
  it('maps a micro-entity filing to the micro band', () => {
    const result = estimateSizeFromAccounts('micro-entity', evidence);
    expect(result?.value.band).toBe('MICRO');
    expect(result?.value.employeesTo).toBe(10);
  });

  it('warns that a small filing qualifies on two of three tests', () => {
    const result = estimateSizeFromAccounts('small', evidence);
    expect(result?.value.band).toBe('SMALL');
    expect(result?.value.basis.join(' ')).toContain('two of three');
  });

  it('says nothing about size for filings that only describe the filing', () => {
    for (const type of ['dormant', 'initial', 'interim', 'group', 'no-accounts-filed', 'null']) {
      expect(estimateSizeFromAccounts(type, evidence)).toBeUndefined();
    }
    expect(estimateSizeFromAccounts(undefined, evidence)).toBeUndefined();
  });
});

describe('fitsEmployeeTarget', () => {
  const target = DEFAULT_SYSTEM_TARGET; // 10 to 15

  it('rules out a micro company, the one thing the evidence can rule out', () => {
    const micro = estimateSizeFromPorte('01', undefined, evidence);
    expect(fitsEmployeeTarget(micro?.value, target)).toBe('UNLIKELY');
  });

  it('calls EPP possible rather than likely, because 10-49 is not 10-15', () => {
    const epp = estimateSizeFromPorte('03', undefined, evidence);
    expect(fitsEmployeeTarget(epp?.value, target)).toBe('POSSIBLE');
  });

  it('reports UNKNOWN rather than a guess when there is no estimate', () => {
    expect(fitsEmployeeTarget(undefined, target)).toBe('UNKNOWN');
  });

  it('only says LIKELY when the whole plausible range sits inside the target', () => {
    expect(fitsEmployeeTarget({ band: 'SMALL', employeesFrom: 11, employeesTo: 14, basis: [] }, target)).toBe(
      'LIKELY',
    );
  });

  it('treats an open-ended range as never fully inside the target', () => {
    expect(fitsEmployeeTarget({ band: 'MEDIUM', employeesFrom: 12, basis: [] }, target)).toBe('POSSIBLE');
  });
});

describe('describeSize', () => {
  it('always says the number is an estimate', () => {
    const epp = estimateSizeFromPorte('03', undefined, evidence);
    expect(describeSize(epp?.value)).toBe('Small · estimated 10–49 people');
  });

  it('marks an open-ended band with a plus rather than inventing a ceiling', () => {
    expect(describeSize({ band: 'LARGE', employeesFrom: 50, basis: [] })).toBe('Large · estimated 50+ people');
  });

  it('says unknown when nothing is known', () => {
    expect(describeSize(undefined)).toBe('Size unknown');
  });
});
