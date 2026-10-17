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
        <h1 className="text-xl font-semibold">Saúde do sistema</h1>
        <p className="text-sm text-slate-500">Integrações, tarefas, erros e uso de API.</p>
      </div>

      {!dbOk ? <Notice tone="error">O banco de dados não respondeu à consulta de saúde.</Notice> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Banco de dados" value={dbOk ? 'OK' : 'Fora do ar'} />
        <Stat label="Fila" value={queueHealth.ok ? 'OK' : 'Fora do ar'} hint={queueHealth.detail} />
        <Stat label="Empresas com etapas falhas" value={stuckStages} />
        <Stat label="Erros recentes" value={errors.length} />
      </div>

      <Card>
        <SectionTitle hint="Quais serviços externos esta instalação pode usar">Integrações</SectionTitle>
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
            Sem uma fonte de dados reais, as buscas usam as empresas fictícias de demonstração. Para
            o Brasil, importe um arquivo mensal da Receita Federal; para o Reino Unido, registre-se
            de graça em developer.company-information.service.gov.uk.
          </p>
        ) : null}
      </Card>

      <Card>
        <SectionTitle>Tarefas recentes</SectionTitle>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="table-cell">Tipo</th>
              <th className="table-cell">Situação</th>
              <th className="table-cell">Início</th>
              <th className="table-cell">Fim</th>
              <th className="table-cell">Erro</th>
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
              <tr><td className="table-cell text-slate-500" colSpan={5}>Nenhuma tarefa registrada ainda.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle>Erros</SectionTitle>
          <ul className="space-y-2 text-sm">
            {errors.map((log) => (
              <li key={log.id} className="border-b border-slate-100 pb-2 last:border-0">
                <p className="font-mono text-xs text-slate-500">{log.event}</p>
                <p>{log.message}</p>
                <p className="text-xs text-slate-400">{formatDateTime(log.createdAt)}</p>
              </li>
            ))}
            {errors.length === 0 ? <li className="text-slate-500">Nenhum erro registrado.</li> : null}
          </ul>
        </Card>

        <Card>
          <SectionTitle hint="Últimos 7 dias">Uso de API</SectionTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="table-cell">Fonte</th>
                <th className="table-cell">Resultado</th>
                <th className="table-cell text-right">Chamadas</th>
                <th className="table-cell text-right">Média ms</th>
              </tr>
            </thead>
            <tbody>
              {apiUsage.map((row) => (
                <tr key={`${row.provider}-${String(row.ok)}`} className="border-b border-slate-100 last:border-0">
                  <td className="table-cell">{row.provider}</td>
                  <td className="table-cell">{row.ok ? 'ok' : 'falhou'}</td>
                  <td className="table-cell text-right tabular-nums">{row._count._all}</td>
                  <td className="table-cell text-right tabular-nums">
                    {row._avg.durationMs ? Math.round(row._avg.durationMs) : '—'}
                  </td>
                </tr>
              ))}
              {apiUsage.length === 0 ? (
                <tr><td className="table-cell text-slate-500" colSpan={4}>Nenhuma chamada externa registrada.</td></tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
