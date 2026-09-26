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

  // Which source actually answered. A run that fell back to the demo dataset
  // looks exactly like a run that found almost nothing real — same layout, same
  // small numbers — and the only difference that matters is invisible unless
  // the page says it. The top-of-app banner does not cover this: it keys on the
  // UK provider, so someone with a Companies House key searching Brazil gets no
  // warning at all.
  const stats = (run.stats ?? {}) as { provider?: unknown };
  const usedFixtures = stats.provider === 'fixture';
  const filters = (() => {
    try {
      return parseFilters(run.search.filters);
    } catch {
      return undefined;
    }
  })();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/searches" className="text-xs text-slate-500 hover:underline">← Todas as buscas</Link>
        <h1 className="text-xl font-semibold">{run.search.name}</h1>
        <p className="text-sm text-slate-500">{summary}</p>
      </div>

      {running ? (
        <Notice>
Esta execução está {run.status.toLowerCase()}. Atualize a página para acompanhar — os resultados
          aparecem conforme as empresas são processadas.
        </Notice>
      ) : null}
      {usedFixtures ? (
        <Notice tone="warn">
          Esta busca usou as <strong>empresas fictícias de demonstração</strong>, não empresas reais
          — são só 15 no total, então quase todo filtro devolve um punhado.
          {filters?.countryCode === 'BR' ? (
            <>
              {' '}
              Para o Brasil, isso quer dizer que nenhum arquivo mensal da Receita Federal foi
              importado ainda. Rode <code>npm run ingest:br</code> — o README tem o passo a passo.
            </>
          ) : (
            <> Configure uma fonte de dados reais para este país e rode a busca de novo.</>
          )}
        </Notice>
      ) : null}
      {run.error ? <Notice tone="error">{run.error}</Notice> : null}
      {run.status === 'PARTIAL' ? (
        <Notice tone="warn">
Algumas etapas falharam para algumas empresas. Nada foi perdido — abra um lead para ver qual
          etapa falhou e rodá-la de novo.
        </Notice>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Empresas encontradas" value={run.companiesFound} />
        <Stat label="Novas" value={run.companiesNew} hint={`${run.companiesDuplicate} já conhecidas`} />
        <Stat label="Quentes" value={run.hotLeads} />
        <Stat label="Alta oportunidade" value={run.highOpportunity} />
        <Stat label="Mornas" value={run.warmLeads} />
        <Stat label="Sem site encontrado" value={run.noWebsite} />
        <Stat label="Site fraco" value={run.weakWebsite} />
        <Stat label="Falhas de etapa" value={run.stageFailures} />
      </div>

      <Card>
        <p className="text-sm text-slate-500">
          Situação <strong>{run.status}</strong> · iniciada em {formatDateTime(run.startedAt)} ·
          terminada em {formatDateTime(run.finishedAt)}
        </p>
      </Card>

      <div className="space-y-3">
        {results.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
        {results.length === 0 && !running ? (
          <Card>
            <p className="text-sm text-slate-500">Esta execução não produziu nenhuma empresa.</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
