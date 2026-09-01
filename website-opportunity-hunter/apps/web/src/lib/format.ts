import type { Classification, Confidence } from '@woh/core';

export function daysAgo(date: Date | null | undefined, now = new Date()): number | null {
  if (!date) return null;
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000);
}

export function relativeDays(date: Date | null | undefined): string {
  const days = daysAgo(date);
  if (days === null) return 'Unknown';
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} month${days >= 60 ? 's' : ''} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) return 'Unknown';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/London',
  }).format(date);
}

export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  }).format(date);
}

export const CLASSIFICATION_STYLE: Record<Classification, { label: string; emoji: string; className: string }> = {
  HOT: { label: 'Hot', emoji: '🔥', className: 'bg-red-50 text-red-700 border-red-200' },
  HIGH_OPPORTUNITY: { label: 'High opportunity', emoji: '🟠', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  WARM: { label: 'Warm', emoji: '🟡', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  LOW_PRIORITY: { label: 'Low priority', emoji: '🔵', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  IGNORE: { label: 'Ignore', emoji: '⚪', className: 'bg-slate-100 text-slate-600 border-slate-200' },
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
  NOT_CHECKED: 'Not checked yet',
  NO_WEBSITE_FOUND: 'Website not found',
  WEBSITE_UNCERTAIN: 'Possible website — unconfirmed',
  WEBSITE_FOUND: 'Website found',
};

export const LEAD_STATUS_LABEL: Record<string, string> = {
  NEW: 'New',
  QUALIFIED: 'Qualified',
  PREVIEW_CREATED: 'Preview created',
  CONTACT_READY: 'Contact ready',
  CONTACTED: 'Contacted',
  REPLIED: 'Replied',
  INTERESTED: 'Interested',
  DEMO: 'Demo',
  PROPOSAL: 'Proposal',
  WON: 'Won',
  LOST: 'Lost',
  DISCARDED: 'Discarded',
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

export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}
