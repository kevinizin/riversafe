import Link from 'next/link';
import { prisma } from '@woh/db';
import { Card, ClassificationBadge } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { CRM_PIPELINE, LEAD_STATUS_LABEL, formatDateTime } from '@/lib/format';
import { setLeadStatusAction } from '../leads/[id]/actions';

export const dynamic = 'force-dynamic';

export default async function CrmPage() {
  await requireUser();

  const companies = await prisma.company.findMany({
    where: { leadStatus: { not: 'DISCARDED' } },
    orderBy: [{ leadStatusAt: 'desc' }],
    take: 500,
    select: {
      id: true,
      name: true,
      city: true,
      leadStatus: true,
      leadStatusAt: true,
      currentScore: true,
      currentClassification: true,
    },
  });

  const columns = CRM_PIPELINE.map((status) => ({
    status,
    label: LEAD_STATUS_LABEL[status] ?? status,
    items: companies.filter((c) => c.leadStatus === status),
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">CRM</h1>
        <p className="text-sm text-slate-500">
          Move a lead along the pipeline as you work it. Nothing here sends messages — the stages
          record what you did.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((column) => (
          <Card key={column.status}>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">{column.label}</h2>
              <span className="text-xs text-slate-500">{column.items.length}</span>
            </div>
            <ul className="space-y-2">
              {column.items.slice(0, 25).map((company) => (
                <li key={company.id} className="rounded-md border border-slate-200 p-2">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/leads/${company.id}`} className="text-sm font-medium hover:underline">
                      {company.name}
                    </Link>
                    <span className="text-sm font-semibold tabular-nums">{company.currentScore ?? '—'}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {company.city ?? 'Location unknown'} · {formatDateTime(company.leadStatusAt)}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <ClassificationBadge value={company.currentClassification} />
                    <form action={setLeadStatusAction} className="flex items-center gap-1">
                      <input type="hidden" name="companyId" value={company.id} />
                      <select
                        name="status"
                        defaultValue={company.leadStatus}
                        className="rounded border border-slate-300 px-1 py-0.5 text-xs"
                        aria-label={`Move ${company.name}`}
                      >
                        {CRM_PIPELINE.map((status) => (
                          <option key={status} value={status}>{LEAD_STATUS_LABEL[status]}</option>
                        ))}
                      </select>
                      <button type="submit" className="text-xs text-brand hover:underline">
                        Move
                      </button>
                    </form>
                  </div>
                </li>
              ))}
              {column.items.length === 0 ? (
                <li className="text-xs text-slate-400">Nothing here.</li>
              ) : null}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
