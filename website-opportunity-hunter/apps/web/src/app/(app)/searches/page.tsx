import Link from 'next/link';
import { describeFilters, parseFilters } from '@woh/core';
import { prisma } from '@woh/db';
import { Card, Empty } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { rerunSearchAction } from '../search/actions';

export const dynamic = 'force-dynamic';

export default async function SearchesPage() {
  const user = await requireUser();
  const searches = await prisma.search.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: 'desc' },
    include: { runs: { orderBy: { createdAt: 'desc' }, take: 5 } },
    take: 50,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Search history</h1>
          <p className="text-sm text-slate-500">Every search is saved and can be run again unchanged.</p>
        </div>
        <Link href="/search" className="btn-primary">New search</Link>
      </div>

      {searches.length === 0 ? (
        <Empty title="No searches yet" body="Create your first search to start finding companies." />
      ) : (
        searches.map((search) => {
          let summary = search.name;
          try {
            summary = describeFilters(parseFilters(search.filters));
          } catch {
            // A search saved by an older filter version still lists; it just
            // shows its stored name instead of a re-derived summary.
          }
          return (
            <Card key={search.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">{search.name}</h2>
                  <p className="text-xs text-slate-500">{summary}</p>
                  <p className="text-xs text-slate-400">Created {formatDateTime(search.createdAt)}</p>
                </div>
                <form action={rerunSearchAction}>
                  <input type="hidden" name="searchId" value={search.id} />
                  <button type="submit" className="btn-ghost">Run again</button>
                </form>
              </div>

              {search.runs.length ? (
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="table-cell">Run</th>
                      <th className="table-cell">Status</th>
                      <th className="table-cell text-right">Found</th>
                      <th className="table-cell text-right">New</th>
                      <th className="table-cell text-right">Hot</th>
                      <th className="table-cell text-right">No website</th>
                      <th className="table-cell text-right">Weak site</th>
                      <th className="table-cell">Finished</th>
                    </tr>
                  </thead>
                  <tbody>
                    {search.runs.map((run) => (
                      <tr key={run.id} className="border-b border-slate-100 last:border-0">
                        <td className="table-cell">
                          <Link href={`/searches/${run.id}`} className="text-brand hover:underline">
                            open
                          </Link>
                        </td>
                        <td className="table-cell">{run.status}</td>
                        <td className="table-cell text-right tabular-nums">{run.companiesFound}</td>
                        <td className="table-cell text-right tabular-nums">{run.companiesNew}</td>
                        <td className="table-cell text-right tabular-nums">{run.hotLeads}</td>
                        <td className="table-cell text-right tabular-nums">{run.noWebsite}</td>
                        <td className="table-cell text-right tabular-nums">{run.weakWebsite}</td>
                        <td className="table-cell text-slate-500">{formatDateTime(run.finishedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No runs yet.</p>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
