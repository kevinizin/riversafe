import Link from 'next/link';
import { INDUSTRIES, enabledCountries } from '@woh/core';
import { LeadCard } from '@/components/lead-card';
import { Card, Empty } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { LEAD_STATUS_LABEL } from '@/lib/format';
import { LEAD_PAGE_SIZE, findLeads, parseLeadQuery } from '@/lib/leads';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LeadsPage({ searchParams }: PageProps) {
  await requireUser();
  const params = await searchParams;
  const query = parseLeadQuery(params);
  const { rows, total } = await findLeads(query);

  const system = query.axis === 'SYSTEM';
  // Regions from every enabled country, not just the United Kingdom's nations.
  const regions = enabledCountries().flatMap((c) => c.regions);

  const pages = Math.max(1, Math.ceil(total / LEAD_PAGE_SIZE));
  const page = query.page ?? 1;
  const exportHref = `/api/export?${new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v] as [string, string]] : [])),
  ).toString()}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Leads</h1>
          <p className="text-sm text-slate-500">
            {total} {total === 1 ? 'empresa atende' : 'empresas atendem'} a estes filtros, ordenadas
            pelo score de {system ? 'sistema' : 'site'}
          </p>
        </div>
        <div className="flex gap-2">
          <a href={exportHref} className="btn-ghost">Exportar CSV</a>
          <Link href="/search" className="btn-primary">Nova busca</Link>
        </div>
      </div>

      {/* The axis switch. Two links rather than a form control, so the choice
          lives in the URL and a particular view can be bookmarked or shared. */}
      <nav className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-sm">
        <Link
          href={axisHref(params, 'WEBSITE')}
          className={`flex-1 rounded-md px-3 py-2 text-center ${
            system ? 'text-slate-600 hover:bg-white' : 'bg-white font-semibold shadow-sm'
          }`}
        >
          Oportunidade de site
          <span className="block text-[11px] font-normal text-slate-500">
            Quem precisa de site — favorece empresas novas
          </span>
        </Link>
        <Link
          href={axisHref(params, 'SYSTEM')}
          className={`flex-1 rounded-md px-3 py-2 text-center ${
            system ? 'bg-white font-semibold shadow-sm' : 'text-slate-600 hover:bg-white'
          }`}
        >
          Oportunidade de sistema
          <span className="block text-[11px] font-normal text-slate-500">
            Quem precisa de sistema de gestão — favorece as estabelecidas
          </span>
        </Link>
      </nav>

      <Card>
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="axis" value={query.axis} />
          <div className="lg:col-span-2">
            <label className="label" htmlFor="q">Buscar</label>
            <input id="q" name="q" defaultValue={query.q ?? ''} className="input" placeholder="Nome, CNPJ, cidade ou CEP" />
          </div>
          <div>
            <label className="label" htmlFor="classification">Classificação</label>
            <select id="classification" name="classification" defaultValue={query.classification ?? ''} className="input">
              <option value="">Qualquer</option>
              <option value="HOT">🔥 Quente</option>
              <option value="HIGH_OPPORTUNITY">🟠 Alta oportunidade</option>
              <option value="WARM">🟡 Morno</option>
              <option value="LOW_PRIORITY">🔵 Baixa prioridade</option>
              <option value="IGNORE">⚪ Descartar</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="website">Site</label>
            <select id="website" name="website" defaultValue={query.website ?? ''} className="input">
              <option value="">Qualquer</option>
              <option value="NO_WEBSITE">Não encontrado</option>
              <option value="WEAK_WEBSITE">Fraco (abaixo de 55/100)</option>
              <option value="NO_OR_WEAK">Não encontrado ou fraco</option>
              <option value="UNCERTAIN">Não confirmado</option>
              <option value="HAS_WEBSITE">Tem site</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="industry">Setor</label>
            <select id="industry" name="industry" defaultValue={query.industry ?? ''} className="input">
              <option value="">Qualquer</option>
              {INDUSTRIES.map((i) => (
                <option key={i.key} value={i.key}>{i.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="region">Estado ou região</label>
            <select id="region" name="region" defaultValue={query.region ?? ''} className="input">
              <option value="">Qualquer</option>
              {regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="city">Cidade</label>
            <input id="city" name="city" defaultValue={query.city ?? ''} className="input" placeholder="Qualquer" />
          </div>
          <div>
            <label className="label" htmlFor="minScore">Score mínimo</label>
            <input id="minScore" name="minScore" type="number" min={0} max={100} defaultValue={query.minScore ?? ''} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="minReviews">Mín. de avaliações</label>
            <input id="minReviews" name="minReviews" type="number" min={0} defaultValue={query.minReviews ?? ''} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="minRating">Nota mínima</label>
            <input id="minRating" name="minRating" type="number" min={0} max={5} step={0.1} defaultValue={query.minRating ?? ''} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="social">Presença em redes</label>
            <select id="social" name="social" defaultValue={query.social ?? ''} className="input">
              <option value="">Qualquer</option>
              <option value="yes">Tem perfil</option>
              <option value="no">Nenhum encontrado</option>
            </select>
          </div>
          {system ? (
            <>
              <div>
                <label className="label" htmlFor="minAgeDays">Aberta há pelo menos</label>
                <select id="minAgeDays" name="minAgeDays" defaultValue={query.minAgeDays ?? ''} className="input">
                  <option value="">Qualquer idade</option>
                  <option value="365">1 ano</option>
                  <option value="730">2 anos</option>
                  <option value="1825">5 anos</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="sizeFit">Encaixe de porte (estimado)</label>
                <select id="sizeFit" name="sizeFit" defaultValue={query.sizeFit ?? ''} className="input">
                  <option value="">Qualquer</option>
                  <option value="LIKELY">Provavelmente na faixa</option>
                  <option value="POSSIBLE">Possivelmente na faixa</option>
                  <option value="UNKNOWN">Desconhecido — vale conferir</option>
                  <option value="UNLIKELY">Descartado pelo porte</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="sizeBand">Faixa de porte (estimada)</label>
                <select id="sizeBand" name="sizeBand" defaultValue={query.sizeBand ?? ''} className="input">
                  <option value="">Qualquer</option>
                  <option value="MICRO">Micro</option>
                  <option value="SMALL">Pequena</option>
                  <option value="MEDIUM">Média</option>
                  <option value="LARGE">Grande</option>
                </select>
              </div>
            </>
          ) : (
            <div>
              <label className="label" htmlFor="ageDays">Aberta nos últimos</label>
              <select id="ageDays" name="ageDays" defaultValue={query.ageDays ?? ''} className="input">
                <option value="">Qualquer idade</option>
                <option value="7">7 dias</option>
                <option value="14">14 dias</option>
                <option value="30">30 dias</option>
                <option value="90">90 dias</option>
                <option value="365">1 ano</option>
              </select>
            </div>
          )}
          <div>
            <label className="label" htmlFor="status">Etapa no funil</label>
            <select id="status" name="status" defaultValue={query.status ?? ''} className="input">
              <option value="">Todas menos as descartadas</option>
              {Object.entries(LEAD_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="sort">Ordenar por</label>
            <select id="sort" name="sort" defaultValue={query.sort ?? 'score'} className="input">
              <option value="score">{system ? 'Score de sistema' : 'Score de site'}</option>
              <option value="newest">Mais recentes</option>
              <option value="oldest">Mais tempo de operação</option>
              <option value="reviews">Mais avaliações</option>
              <option value="added">Adicionadas há pouco</option>
              <option value="name">Nome</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className="btn-primary">Aplicar</button>
            <Link href="/leads" className="btn-ghost">Limpar</Link>
          </div>
        </form>
      </Card>

      {rows.length === 0 ? (
        <Empty
          title="Nenhum lead corresponde"
          body="Afrouxe os filtros, ou rode uma nova busca para trazer mais empresas."
          action={<Link href="/search" className="btn-primary mt-2">Nova busca</Link>}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((lead) => (
            <LeadCard key={lead.id} lead={lead} axis={query.axis} />
          ))}
        </div>
      )}

      {pages > 1 ? (
        <nav className="flex items-center justify-center gap-2 text-sm">
          {page > 1 ? (
            <Link href={pageHref(params, page - 1)} className="btn-ghost">Anterior</Link>
          ) : null}
          <span className="text-slate-500">Página {page} de {pages}</span>
          {page < pages ? (
            <Link href={pageHref(params, page + 1)} className="btn-ghost">Próxima</Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

/** The same filters, viewed through the other axis. */
function axisHref(params: Record<string, string | string[] | undefined>, axis: string): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    // The score-shaped filters mean different things on each axis, so they are
    // dropped rather than silently reinterpreted against the other one.
    if (key === 'axis' || key === 'page' || key === 'classification' || key === 'minScore') continue;
    if (typeof value === 'string' && value.length) search.set(key, value);
  }
  search.set('axis', axis);
  return `/leads?${search.toString()}`;
}

function pageHref(params: Record<string, string | string[] | undefined>, page: number): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.length && key !== 'page') search.set(key, value);
  }
  search.set('page', String(page));
  return `/leads?${search.toString()}`;
}
