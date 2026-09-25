import Link from 'next/link';
import { prisma } from '@woh/db';
import { enabledCountries } from '@woh/core';
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
    topSystemLeads,
    systemHot,
    sizeFitCandidates,
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
    prisma.company.findMany({
      where: { systemScore: { not: null }, leadStatus: { notIn: ['DISCARDED', 'LOST'] } },
      orderBy: { systemScore: 'desc' },
      take: 5,
      include: { industries: { where: { isPrimary: true }, take: 1 } },
    }),
    prisma.company.count({ where: { systemClassification: { in: ['HOT', 'HIGH_OPPORTUNITY'] } } }),
    prisma.company.count({ where: { sizeFit: { in: ['LIKELY', 'POSSIBLE'] } } }),
  ]);

  const countries = enabledCountries();

  const byStatus = new Map(pipeline.map((row) => [row.leadStatus, row._count._all]));
  const contacted = byStatus.get('CONTACTED') ?? 0;
  const replied = byStatus.get('REPLIED') ?? 0;
  const won = byStatus.get('WON') ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Painel</h1>
          <p className="text-sm text-slate-500">
            {countries.map((c) => `${c.name} · ${c.currency}`).join('  |  ')}
          </p>
        </div>
        <Link href="/search" className="btn-primary">
          Nova busca
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Empresas encontradas" value={totalCompanies} href="/leads" />
        <Stat label="Empresas novas" value={newCompanies} hint="abertas nos últimos 30 dias" />
        <Stat label="Sem site encontrado" value={noWebsite} href="/leads?website=NO_WEBSITE" />
        <Stat label="Sites fracos" value={weakWebsite} href="/leads?website=WEAK_WEBSITE" />
        <Stat label="Leads quentes" value={hot} href="/leads?classification=HOT" />
        <Stat label="Alta oportunidade" value={high} href="/leads?classification=HIGH_OPPORTUNITY" />
        <Stat label="Mornos" value={warm} href="/leads?classification=WARM" />
        <Stat label="Abriram há pouco" value={recentlyOpened} hint="sinais de abertura recente" />
        <Stat
          label="Oportunidades de sistema"
          value={systemHot}
          href="/leads?axis=SYSTEM&classification=HOT"
          hint="quentes ou de alta oportunidade no eixo de sistema"
        />
        <Stat
          label="Porte pode encaixar"
          value={sizeFitCandidates}
          href="/leads?axis=SYSTEM&sizeFit=POSSIBLE"
          hint="estimado, nunca um número declarado de funcionários"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="Maiores scores no eixo de site — empresas novas e sem site">
            Prioridade para site
          </SectionTitle>
          {topLeads.length === 0 ? (
            <Empty
              title="Ainda não há leads"
              body="Rode uma busca para encontrar empresas. Sem uma fonte de dados reais configurada, a busca usa as empresas fictícias de demonstração."
              action={
                <Link href="/search" className="btn-primary mt-2">
                  Rodar uma busca
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
                      aberta {relativeDays(company.incorporationDate)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle hint="Maiores scores no eixo de sistema — estabelecidas, movidas a processo e do porte certo">
            Prioridade para sistema
          </SectionTitle>
          {topSystemLeads.length === 0 ? (
            <Empty
              title="Nada pontuado neste eixo ainda"
              body="Rode uma busca para encontrar empresas. O eixo de sistema procura o oposto do eixo de site: empresas estabelecidas e com equipe, não recém-abertas."
              action={
                <Link href="/search" className="btn-primary mt-2">
                  Rodar uma busca
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {topSystemLeads.map((company) => (
                <li key={company.id} className="flex items-center gap-3 py-2">
                  <span className="w-10 text-right text-lg font-semibold tabular-nums">
                    {company.systemScore}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/leads/${company.id}`} className="truncate font-medium hover:underline">
                      {company.name}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {[company.city, company.industries[0]?.industryKey].filter(Boolean).join(' · ')} ·{' '}
                      {company.sizeEmployeesFrom === null
                        ? 'porte desconhecido'
                        : `est. ${company.sizeEmployeesFrom}${
                            company.sizeEmployeesTo === null ? '+' : `–${company.sizeEmployeesTo}`
                          } pessoas`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="Resultados que você mesmo registrou">Funil de contato</SectionTitle>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Metric label="Prontos p/ contato" value={byStatus.get('CONTACT_READY') ?? 0} />
            <Metric label="Contatados" value={contacted} />
            <Metric label="Responderam" value={replied} />
            <Metric label="Ganhos" value={won} />
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            Taxa de resposta{' '}
            {contacted > 0 ? `${Math.round((replied / contacted) * 100)}%` : '—'} · este sistema
            prepara o contato mas nunca envia, então estes números vêm do que você marcou.
          </p>
        </Card>
      </div>

      <Card>
        <SectionTitle>Buscas recentes</SectionTitle>
        {latestRuns.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma busca foi rodada ainda.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="table-cell">Busca</th>
                <th className="table-cell">Situação</th>
                <th className="table-cell text-right">Encontradas</th>
                <th className="table-cell text-right">Quentes</th>
                <th className="table-cell text-right">Sem site</th>
                <th className="table-cell">Terminou</th>
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
