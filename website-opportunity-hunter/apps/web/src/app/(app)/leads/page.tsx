import Link from 'next/link';
import { INDUSTRIES, UK_NATIONS } from '@woh/core';
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
            {total} compan{total === 1 ? 'y' : 'ies'} match these filters
          </p>
        </div>
        <div className="flex gap-2">
          <a href={exportHref} className="btn-ghost">Export CSV</a>
          <Link href="/search" className="btn-primary">New search</Link>
        </div>
      </div>

      <Card>
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="label" htmlFor="q">Search</label>
            <input id="q" name="q" defaultValue={query.q ?? ''} className="input" placeholder="Name, company number, town or postcode" />
          </div>
          <div>
            <label className="label" htmlFor="classification">Classification</label>
            <select id="classification" name="classification" defaultValue={query.classification ?? ''} className="input">
              <option value="">Any</option>
              <option value="HOT">🔥 Hot</option>
              <option value="HIGH_OPPORTUNITY">🟠 High opportunity</option>
              <option value="WARM">🟡 Warm</option>
              <option value="LOW_PRIORITY">🔵 Low priority</option>
              <option value="IGNORE">⚪ Ignore</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="website">Website</label>
            <select id="website" name="website" defaultValue={query.website ?? ''} className="input">
              <option value="">Any</option>
              <option value="NO_WEBSITE">Not found</option>
              <option value="WEAK_WEBSITE">Weak (under 55/100)</option>
              <option value="NO_OR_WEAK">Not found or weak</option>
              <option value="UNCERTAIN">Unconfirmed</option>
              <option value="HAS_WEBSITE">Has a website</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="industry">Industry</label>
            <select id="industry" name="industry" defaultValue={query.industry ?? ''} className="input">
              <option value="">Any</option>
              {INDUSTRIES.map((i) => (
                <option key={i.key} value={i.key}>{i.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="region">Region</label>
            <select id="region" name="region" defaultValue={query.region ?? ''} className="input">
              <option value="">Any</option>
              {UK_NATIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="city">City</label>
            <input id="city" name="city" defaultValue={query.city ?? ''} className="input" placeholder="Any" />
          </div>
          <div>
            <label className="label" htmlFor="minScore">Min score</label>
            <input id="minScore" name="minScore" type="number" min={0} max={100} defaultValue={query.minScore ?? ''} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="minReviews">Min reviews</label>
            <input id="minReviews" name="minReviews" type="number" min={0} defaultValue={query.minReviews ?? ''} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="minRating">Min rating</label>
            <input id="minRating" name="minRating" type="number" min={0} max={5} step={0.1} defaultValue={query.minRating ?? ''} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="social">Social presence</label>
            <select id="social" name="social" defaultValue={query.social ?? ''} className="input">
              <option value="">Any</option>
              <option value="yes">Has a profile</option>
              <option value="no">None found</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="ageDays">Incorporated within</label>
            <select id="ageDays" name="ageDays" defaultValue={query.ageDays ?? ''} className="input">
              <option value="">Any age</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="status">Pipeline status</label>
            <select id="status" name="status" defaultValue={query.status ?? ''} className="input">
              <option value="">Any except discarded</option>
              {Object.entries(LEAD_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="sort">Sort by</label>
            <select id="sort" name="sort" defaultValue={query.sort ?? 'score'} className="input">
              <option value="score">Opportunity score</option>
              <option value="newest">Newest company</option>
              <option value="reviews">Most reviews</option>
              <option value="added">Recently added</option>
              <option value="name">Name</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className="btn-primary">Apply</button>
            <Link href="/leads" className="btn-ghost">Reset</Link>
          </div>
        </form>
      </Card>

      {rows.length === 0 ? (
        <Empty
          title="No leads match"
          body="Loosen the filters, or run a new search to bring in more companies."
          action={<Link href="/search" className="btn-primary mt-2">New search</Link>}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      )}

      {pages > 1 ? (
        <nav className="flex items-center justify-center gap-2 text-sm">
          {page > 1 ? (
            <Link href={pageHref(params, page - 1)} className="btn-ghost">Previous</Link>
          ) : null}
          <span className="text-slate-500">Page {page} of {pages}</span>
          {page < pages ? (
            <Link href={pageHref(params, page + 1)} className="btn-ghost">Next</Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

function pageHref(params: Record<string, string | string[] | undefined>, page: number): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.length && key !== 'page') search.set(key, value);
  }
  search.set('page', String(page));
  return `/leads?${search.toString()}`;
}
