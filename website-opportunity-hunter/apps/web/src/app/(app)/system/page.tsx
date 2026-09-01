import { prisma } from '@woh/db';
import { Card, Notice, SectionTitle, Stat } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { integrations, queue } from '@/lib/context';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function SystemPage() {
  await requireUser();
  const status = integrations();

  const [dbOk, queueHealth, jobs, errors, apiUsage, stuckStages] = await Promise.all([
    prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    queue().health(),
    prisma.jobRecord.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.systemLog.findMany({ where: { level: 'ERROR' }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.apiUsage.groupBy({
      by: ['provider', 'ok'],
      _count: { _all: true },
      _avg: { durationMs: true },
      where: { createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    }),
    prisma.company.count({ where: { OR: [{ enrichmentStatus: 'FAILED' }, { websiteDiscoveryStatus: 'FAILED' }, { websiteAnalysisStatus: 'FAILED' }] } }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">System health</h1>
        <p className="text-sm text-slate-500">Integrations, jobs, errors and API usage.</p>
      </div>

      {!dbOk ? <Notice tone="error">The database did not answer a health query.</Notice> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Database" value={dbOk ? 'OK' : 'Down'} />
        <Stat label="Queue" value={queueHealth.ok ? 'OK' : 'Down'} hint={queueHealth.detail} />
        <Stat label="Companies with failed stages" value={stuckStages} />
        <Stat label="Recent errors" value={errors.length} />
      </div>

      <Card>
        <SectionTitle hint="Which external services this deployment can use">Integrations</SectionTitle>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-sm">
          {Object.entries(status).map(([key, value]) => (
            <div key={key}>
              <dt className="text-xs uppercase tracking-wide text-slate-500">{key}</dt>
              <dd className={value === 'missing' || value === 'disabled' ? 'text-amber-700' : 'text-emerald-700'}>
                {String(value)}
              </dd>
            </div>
          ))}
        </dl>
        {status.companiesHouse === 'missing' ? (
          <p className="mt-2 text-xs text-slate-500">
            Without a Companies House key, searches use the fictional demo dataset. Register free at
            developer.company-information.service.gov.uk.
          </p>
        ) : null}
      </Card>

      <Card>
        <SectionTitle>Recent jobs</SectionTitle>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="table-cell">Type</th>
              <th className="table-cell">Status</th>
              <th className="table-cell">Started</th>
              <th className="table-cell">Finished</th>
              <th className="table-cell">Error</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-b border-slate-100 last:border-0">
                <td className="table-cell font-mono text-xs">{job.type}</td>
                <td className="table-cell">{job.status}</td>
                <td className="table-cell text-slate-500">{formatDateTime(job.startedAt)}</td>
                <td className="table-cell text-slate-500">{formatDateTime(job.finishedAt)}</td>
                <td className="table-cell max-w-xs truncate text-red-700">{job.error ?? ''}</td>
              </tr>
            ))}
            {jobs.length === 0 ? (
              <tr><td className="table-cell text-slate-500" colSpan={5}>No jobs recorded yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle>Errors</SectionTitle>
          <ul className="space-y-2 text-sm">
            {errors.map((log) => (
              <li key={log.id} className="border-b border-slate-100 pb-2 last:border-0">
                <p className="font-mono text-xs text-slate-500">{log.event}</p>
                <p>{log.message}</p>
                <p className="text-xs text-slate-400">{formatDateTime(log.createdAt)}</p>
              </li>
            ))}
            {errors.length === 0 ? <li className="text-slate-500">No errors logged.</li> : null}
          </ul>
        </Card>

        <Card>
          <SectionTitle hint="Last 7 days">API usage</SectionTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="table-cell">Provider</th>
                <th className="table-cell">Result</th>
                <th className="table-cell text-right">Calls</th>
                <th className="table-cell text-right">Avg ms</th>
              </tr>
            </thead>
            <tbody>
              {apiUsage.map((row) => (
                <tr key={`${row.provider}-${String(row.ok)}`} className="border-b border-slate-100 last:border-0">
                  <td className="table-cell">{row.provider}</td>
                  <td className="table-cell">{row.ok ? 'ok' : 'failed'}</td>
                  <td className="table-cell text-right tabular-nums">{row._count._all}</td>
                  <td className="table-cell text-right tabular-nums">
                    {row._avg.durationMs ? Math.round(row._avg.durationMs) : '—'}
                  </td>
                </tr>
              ))}
              {apiUsage.length === 0 ? (
                <tr><td className="table-cell text-slate-500" colSpan={4}>No external calls recorded.</td></tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
