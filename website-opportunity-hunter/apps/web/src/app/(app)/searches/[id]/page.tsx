import Link from 'next/link';
import { notFound } from 'next/navigation';
import { describeFilters, parseFilters } from '@woh/core';
import { prisma } from '@woh/db';
import { LeadCard } from '@/components/lead-card';
import { Card, Notice, Stat } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { LEAD_INCLUDE } from '@/lib/leads';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SearchRunPage({ params }: PageProps) {
  await requireUser();
  const { id } = await params;

  const run = await prisma.searchRun.findUnique({ where: { id }, include: { search: true } });
  if (!run) notFound();

  const results = await prisma.company.findMany({
    where: { runResults: { some: { searchRunId: run.id } } },
    include: LEAD_INCLUDE,
    orderBy: [{ currentScore: 'desc' }, { name: 'asc' }],
    take: 100,
  });

  let summary = run.search.name;
  try {
    summary = describeFilters(parseFilters(run.search.filters));
  } catch {
    /* fall back to the stored name */
  }

  const running = run.status === 'QUEUED' || run.status === 'RUNNING';

  return (
    <div className="space-y-4">
      <div>
        <Link href="/searches" className="text-xs text-slate-500 hover:underline">← All searches</Link>
        <h1 className="text-xl font-semibold">{run.search.name}</h1>
        <p className="text-sm text-slate-500">{summary}</p>
      </div>

      {running ? (
        <Notice>
          This run is {run.status.toLowerCase()}. Refresh the page to see progress — results appear as
          companies are processed.
        </Notice>
      ) : null}
      {run.error ? <Notice tone="error">{run.error}</Notice> : null}
      {run.status === 'PARTIAL' ? (
        <Notice tone="warn">
          Some stages failed for some companies. Nothing was lost — open a lead to see which stage
          failed and re-run it.
        </Notice>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Companies found" value={run.companiesFound} />
        <Stat label="New" value={run.companiesNew} hint={`${run.companiesDuplicate} already known`} />
        <Stat label="Hot" value={run.hotLeads} />
        <Stat label="High opportunity" value={run.highOpportunity} />
        <Stat label="Warm" value={run.warmLeads} />
        <Stat label="Website not found" value={run.noWebsite} />
        <Stat label="Weak website" value={run.weakWebsite} />
        <Stat label="Stage failures" value={run.stageFailures} />
      </div>

      <Card>
        <p className="text-sm text-slate-500">
          Status <strong>{run.status}</strong> · started {formatDateTime(run.startedAt)} · finished{' '}
          {formatDateTime(run.finishedAt)}
        </p>
      </Card>

      <div className="space-y-3">
        {results.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
        {results.length === 0 && !running ? (
          <Card>
            <p className="text-sm text-slate-500">This run produced no companies.</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
