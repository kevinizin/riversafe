import {
  COMPANY_AGE_LABELS,
  INDUSTRIES,
  INDUSTRY_GROUPS,
  UK_CITIES,
  UK_NATIONS,
  WEBSITE_FILTERS,
  WEBSITE_FILTER_LABELS,
  enabledCountries,
} from '@woh/core';
import { Card, Notice } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { integrations } from '@/lib/context';
import { SearchForm } from './search-form';

export const dynamic = 'force-dynamic';

export default async function SearchPage() {
  await requireUser();
  const status = integrations();

  const industriesByGroup = INDUSTRY_GROUPS.map((group) => ({
    group,
    industries: INDUSTRIES.filter((i) => i.group === group).map((i) => ({ key: i.key, label: i.label })),
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">New search</h1>
        <p className="text-sm text-slate-500">
          Find companies, discover their digital presence, and score the opportunity.
        </p>
      </div>

      {status.webSearch === 'disabled' ? (
        <Notice tone="warn">
          No web search provider is configured, so website and social discovery can only use the
          registry record and likely-domain probes. Results will more often be “website not
          checked” rather than “website not found”.
        </Notice>
      ) : null}

      <Card>
        <SearchForm
          countries={enabledCountries().map((c) => ({ code: c.code, name: c.name }))}
          industriesByGroup={industriesByGroup}
          regions={[...UK_NATIONS]}
          cities={UK_CITIES.map((c) => c.name)}
          ageOptions={Object.entries(COMPANY_AGE_LABELS).map(([value, label]) => ({ value, label }))}
          websiteOptions={WEBSITE_FILTERS.map((value) => ({ value, label: WEBSITE_FILTER_LABELS[value] }))}
        />
      </Card>
    </div>
  );
}
