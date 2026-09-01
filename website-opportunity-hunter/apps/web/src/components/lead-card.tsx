import Link from 'next/link';
import { industryLabel } from '@woh/core';
import type { LeadRow } from '@/lib/leads';
import { ClassificationBadge, ConfidenceBadge, ScoreDial } from '@/components/ui';
import { LEAD_STATUS_LABEL, WEBSITE_STATUS_LABEL, relativeDays } from '@/lib/format';

/**
 * One lead, as the operator scans a list of them.
 *
 * The "why" list is the point of the card: it is generated from the score's own
 * reasons, so what the operator reads is exactly what the engine used.
 */
export function LeadCard({ lead }: { lead: LeadRow }) {
  const analysis = lead.websites[0]?.analyses[0];
  const industry = lead.industries[0];
  const socialPlatforms = [...new Set(lead.socials.map((s) => s.platform))];

  const why: string[] = [];
  const age = lead.incorporationDate
    ? Math.floor((Date.now() - lead.incorporationDate.getTime()) / 86_400_000)
    : null;
  if (age !== null && age <= 90) why.push(`Incorporated ${relativeDays(lead.incorporationDate)}`);
  if (lead.websiteStatus === 'NO_WEBSITE_FOUND') why.push('No website found');
  if (analysis?.qualityScore !== null && analysis?.qualityScore !== undefined && analysis.qualityScore < 55) {
    why.push(`Website scores ${analysis.qualityScore}/100`);
  }
  if (socialPlatforms.length) why.push(`Active on ${socialPlatforms.length} social platform(s)`);
  if (lead.reviewCount) why.push(`${lead.reviewCount} reviews`);
  if (industry) why.push(`${industryLabel(industry.industryKey)} — high-value sector for a website`);

  return (
    <article className="card flex gap-4 p-4">
      <div className="flex flex-col items-center gap-2">
        <ScoreDial score={lead.currentScore} />
        <ClassificationBadge value={lead.currentClassification} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link href={`/leads/${lead.id}`} className="font-semibold hover:underline">
            {lead.name}
          </Link>
          <span className="text-xs text-slate-500">
            {[lead.city, lead.region].filter(Boolean).join(', ') || 'Location unknown'}
          </span>
          {lead.leadStatus !== 'NEW' ? (
            <span className="chip border border-slate-200 bg-slate-100 text-slate-600">
              {LEAD_STATUS_LABEL[lead.leadStatus]}
            </span>
          ) : null}
        </div>

        <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Incorporated" value={relativeDays(lead.incorporationDate)} />
          <Field
            label="Website"
            value={WEBSITE_STATUS_LABEL[lead.websiteStatus] ?? lead.websiteStatus}
          />
          <Field
            label="Social"
            value={socialPlatforms.length ? socialPlatforms.join(', ') : 'None found'}
          />
          <Field
            label="Reviews"
            value={lead.reviewCount === null ? 'Unknown' : String(lead.reviewCount)}
          />
        </dl>

        {why.length ? (
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            {why.slice(0, 4).map((reason) => (
              <li key={reason}>✓ {reason}</li>
            ))}
          </ul>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link href={`/leads/${lead.id}`} className="btn-ghost">
            View
          </Link>
          <ConfidenceBadge value={lead.websiteConfidence} prefix="Website check" />
        </div>
      </div>
    </article>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}
