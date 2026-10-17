import { describe, expect, it } from 'vitest';
import { BRAZIL } from './br.js';
import { UNITED_KINGDOM } from './uk.js';
import { enabledCountries } from './registry.js';

describe('sourceDisclosure', () => {
  it('every enabled country can answer "where did you get my number?"', () => {
    // A country without this leaves the operator improvising at exactly the
    // moment accuracy matters most.
    for (const profile of enabledCountries()) {
      expect(profile.sourceDisclosure.answer.length).toBeGreaterThan(40);
      expect(profile.sourceDisclosure.offer.length).toBeGreaterThan(20);
      expect(() => new URL(profile.sourceDisclosure.verifyUrl)).not.toThrow();
    }
  });

  it('names the register rather than describing it vaguely', () => {
    expect(BRAZIL.sourceDisclosure.answer).toMatch(/Receita Federal/);
    expect(UNITED_KINGDOM.sourceDisclosure.answer).toMatch(/Companies House/);
  });

  it('offers erasure without being asked', () => {
    // The right to object is the prospect's; making them argue for it is both
    // worse for them and worse for the person on the phone.
    expect(BRAZIL.sourceDisclosure.offer).toMatch(/apago/i);
    expect(UNITED_KINGDOM.sourceDisclosure.offer).toMatch(/delete/i);
  });

  it('points at a page the prospect can actually open', () => {
    expect(BRAZIL.sourceDisclosure.verifyUrl).toMatch(/^https:\/\/dados\.gov\.br\//);
    expect(UNITED_KINGDOM.sourceDisclosure.verifyUrl).toMatch(/^https:\/\//);
  });
});
