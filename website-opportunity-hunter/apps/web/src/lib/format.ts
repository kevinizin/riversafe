import type { Classification, Confidence } from '@woh/core';

export function daysAgo(date: Date | null | undefined, now = new Date()): number | null {
  if (!date) return null;
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000);
}

export function relativeDays(date: Date | null | undefined): string {
  const days = daysAgo(date);
  if (days === null) return 'Desconhecido';
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `há ${months} ${months === 1 ? 'mês' : 'meses'}`;
  }
  const years = Math.floor(days / 365);
  return `há ${years} ${years === 1 ? 'ano' : 'anos'}`;
}

// America/Manaus rather than the browser's zone: a date that reads differently
// on the operator's laptop and on a colleague's is worse than one that is
// consistently wrong by an hour, and every company in this database trades here.
const TIMEZONE = 'America/Manaus';

export function formatDate(date: Date | null | undefined): string {
  if (!date) return 'Desconhecida';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: TIMEZONE,
  }).format(date);
}

export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: TIMEZONE,
  }).format(date);
}

export const CLASSIFICATION_STYLE: Record<Classification, { label: string; emoji: string; className: string }> = {
  HOT: { label: 'Quente', emoji: '🔥', className: 'bg-red-50 text-red-700 border-red-200' },
  HIGH_OPPORTUNITY: { label: 'Alta oportunidade', emoji: '🟠', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  WARM: { label: 'Morno', emoji: '🟡', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  LOW_PRIORITY: { label: 'Baixa prioridade', emoji: '🔵', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  IGNORE: { label: 'Descartar', emoji: '⚪', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export const CONFIDENCE_STYLE: Record<Confidence, string> = {
  HIGH: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  MEDIUM: 'bg-amber-50 text-amber-800 border-amber-200',
  LOW: 'bg-slate-100 text-slate-600 border-slate-200',
};

/**
 * Website status wording.
 *
 * These strings are deliberate: the product never asserts that a company "has
 * no website", only that we did not find one. See PRIVACY.md and SCORING.md.
 */
export const WEBSITE_STATUS_LABEL: Record<string, string> = {
  NOT_CHECKED: 'Ainda não verificado',
  NO_WEBSITE_FOUND: 'Site não encontrado',
  WEBSITE_UNCERTAIN: 'Site possível — não confirmado',
  WEBSITE_FOUND: 'Site encontrado',
};

export const LEAD_STATUS_LABEL: Record<string, string> = {
  NEW: 'Novo',
  QUALIFIED: 'Qualificado',
  PREVIEW_CREATED: 'Prévia criada',
  CONTACT_READY: 'Pronto para contato',
  CONTACTED: 'Contatado',
  REPLIED: 'Respondeu',
  INTERESTED: 'Interessado',
  DEMO: 'Demonstração',
  PROPOSAL: 'Proposta',
  WON: 'Ganho',
  LOST: 'Perdido',
  DISCARDED: 'Descartado',
};

export const CRM_PIPELINE: string[] = [
  'NEW',
  'QUALIFIED',
  'PREVIEW_CREATED',
  'CONTACT_READY',
  'CONTACTED',
  'REPLIED',
  'INTERESTED',
  'DEMO',
  'PROPOSAL',
  'WON',
  'LOST',
];

export function scoreColour(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'text-slate-400';
  if (score >= 90) return 'text-red-600';
  if (score >= 75) return 'text-orange-600';
  if (score >= 60) return 'text-amber-600';
  if (score >= 40) return 'text-blue-600';
  return 'text-slate-500';
}

/**
 * Portuguese plurals are irregular often enough that guessing is wrong more
 * than it is right — "mês" becomes "meses", not "mêss". So the plural form is
 * always passed in rather than derived by appending an "s".
 */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
