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
  if (!value) return <span className="chip border border-slate-200 bg-slate-100 text-slate-500">Not scored</span>;
  const style = CLASSIFICATION_STYLE[value];
  return (
    <span className={`chip border ${style.className}`}>
      <span aria-hidden>{style.emoji}</span>
      {style.label}
    </span>
  );
}

export function ConfidenceBadge({ value, prefix = 'Confidence' }: { value: Confidence | null | undefined; prefix?: string }) {
  if (!value) return null;
  return (
    <span className={`chip border ${CONFIDENCE_STYLE[value]}`} title="How sure we are about this, given the sources used">
      {prefix}: {value.toLowerCase()}
    </span>
  );
}

export function ScoreDial({ score }: { score: number | null | undefined }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-3xl font-bold tabular-nums ${scoreColour(score)}`}>
        {score ?? '—'}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-slate-400">of 100</span>
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
      Unknown
    </span>
  );
}
