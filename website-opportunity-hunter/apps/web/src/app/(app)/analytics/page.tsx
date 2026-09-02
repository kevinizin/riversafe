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
        <h1 className="text-xl font-semibold">Analytics</h1>
        <p className="text-sm text-slate-500">
          Counts come from what the system found and what you recorded. Nothing here is estimated.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Companies discovered" value={discovered} />
        <Stat label="Qualified leads" value={qualified} hint="warm or better" />
        <Stat label="Hot leads" value={classification.get('HOT') ?? 0} />
        <Stat label="Average score" value={totals._avg.currentScore ? Math.round(totals._avg.currentScore) : '—'} />
        <Stat label="Previews created" value={previews} />
        <Stat label="Contacts prepared" value={contactsPrepared} />
        <Stat label="Contacted" value={contacted} />
        <Stat label="Won" value={won} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="Each step as a share of the one before it">Conversion</SectionTitle>
          <table className="w-full text-sm">
            <tbody>
              <FunnelRow label="Discovered → qualified" value={qualified} of={discovered} />
              <FunnelRow label="Qualified → contacted" value={contacted} of={qualified} />
              <FunnelRow label="Contacted → replied" value={replied} of={contacted} />
              <FunnelRow label="Replied → interested" value={interested} of={replied} />
              <FunnelRow label="Interested → demo" value={demos} of={interested} />
              <FunnelRow label="Demo → proposal" value={proposals} of={demos} />
              <FunnelRow label="Proposal → won" value={won} of={proposals} />
            </tbody>
          </table>
        </Card>

        <Card>
          <SectionTitle hint="This calendar month">Cost and usage</SectionTitle>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-slate-100 pb-1">
              <dt>Website analyses run</dt>
              <dd className="tabular-nums">{analyses}</dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1">
              <dt>AI calls</dt>
              <dd className="tabular-nums">{aiUsage._count._all}</dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1">
              <dt>AI tokens (in / out)</dt>
              <dd className="tabular-nums">
                {aiUsage._sum.inputTokens ?? 0} / {aiUsage._sum.outputTokens ?? 0}
              </dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1">
              <dt>Estimated AI spend</dt>
              <dd className="tabular-nums">£{(aiUsage._sum.estimatedCostGbp ?? 0).toFixed(2)}</dd>
            </div>
            {apiUsage.map((row) => (
              <div key={row.provider} className="flex justify-between border-b border-slate-100 pb-1 last:border-0">
                <dt>{row.provider} calls</dt>
                <dd className="tabular-nums">{row._count._all}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card>
        <SectionTitle>Pipeline</SectionTitle>
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
