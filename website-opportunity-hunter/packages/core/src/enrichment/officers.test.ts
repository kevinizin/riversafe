import { describe, expect, it } from 'vitest';
import type { OfficerRecord } from '../providers/companies/types.js';
import { greetingName, roleLabel, selectDecisionMaker } from './officers.js';

const INCORPORATED = new Date('2026-08-28T00:00:00Z');

const officer = (over: Partial<OfficerRecord> = {}): OfficerRecord => ({
  role: 'director',
  appointedOn: INCORPORATED,
  isCorporate: false,
  isActive: true,
  ...over,
});

describe('selectDecisionMaker', () => {
  it('prefers a director over a company secretary', () => {
    const result = selectDecisionMaker(
      [officer({ role: 'secretary' }), officer({ role: 'director' })],
      INCORPORATED,
    );
    expect(result.best?.officer.role).toBe('director');
    expect(result.best?.roleLabel).toBe('Director');
  });

  it('breaks a tie on the earliest appointment', () => {
    const later = new Date('2026-08-31T00:00:00Z');
    const result = selectDecisionMaker(
      [officer({ appointedOn: later }), officer({ appointedOn: INCORPORATED })],
      INCORPORATED,
    );
    expect(result.best?.officer.appointedOn).toEqual(INCORPORATED);
  });

  it('marks an officer appointed at incorporation as a likely founder', () => {
    const result = selectDecisionMaker([officer()], INCORPORATED);
    expect(result.best?.likelyFounder).toBe(true);
    expect(result.best?.reason).toContain('likely a founder');
  });

  it('does not call a late appointment a founder', () => {
    const result = selectDecisionMaker(
      [officer({ appointedOn: new Date('2027-06-01T00:00:00Z') })],
      INCORPORATED,
    );
    expect(result.best?.likelyFounder).toBe(false);
  });

  it('excludes corporate officers and says why when none are left', () => {
    const result = selectDecisionMaker([officer({ isCorporate: true })], INCORPORATED);
    expect(result.best).toBeUndefined();
    expect(result.note).toContain('another company');
    expect(result.activeDecisionMakers).toBe(0);
  });

  it('excludes resigned appointments', () => {
    const result = selectDecisionMaker([officer({ isActive: false })], INCORPORATED);
    expect(result.best).toBeUndefined();
    expect(result.note).toContain('resigned');
  });

  it('notes when there is a single active officer', () => {
    const result = selectDecisionMaker([officer()], INCORPORATED);
    expect(result.best?.reason).toContain('only active officer');
    expect(result.others).toHaveLength(0);
  });

  it('reports an empty register plainly', () => {
    const result = selectDecisionMaker([], INCORPORATED);
    expect(result.note).toContain('no officers');
  });

  it('carries no name when the deployment did not collect one', () => {
    const result = selectDecisionMaker([officer()], INCORPORATED);
    expect(result.best?.officer.name).toBeUndefined();
  });
});

describe('greetingName', () => {
  it('reorders the registry "SURNAME, Forename" format', () => {
    expect(greetingName('DEMO, Alex')).toBe('Alex');
    expect(greetingName('SMITH, Jane Elizabeth')).toBe('Jane');
  });

  it('handles a plain "Forename Surname" string', () => {
    expect(greetingName('Alex Demo')).toBe('Alex');
  });

  it('returns null when no name was collected', () => {
    expect(greetingName(null)).toBeNull();
    expect(greetingName(undefined)).toBeNull();
    expect(greetingName('   ')).toBeNull();
  });

  it('strips titles-only punctuation without producing an empty greeting', () => {
    expect(greetingName("O'BRIEN, Sean")).toBe('Sean');
  });
});

describe('roleLabel', () => {
  it('humanises a known role and falls back gracefully', () => {
    expect(roleLabel('llp-designated-member')).toBe('Designated member');
    expect(roleLabel('some-new-role')).toBe('Some new role');
  });
});
