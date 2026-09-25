import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Classification, Confidence } from '@woh/core';
import { CLASSIFICATION_STYLE, CONFIDENCE_STYLE, scoreColour } from '@/lib/format';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card p-4 ${className}`}>{children}</div>;
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{children}</h2>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-slate-500">{hint}</div> : null}
    </>
  );
  return href ? (
    <Link href={href} className="card block p-4 transition-colors hover:border-brand hover:bg-slate-50">
      {body}
    </Link>
  ) : (
    <div className="card p-4">{body}</div>
  );
}

export function ClassificationBadge({ value }: { value: Classification | null | undefined }) {
  if (!value) return <span className="chip border border-slate-200 bg-slate-100 text-slate-500">Sem pontuação</span>;
  const style = CLASSIFICATION_STYLE[value];
  return (
    <span className={`chip border ${style.className}`}>
      <span aria-hidden>{style.emoji}</span>
      {style.label}
    </span>
  );
}

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  HIGH: 'alta',
  MEDIUM: 'média',
  LOW: 'baixa',
};

export function ConfidenceBadge({ value, prefix = 'Confiança' }: { value: Confidence | null | undefined; prefix?: string }) {
  if (!value) return null;
  return (
    <span
      className={`chip border ${CONFIDENCE_STYLE[value]}`}
      title="O quanto temos certeza disto, dadas as fontes usadas"
    >
      {prefix}: {CONFIDENCE_LABEL[value]}
    </span>
  );
}

export function ScoreDial({ score }: { score: number | null | undefined }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-3xl font-bold tabular-nums ${scoreColour(score)}`}>
        {score ?? '—'}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-slate-400">de 100</span>
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 p-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="max-w-md text-sm text-slate-500">{body}</p>
      {action}
    </div>
  );
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn' | 'error';
  children: ReactNode;
}) {
  const tones = {
    info: 'border-blue-200 bg-blue-50 text-blue-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-red-200 bg-red-50 text-red-900',
  } as const;
  return <div className={`rounded-md border px-3 py-2 text-sm ${tones[tone]}`}>{children}</div>;
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100 py-2 last:border-0 sm:flex-row sm:items-baseline sm:gap-3">
      <dt className="w-44 shrink-0 text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export function Unknown({ note }: { note?: string }) {
  return (
    <span className="text-sm text-slate-400" title={note}>
      Desconhecido
    </span>
  );
}

/**
 * The two scores side by side, with the selected axis given the weight.
 *
 * Both are always shown. The whole reason for two axes is that they disagree,
 * and a card that showed only the one being sorted on would hide the disagreement
 * exactly when it matters — the company that is a poor website lead and an
 * excellent system lead looks like a poor lead.
 */
export function AxisScores({
  websiteScore,
  websiteClassification,
  systemScore,
  systemClassification,
  axis,
}: {
  websiteScore: number | null | undefined;
  websiteClassification: Classification | null | undefined;
  systemScore: number | null | undefined;
  systemClassification: Classification | null | undefined;
  axis: 'WEBSITE' | 'SYSTEM';
}) {
  const primary =
    axis === 'SYSTEM'
      ? { label: 'Sistema', score: systemScore, classification: systemClassification }
      : { label: 'Site', score: websiteScore, classification: websiteClassification };
  const secondary =
    axis === 'SYSTEM'
      ? { label: 'Site', score: websiteScore, classification: websiteClassification }
      : { label: 'Sistema', score: systemScore, classification: systemClassification };

  return (
    <div className="flex w-24 flex-col items-center gap-2">
      <div className="flex flex-col items-center">
        <span className="text-[10px] uppercase tracking-wide text-slate-400">{primary.label}</span>
        <span className={`text-3xl font-bold tabular-nums ${scoreColour(primary.score)}`}>
          {primary.score ?? '—'}
        </span>
      </div>
      <ClassificationBadge value={primary.classification} />
      <div className="flex items-baseline gap-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
        <span className="uppercase tracking-wide text-slate-400">{secondary.label}</span>
        <span className={`font-semibold tabular-nums ${scoreColour(secondary.score)}`}>
          {secondary.score ?? '—'}
        </span>
      </div>
    </div>
  );
}

/**
 * An estimated size band.
 *
 * Always prefixed "est." and never rendered as a bare number of employees: no
 * registry this system reads publishes a headcount, and a badge that looked
 * like a fact would undo that care everywhere else.
 */
export function SizeBadge({
  band,
  from,
  to,
  fit,
}: {
  band: string | null | undefined;
  from: number | null | undefined;
  to: number | null | undefined;
  fit?: string | null | undefined;
}) {
  if (!band || from === null || from === undefined) {
    return <span className="chip border border-slate-200 bg-slate-100 text-slate-500">Porte desconhecido</span>;
  }
  const range = to === null || to === undefined ? `${from}+` : `${from}–${to}`;
  const tone =
    fit === 'LIKELY'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : fit === 'POSSIBLE'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-slate-200 bg-slate-100 text-slate-600';
  return (
    <span
      className={`chip border ${tone}`}
      title="Estimado a partir do porte declarado no registro. Nenhum registro publica número de funcionários."
    >
      est. {range} pessoas
    </span>
  );
}
