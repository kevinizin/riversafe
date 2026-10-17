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
  /**
   * What to offer. The two axes want opposite openings, and offering a website
   * to a four-year-old practice that scored 86 for a system wastes the one
   * chance the message gets. Defaults to the website pitch.
   */
  axis?: 'WEBSITE' | 'SYSTEM';
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
        'Nenhuma observação factual foi estabelecida para esta empresa ainda. Rode o enriquecimento primeiro — o modelo não vai inventar uma.',
    };
  }

  const industry = options.industryKey ? industryLabel(options.industryKey).toLowerCase() : 'empresas locais';
  const location = options.city ? ` em ${options.city}` : '';
  const greeting = options.recipientName ? `Olá, ${options.recipientName},` : 'Olá,';

  const primary = observations[0]!;
  const secondary = observations[1];
  const used = [primary, ...(secondary ? [secondary] : [])];

  const noticed = secondary
    ? `Reparei que ${primary.statement}, e que ${secondary.statement}.`
    : `Reparei que ${primary.statement}.`;

  const system = options.axis === 'SYSTEM';

  const found = system
    ? `Encontrei a ${options.companyName} enquanto olhava empresas de ${industry}${location}.`
    : `Encontrei a ${options.companyName} enquanto olhava empresas de ${industry}${location} abertas recentemente.`;

  const offer = system
    ? `Eu desenvolvo sistemas de gestão para empresas de ${industry} — o tipo de coisa que organiza ordens de serviço, prazos e o que está com quem.`
    : `Eu faço sites para empresas de ${industry}, e montei uma ideia de como um site da ${options.companyName} poderia ficar.`;

  const ask = system
    ? 'Faria sentido conversarmos quinze minutos para eu entender como vocês controlam isso hoje?'
    : 'Quer que eu envie a prévia?';

  const subject = system
    ? `Uma pergunta sobre a operação da ${options.companyName}`
    : `Uma pergunta rápida sobre a ${options.companyName}`;

  const signature = options.senderBusiness
    ? `${options.senderName}\n${options.senderBusiness}`
    : options.senderName;

  const body = [
    greeting,
    '',
    found,
    '',
    noticed,
    '',
    offer,
    '',
    ask,
    '',
    'Abraço,',
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

  if ((input.score ?? 0) < minScore) reasons.push(`o score de oportunidade está abaixo de ${minScore}`);
  if (!input.facts.some((f) => f.kind === 'observation')) {
    reasons.push('não há observação factual para abrir a mensagem');
  }
  if (!input.hasContactRoute) {
    reasons.push('nenhum canal de contato comercial registrado ainda (adicione um na página da empresa)');
  }

  return { ready: reasons.length === 0, reasons };
}

/**
 * System prompt used when AI personalisation is enabled. It is deliberately
 * restrictive: the model may rephrase, never add.
 */
export function personalisationSystemPrompt(): string {
  return [
    'You rewrite a short B2B email, in BRAZILIAN PORTUGUESE, so it reads naturally',
    'and specifically. The output must be in Portuguese regardless of the language',
    'of these instructions.',
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
      problems.push(`introduziu uma URL que não está nos fatos: ${url}`);
    }
  }
  for (const email of rewritten.match(/[\w.+-]+@[\w.-]+\.\w{2,}/g) ?? []) {
    if (!allowed.includes(email.toLowerCase())) {
      problems.push(`introduziu um e-mail que não está nos fatos: ${email}`);
    }
  }
  for (const number of rewritten.match(/\b\d{2,}\b/g) ?? []) {
    if (!allowed.includes(number)) {
      problems.push(`introduziu o número ${number}, que nenhum fato sustenta`);
    }
  }
  if (rewritten.trim().length < 40) problems.push('a reescrita é curta demais para ser um e-mail utilizável');
  if (rewritten.split(/\s+/).length > 200) problems.push('a reescrita é mais longa do que o briefing permite');

  return { ok: problems.length === 0, problems };
}

/** Sections a demo homepage should contain for the industry, when known. */
export function sectionsForIndustry(industryKey: string | null | undefined): string[] {
  const profile = industryKey ? getIndustry(industryKey) : undefined;
  return profile?.typicalServices ?? ['Serviços', 'Sobre', 'Avaliações', 'Contato'];
}

const rank = (c: OutreachFact['confidence']): number => (c === 'HIGH' ? 2 : c === 'MEDIUM' ? 1 : 0);
