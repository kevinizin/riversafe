import { describe, expect, it } from 'vitest';
import { dedupeKeys } from './key.js';
import { findDuplicate, type MatchCandidate } from './match.js';
import { nameSimilarity, normaliseCompanyName, normaliseDomain, normalisePhone } from './normalize.js';

describe('normaliseCompanyName', () => {
  it('collapses legal suffix variants onto the same string', () => {
    expect(normaliseCompanyName('DEMO ROOFING CO LTD')).toBe(
      normaliseCompanyName('Demo Roofing Company Limited'),
    );
  });

  it('drops a leading "the" and normalises ampersands', () => {
    expect(normaliseCompanyName('The Smith & Jones Practice Ltd')).toBe('smith and jones practice');
  });

  it('keeps a single-word name intact', () => {
    expect(normaliseCompanyName('Northlight Ltd')).toBe('northlight');
  });

  it('does not strip a suffix that is the only word', () => {
    expect(normaliseCompanyName('Group Ltd')).toBe('group');
  });
});

describe('normalisePhone', () => {
  it('treats +44 and 0 prefixes as the same number', () => {
    expect(normalisePhone('+44 161 496 0000')).toBe(normalisePhone('0161 496 0000'));
  });
  it('rejects strings that are too short to be a phone number', () => {
    expect(normalisePhone('12345')).toBeNull();
  });
});

describe('normaliseDomain', () => {
  it('strips scheme, www and case', () => {
    expect(normaliseDomain('HTTPS://WWW.Example.CO.UK/path')).toBe('example.co.uk');
  });
  it('accepts a bare host', () => {
    expect(normaliseDomain('example.co.uk')).toBe('example.co.uk');
  });
  it('returns null for nonsense', () => {
    expect(normaliseDomain('  ')).toBeNull();
  });
});

describe('dedupeKeys', () => {
  it('prefers the registry number as the primary key', () => {
    const keys = dedupeKeys({
      countryCode: 'GB',
      companyNumber: '12345678',
      name: 'Demo Dental Studio Ltd',
      postcode: 'M1 1AA',
    });
    expect(keys.primary).toBe('GB:reg:12345678');
    expect(keys.postcodeKey).toBe('M11AA');
  });

  it('falls back to the domain, then to name plus postcode', () => {
    expect(dedupeKeys({ countryCode: 'GB', name: 'Demo Ltd', website: 'https://demo.example.com' }).primary)
      .toBe('GB:domain:demo.example.com');
    expect(dedupeKeys({ countryCode: 'GB', name: 'Demo Ltd', postcode: 'M1 1AA' }).primary)
      .toBe('GB:name-postcode:demo:M11AA');
  });
});

describe('findDuplicate', () => {
  const existing: MatchCandidate[] = [
    { id: 'a', companyNumber: '12345678', normalisedName: 'demo roofing', postcodeKey: 'B11AA', domain: null },
    { id: 'b', companyNumber: '87654321', normalisedName: 'other business', postcodeKey: 'LS11AA', domain: 'other.example.com' },
  ];

  it('matches on company number with high confidence', () => {
    const match = findDuplicate({ companyNumber: '12345678', normalisedName: 'completely different' }, existing);
    expect(match?.candidate.id).toBe('a');
    expect(match?.confidence).toBe('HIGH');
  });

  it('matches on domain with high confidence', () => {
    const match = findDuplicate({ normalisedName: 'x', domain: 'other.example.com' }, existing);
    expect(match?.candidate.id).toBe('b');
  });

  it('matches a near-identical name at the same postcode', () => {
    const match = findDuplicate({ normalisedName: 'demo roofing', postcodeKey: 'B11AA' }, existing);
    expect(match?.candidate.id).toBe('a');
  });

  it('refuses to match on name alone when the postcode differs', () => {
    expect(findDuplicate({ normalisedName: 'demo roofing', postcodeKey: 'XX11XX' }, existing)).toBeNull();
  });

  it('returns null when nothing matches', () => {
    expect(findDuplicate({ normalisedName: 'unrelated business' }, existing)).toBeNull();
  });
});

describe('nameSimilarity', () => {
  it('is 1 for identical token sets and 0 for disjoint ones', () => {
    expect(nameSimilarity('demo roofing', 'demo roofing')).toBe(1);
    expect(nameSimilarity('demo roofing', 'acme plumbing')).toBe(0);
  });
});
