import Link from 'next/link';
import { prisma } from '@woh/db';
import { Card, Empty, SectionTitle, Stat } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { formatDateTime, relativeDays } from '@/lib/format';

export const dynamic = 'force-dynamic';

const THIRTY_DAYS_AGO = () => new Date(Date.now() - 30 * 86_400_000);

export default async function DashboardPage() {
  await requireUser();
  const since = THIRTY_DAYS_AGO();

  const [
    totalCompanies,
    newCompanies,
    noWebsite,
    weakWebsite,
    hot,
    high,
    warm,
    recentlyOpened,
    pipeline,
    latestRuns,
    topLeads,
  ] = await Promise.all([
    prisma.company.count({ where: { retentionStatus: 'ACTIVE' } }),
    prisma.company.count({ where: { incorporationDate: { gte: since } } }),
    prisma.company.count({ where: { websiteStatus: 'NO_WEBSITE_FOUND' } }),
    prisma.company.count({
      where: { websites: { some: { analyses: { some: { qualityScore: { lt: 55 } } } } } },
    }),
    prisma.company.count({ where: { currentClassification: 'HOT' } }),
    prisma.company.count({ where: { currentClassification: 'HIGH_OPPORTUNITY' } }),
    prisma.company.count({ where: { currentClassification: 'WARM' } }),
    prisma.company.count({
      where: {
        signals: {
          some: { type: { in: ['NOW_OPEN', 'GRAND_OPENING', 'OPENING_SOON', 'NEW_LOCATION'] } },
        },
      },
    }),
    prisma.company.groupBy({ by: ['leadStatus'], _count: { _all: true } }),
    prisma.searchRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { search: true },
    }),
    prisma.company.findMany({
      where: { currentScore: { not: null }, leadStatus: { notIn: ['DISCARDED', 'LOST'] } },
      orderBy: { currentScore: 'desc' },
      take: 5,
      include: { industries: { where: { isPrimary: true }, take: 1 } },
    }),
  ]);

  const byStatus = new Map(pipeline.map((row) => [row.leadStatus, row._count._all]));
  const contacted = byStatus.get('CONTACTED') ?? 0;
  const replied = byStatus.get('REPLIED') ?? 0;
  const won = byStatus.get('WON') ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-500">United Kingdom · GBP · Europe/London</p>
        </div>
        <Link href="/search" className="btn-primary">
          New search
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Companies found" value={totalCompanies} href="/leads" />
        <Stat label="New companies" value={newCompanies} hint="incorporated in the last 30 days" />
        <Stat label="Website not found" value={noWebsite} href="/leads?website=NO_WEBSITE" />
        <Stat label="Weak websites" value={weakWebsite} href="/leads?website=WEAK_WEBSITE" />
        <Stat label="Hot leads" value={hot} href="/leads?classification=HOT" />
        <Stat label="High opportunity" value={high} href="/leads?classification=HIGH_OPPORTUNITY" />
        <Stat label="Warm" value={warm} href="/leads?classification=WARM" />
        <Stat label="Recently opened" value={recentlyOpened} hint="opening or just-opened signals" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="Highest scoring leads not yet discarded">Priority leads</SectionTitle>
          {topLeads.length === 0 ? (
            <Empty
              title="No leads yet"
              body="Run a search to find companies. With no Companies House key configured the search uses the fictional demo dataset."
              action={
                <Link href="/search" className="btn-primary mt-2">
                  Run a search
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {topLeads.map((company) => (
                <li key={company.id} className="flex items-center gap-3 py-2">
                  <span className="w-10 text-right text-lg font-semibold tabular-nums">
                    {company.currentScore}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/leads/${company.id}`} className="truncate font-medium hover:underline">
                      {company.name}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {[company.city, company.industries[0]?.industryKey].filter(Boolean).join(' · ')} ·
                      incorporated {relativeDays(company.incorporationDate)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle hint="Outcomes you have recorded yourself">Outreach funnel</SectionTitle>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Metric label="Contact ready" value={byStatus.get('CONTACT_READY') ?? 0} />
            <Metric label="Contacted" value={contacted} />
            <Metric label="Replied" value={replied} />
            <Metric label="Won" value={won} />
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            Reply rate{' '}
            {contacted > 0 ? `${Math.round((replied / contacted) * 100)}%` : '—'} · this system
            prepares outreach but never sends it, so these counts come from what you mark.
          </p>
        </Card>
      </div>

      <Card>
        <SectionTitle>Recent searches</SectionTitle>
        {latestRuns.length === 0 ? (
          <p className="text-sm text-slate-500">No searches have been run yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="table-cell">Search</th>
                <th className="table-cell">Status</th>
                <th className="table-cell text-right">Found</th>
                <th className="table-cell text-right">Hot</th>
                <th className="table-cell text-right">No website</th>
                <th className="table-cell">Finished</th>
              </tr>
            </thead>
            <tbody>
              {latestRuns.map((run) => (
                <tr key={run.id} className="border-b border-slate-100 last:border-0">
                  <td className="table-cell">
                    <Link href={`/searches/${run.id}`} className="hover:underline">
                      {run.search.name}
                    </Link>
                  </td>
                  <td className="table-cell">{run.status}</td>
                  <td className="table-cell text-right tabular-nums">{run.companiesFound}</td>
                  <td className="table-cell text-right tabular-nums">{run.hotLeads}</td>
                  <td className="table-cell text-right tabular-nums">{run.noWebsite}</td>
                  <td className="table-cell text-slate-500">{formatDateTime(run.finishedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
