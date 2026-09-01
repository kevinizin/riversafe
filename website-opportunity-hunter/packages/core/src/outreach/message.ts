import { getIndustry, industryLabel } from '../industry/taxonomy.js';
import type { OutreachFact } from './facts.js';

export * from './facts.js';

export interface OutreachDraft {
  subject: string;
  body: string;
  /** The facts the draft actually used, for the operator to check. */
  usedFacts: OutreachFact[];
  /** Why the draft could not be produced, when it could not. */
  blockedReason?: string;
}

export interface DraftOptions {
  companyName: string;
  /** Only ever a role or a name the operator has typed. Never guessed. */
  recipientName?: string | null;
  senderName: string;
  senderBusiness?: string;
  industryKey?: string | null;
  city?: string | null;
  facts: OutreachFact[];
}

/**
 * Composes a first-contact email from established facts.
 *
 * The template has exactly one slot for an observation, and it is filled from
 * `facts`. When there is no observation fact, the function refuses to produce a
 * draft rather than reaching for a generic flattery line — a message that says
 * something untrue is worse than no message.
 *
 * Nothing here sends anything. The output is a draft for a human to read, edit
 * and send themselves.
 */
export function generateOutreachDraft(options: DraftOptions): OutreachDraft {
  const observations = options.facts
    .filter((f) => f.kind === 'observation')
    .sort((a, b) => rank(b.confidence) - rank(a.confidence));

  if (observations.length === 0) {
    return {
      subject: '',
      body: '',
      usedFacts: [],
      blockedReason:
        'No factual observation has been established for this company yet. Run enrichment first — the template will not invent one.',
    };
  }

  const industry = options.industryKey ? industryLabel(options.industryKey).toLowerCase() : 'local';
  const location = options.city ? ` in ${options.city}` : '';
  const greeting = options.recipientName ? `Hi ${options.recipientName},` : 'Hello,';

  const primary = observations[0]!;
  const secondary = observations[1];
  const used = [primary, ...(secondary ? [secondary] : [])];

  const noticed = secondary
    ? `I noticed ${primary.statement}, and ${secondary.statement}.`
    : `I noticed ${primary.statement}.`;

  const subject = `Quick question about ${options.companyName}`;
  const signature = options.senderBusiness
    ? `${options.senderName}\n${options.senderBusiness}`
    : options.senderName;

  const body = [
    greeting,
    '',
    `I came across ${options.companyName} while looking at recently established ${industry} businesses${location}.`,
    '',
    noticed,
    '',
    `I build websites for ${industry} businesses, and I have put together an idea of what a site for ${options.companyName} could look like.`,
    '',
    'Would you like me to send you the preview?',
    '',
    'Best regards,',
    signature,
  ].join('\n');

  return { subject, body, usedFacts: used };
}

/** Whether a lead has enough behind it to be worth preparing outreach for. */
export interface ReadinessInput {
  score?: number | null;
  minScore?: number;
  facts: OutreachFact[];
  hasContactRoute: boolean;
}

export interface Readiness {
  ready: boolean;
  reasons: string[];
}

export function outreachReadiness(input: ReadinessInput): Readiness {
  const reasons: string[] = [];
  const minScore = input.minScore ?? 60;

  if ((input.score ?? 0) < minScore) reasons.push(`opportunity score is below ${minScore}`);
  if (!input.facts.some((f) => f.kind === 'observation')) {
    reasons.push('no factual observation to open the message with');
  }
  if (!input.hasContactRoute) {
    reasons.push('no business contact route recorded yet (add one on the company page)');
  }

  return { ready: reasons.length === 0, reasons };
}

/**
 * System prompt used when AI personalisation is enabled. It is deliberately
 * restrictive: the model may rephrase, never add.
 */
export function personalisationSystemPrompt(): string {
  return [
    'You rewrite a short B2B email so it reads naturally and specifically.',
    'You are given a list of ALLOWED FACTS. You may only make statements that are',
    'supported by those facts. Do not add any claim, number, name, service, price,',
    'compliment or observation that is not in the list. Do not invent URLs or',
    'email addresses. Keep it under 130 words, keep the structure, keep it plain,',
    'and do not use exclamation marks. Return only the email body.',
  ].join(' ');
}

/**
 * Guard for AI output. Rejects a rewrite that introduces contact details or
 * numbers the facts do not support, so a model cannot smuggle a claim in.
 */
export function validatePersonalisation(
  rewritten: string,
  facts: OutreachFact[],
  companyName: string,
): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  const allowed = `${facts.map((f) => `${f.statement} ${f.evidence}`).join(' ')} ${companyName}`.toLowerCase();

  for (const url of rewritten.match(/https?:\/\/\S+/gi) ?? []) {
    if (!allowed.includes(url.toLowerCase().replace(/[.,)]+$/, ''))) {
      problems.push(`introduced a URL that is not in the facts: ${url}`);
    }
  }
  for (const email of rewritten.match(/[\w.+-]+@[\w.-]+\.\w{2,}/g) ?? []) {
    if (!allowed.includes(email.toLowerCase())) {
      problems.push(`introduced an email address that is not in the facts: ${email}`);
    }
  }
  for (const number of rewritten.match(/\b\d{2,}\b/g) ?? []) {
    if (!allowed.includes(number)) {
      problems.push(`introduced the number ${number}, which no fact supports`);
    }
  }
  if (rewritten.trim().length < 40) problems.push('the rewrite is too short to be a usable email');
  if (rewritten.split(/\s+/).length > 200) problems.push('the rewrite is longer than the brief allows');

  return { ok: problems.length === 0, problems };
}

/** Sections a demo homepage should contain for the industry, when known. */
export function sectionsForIndustry(industryKey: string | null | undefined): string[] {
  const profile = industryKey ? getIndustry(industryKey) : undefined;
  return profile?.typicalServices ?? ['Services', 'About', 'Reviews', 'Contact'];
}

const rank = (c: OutreachFact['confidence']): number => (c === 'HIGH' ? 2 : c === 'MEDIUM' ? 1 : 0);
