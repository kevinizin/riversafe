import Link from 'next/link';
import { industryLabel } from '@woh/core';
import type { LeadAxis, LeadRow } from '@/lib/leads';
import { AxisScores, ConfidenceBadge, SizeBadge } from '@/components/ui';
import { LEAD_STATUS_LABEL, WEBSITE_STATUS_LABEL, relativeDays } from '@/lib/format';

/**
 * One lead, as the operator scans a list of them.
 *
 * The "why" list is the point of the card: it is generated from the score's own
 * reasons, so what the operator reads is exactly what the engine used.
 */
export function LeadCard({ lead, axis = 'WEBSITE' }: { lead: LeadRow; axis?: LeadAxis }) {
  const analysis = lead.websites[0]?.analyses[0];
  const industry = lead.industries[0];
  const socialPlatforms = [...new Set(lead.socials.map((s) => s.platform))];

  // The "why" list follows the selected axis, because the reasons genuinely
  // differ: youth is the argument for a website and the argument against a
  // system, and showing the website reasons under a system score would explain
  // the wrong number.
  const why: string[] = [];
  const age = lead.incorporationDate
    ? Math.floor((Date.now() - lead.incorporationDate.getTime()) / 86_400_000)
    : null;

  if (axis === 'SYSTEM') {
    if (age !== null && age >= 365) {
      why.push(`Aberta há ${Math.floor(age / 365)} ano(s)`);
    }
    if (lead.sizeBand && lead.sizeEmployeesFrom !== null) {
      const to = lead.sizeEmployeesTo === null ? '+' : `–${lead.sizeEmployeesTo}`;
      why.push(`Estimativa de ${lead.sizeEmployeesFrom}${to} pessoas`);
    }
    if (industry) why.push(`${industryLabel(industry.industryKey)} — setor movido a processo`);
    if (lead.websiteStatus === 'NO_WEBSITE_FOUND') why.push('Sem site encontrado');
    else if (analysis && !analysis.hasOnlineBooking) why.push('Site só institucional, nada rodando nele');
  } else {
    if (age !== null && age <= 90) why.push(`Aberta ${relativeDays(lead.incorporationDate)}`);
    if (lead.websiteStatus === 'NO_WEBSITE_FOUND') why.push('Sem site encontrado');
    if (analysis?.qualityScore !== null && analysis?.qualityScore !== undefined && analysis.qualityScore < 55) {
      why.push(`Site pontua ${analysis.qualityScore}/100`);
    }
    if (socialPlatforms.length) why.push(`Presente em ${socialPlatforms.length} rede(s) social(is)`);
    if (lead.reviewCount) why.push(`${lead.reviewCount} avaliações`);
    if (industry) why.push(`${industryLabel(industry.industryKey)} — setor de alto valor para um site`);
  }

  return (
    <article className="card flex gap-4 p-4">
      <AxisScores
        websiteScore={lead.currentScore}
        websiteClassification={lead.currentClassification}
        systemScore={lead.systemScore}
        systemClassification={lead.systemClassification}
        axis={axis}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link href={`/leads/${lead.id}`} className="font-semibold hover:underline">
            {lead.name}
          </Link>
          <span className="text-xs text-slate-500">
            {[lead.city, lead.region].filter(Boolean).join(', ') || 'Localização desconhecida'}
          </span>
          {lead.leadStatus !== 'NEW' ? (
            <span className="chip border border-slate-200 bg-slate-100 text-slate-600">
              {LEAD_STATUS_LABEL[lead.leadStatus]}
            </span>
          ) : null}
        </div>

        <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Aberta" value={relativeDays(lead.incorporationDate)} />
          <Field
            label="Site"
            value={WEBSITE_STATUS_LABEL[lead.websiteStatus] ?? lead.websiteStatus}
          />
          <Field
            label="Redes"
            value={socialPlatforms.length ? socialPlatforms.join(', ') : 'Nenhuma encontrada'}
          />
          {axis === 'SYSTEM' ? (
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-400">Porte</dt>
              <dd>
                <SizeBadge
                  band={lead.sizeBand}
                  from={lead.sizeEmployeesFrom}
                  to={lead.sizeEmployeesTo}
                  fit={lead.sizeFit}
                />
              </dd>
            </div>
          ) : (
            <Field
              label="Avaliações"
              value={lead.reviewCount === null ? 'Desconhecido' : String(lead.reviewCount)}
            />
          )}
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
            Abrir
          </Link>
          <ConfidenceBadge value={lead.websiteConfidence} prefix="Verificação do site" />
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
