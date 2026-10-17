import type { Classification } from '../domain/types.js';

/** Maximum points each component may contribute. They sum to 100. */
export const COMPONENT_MAX = {
  RECENCY: 30,
  WEBSITE: 30,
  DIGITAL_PRESENCE: 15,
  COMMERCIAL_POTENTIAL: 15,
  BUSINESS_ACTIVITY: 10,
} as const;

export type ComponentKey = keyof typeof COMPONENT_MAX;

export interface ClassificationThresholds {
  HOT: number;
  HIGH_OPPORTUNITY: number;
  WARM: number;
  LOW_PRIORITY: number;
}

export const DEFAULT_THRESHOLDS: ClassificationThresholds = {
  HOT: 90,
  HIGH_OPPORTUNITY: 75,
  WARM: 60,
  LOW_PRIORITY: 40,
};

export function classifyScore(score: number, thresholds: ClassificationThresholds = DEFAULT_THRESHOLDS): Classification {
  if (score >= thresholds.HOT) return 'HOT';
  if (score >= thresholds.HIGH_OPPORTUNITY) return 'HIGH_OPPORTUNITY';
  if (score >= thresholds.WARM) return 'WARM';
  if (score >= thresholds.LOW_PRIORITY) return 'LOW_PRIORITY';
  return 'IGNORE';
}

export const CLASSIFICATION_LABEL: Record<Classification, string> = {
  HOT: 'Quente',
  HIGH_OPPORTUNITY: 'Alta oportunidade',
  WARM: 'Morno',
  LOW_PRIORITY: 'Baixa prioridade',
  IGNORE: 'Descartar',
};

export const CLASSIFICATION_EMOJI: Record<Classification, string> = {
  HOT: '🔥',
  HIGH_OPPORTUNITY: '🟠',
  WARM: '🟡',
  LOW_PRIORITY: '🔵',
  IGNORE: '⚪',
};

/** Recency bands, most recent first. Points are the RECENCY component. */
export const RECENCY_BANDS: { maxDays: number; points: number; label: string }[] = [
  { maxDays: 7, points: 30, label: 'aberta na última semana' },
  { maxDays: 14, points: 28, label: 'aberta nas últimas duas semanas' },
  { maxDays: 30, points: 24, label: 'aberta no último mês' },
  { maxDays: 60, points: 18, label: 'aberta nos últimos dois meses' },
  { maxDays: 90, points: 12, label: 'aberta nos últimos três meses' },
  { maxDays: 180, points: 6, label: 'aberta nos últimos seis meses' },
  { maxDays: 365, points: 3, label: 'aberta no último ano' },
];

/** Points per activity-signal type. Recent incorporation is excluded because
 *  the RECENCY component already accounts for it. */
export const SIGNAL_POINTS: Record<string, number> = {
  NOW_OPEN: 4,
  GRAND_OPENING: 4,
  OPENING_SOON: 3,
  COMING_SOON: 3,
  NEW_LOCATION: 3,
  RECENT_REVIEWS: 3,
  RECENT_SOCIAL_ACTIVITY: 3,
  UNDER_CONSTRUCTION_WEBSITE: 3,
  NEW_BUSINESS: 2,
  RECENTLY_REGISTERED_DOMAIN: 2,
  HIRING: 2,
  RECENT_INCORPORATION: 0,
};

export const CONFIDENCE_FACTOR = { HIGH: 1, MEDIUM: 0.7, LOW: 0.4 } as const;
