import type { CountryCode, Confidence } from '../domain/types.js';

export interface SubIndustry {
  key: string;
  label: string;
  keywords: string[];
}

export interface IndustryProfile {
  key: string;
  label: string;
  group: string;

  /**
   * Registry classification codes per country. UK values are SIC 2007 codes
   * taken from the Companies House condensed SIC list. Adding a country means
   * adding a key here (e.g. `DE` with WZ 2008 codes) — never rewriting callers.
   */
  registryCodes: Partial<Record<CountryCode, string[]>>;

  /** Matched against the company name and website text. */
  keywords: string[];
  /** Presence of any of these vetoes a keyword match. */
  negativeKeywords: string[];

  subIndustries: SubIndustry[];

  /**
   * 0..1. How much a good website is typically worth to this kind of business —
   * a mix of average ticket size and how much of the buying journey happens
   * online. Feeds the commercial-potential component of the opportunity score.
   */
  commercialWeight: number;
  highTicket: boolean;

  /** Whether an online booking flow is a reasonable expectation for the sector.
   *  Only sectors flagged here can be marked down for lacking booking. */
  bookingExpected: boolean;

  /** Section prompts for the demo-homepage briefing. These are suggestions for
   *  the operator to confirm — never recorded as services the company offers. */
  typicalServices: string[];
}

export interface IndustryMatch {
  industryKey: string;
  subIndustryKey?: string;
  method: 'SIC_CODE' | 'KEYWORD' | 'AI_CLASSIFIER' | 'MANUAL';
  confidence: Confidence;
  evidence: string;
}
