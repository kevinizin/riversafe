import { prisma } from '@woh/db';
import { Card, SectionTitle, Stat } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { LEAD_STATUS_LABEL } from '@/lib/format';

export const dynamic = 'force-dynamic';

const rate = (numerator: number, denominator: number): string =>
  denominator === 0 ? '—' : `${Math.round((numerator / denominator) * 100)}%`;

export default async function AnalyticsPage() {
  await requireUser();
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));

  const [byStatus, byClassification, totals, previews, contactsPrepared, apiUsage, aiUsage, analyses] =
    await Promise.all([
      prisma.company.groupBy({ by: ['leadStatus'], _count: { _all: true } }),
      prisma.company.groupBy({ by: ['currentClassification'], _count: { _all: true } }),
      prisma.company.aggregate({
        _count: { _all: true },
        _avg: { currentScore: true },
      }),
      prisma.outreachCandidate.count({ where: { channel: 'website_preview' } }),
      prisma.outreachCandidate.count({ where: { channel: 'email', status: { in: ['READY', 'APPROVED', 'SENT'] } } }),
      prisma.apiUsage.groupBy({
        by: ['provider'],
        _count: { _all: true },
        where: { createdAt: { gte: monthStart } },
      }),
      prisma.aiUsage.aggregate({
        _sum: { estimatedCostGbp: true, inputTokens: true, outputTokens: true },
        _count: { _all: true },
        where: { createdAt: { gte: monthStart } },
      }),
      prisma.websiteAnalysis.count({ where: { fetchedAt: { gte: monthStart } } }),
    ]);

  const status = new Map(byStatus.map((row) => [row.leadStatus, row._count._all]));
  const classification = new Map(byClassification.map((row) => [row.currentClassification, row._count._all]));

  const discovered = totals._count._all;
  const qualified = (classification.get('HOT') ?? 0) + (classification.get('HIGH_OPPORTUNITY') ?? 0) + (classification.get('WARM') ?? 0);
  const contacted = status.get('CONTACTED') ?? 0;
  const replied = status.get('REPLIED') ?? 0;
  const interested = status.get('INTERESTED') ?? 0;
  const demos = status.get('DEMO') ?? 0;
  const proposals = status.get('PROPOSAL') ?? 0;
  const won = status.get('WON') ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Métricas</h1>
        <p className="text-sm text-slate-500">
          Os números vêm do que o sistema encontrou e do que você registrou. Nada aqui é estimado.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Empresas descobertas" value={discovered} />
        <Stat label="Leads qualificados" value={qualified} hint="mornos ou acima" />
        <Stat label="Leads quentes" value={classification.get('HOT') ?? 0} />
        <Stat label="Score médio" value={totals._avg.currentScore ? Math.round(totals._avg.currentScore) : '—'} />
        <Stat label="Prévias criadas" value={previews} />
        <Stat label="Contatos preparados" value={contactsPrepared} />
        <Stat label="Contacted" value={contacted} />
        <Stat label="Won" value={won} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="Cada etapa como proporção da anterior">Conversão</SectionTitle>
          <table className="w-full text-sm">
            <tbody>
              <FunnelRow label="Descobertos → qualificados" value={qualified} of={discovered} />
              <FunnelRow label="Qualificados → contatados" value={contacted} of={qualified} />
              <FunnelRow label="Contatados → responderam" value={replied} of={contacted} />
              <FunnelRow label="Responderam → interessados" value={interested} of={replied} />
              <FunnelRow label="Interessados → demonstração" value={demos} of={interested} />
              <FunnelRow label="Demonstração → proposta" value={proposals} of={demos} />
              <FunnelRow label="Proposta → ganho" value={won} of={proposals} />
            </tbody>
          </table>
        </Card>

        <Card>
          <SectionTitle hint="Neste mês corrente">Custo e uso</SectionTitle>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-slate-100 pb-1">
              <dt>Análises de site executadas</dt>
              <dd className="tabular-nums">{analyses}</dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1">
              <dt>Chamadas de IA</dt>
              <dd className="tabular-nums">{aiUsage._count._all}</dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1">
              <dt>Tokens de IA (entrada / saída)</dt>
              <dd className="tabular-nums">
                {aiUsage._sum.inputTokens ?? 0} / {aiUsage._sum.outputTokens ?? 0}
              </dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1">
              {/* No currency symbol: the rate card is configurable per
                  installation, so the unit is whatever was configured there.
                  Printing a symbol we have not verified would be a small lie
                  on a number people budget against. */}
              <dt title="Na moeda da tabela de preços configurada para a IA">
                Gasto estimado com IA
              </dt>
              <dd className="tabular-nums">{(aiUsage._sum.estimatedCostGbp ?? 0).toFixed(2)}</dd>
            </div>
            {apiUsage.map((row) => (
              <div key={row.provider} className="flex justify-between border-b border-slate-100 pb-1 last:border-0">
                <dt>Chamadas a {row.provider}</dt>
                <dd className="tabular-nums">{row._count._all}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card>
        <SectionTitle>Funil</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(LEAD_STATUS_LABEL).map(([key, label]) => (
            <div key={key}>
              <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{status.get(key as never) ?? 0}</dd>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function FunnelRow({ label, value, of }: { label: string; value: number; of: number }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="table-cell">{label}</td>
      <td className="table-cell text-right tabular-nums">{value} / {of}</td>
      <td className="table-cell w-16 text-right font-medium tabular-nums">{rate(value, of)}</td>
    </tr>
  );
}
