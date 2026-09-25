import {
  COMPANY_AGE_LABELS,
  INDUSTRIES,
  INDUSTRY_GROUPS,
  SEARCH_PRESETS,
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
        <h1 className="text-xl font-semibold">Nova busca</h1>
        <p className="text-sm text-slate-500">
          Encontre empresas, descubra a presença digital delas e pontue a oportunidade.
        </p>
      </div>

      {status.webSearch === 'disabled' ? (
        <Notice tone="warn">
          Nenhum provedor de busca na web está configurado, então a descoberta de site e de redes
          só pode usar o registro da empresa e tentativas de domínios prováveis. O resultado será
          mais vezes “site não verificado” do que “site não encontrado”.
        </Notice>
      ) : null}

      <Card>
        <SearchForm
          countries={enabledCountries().map((c) => ({
            code: c.code,
            name: c.name,
            regions: [...c.regions],
            cities: [...c.cities],
          }))}
          industriesByGroup={industriesByGroup}
          presets={SEARCH_PRESETS.map((p) => ({
            key: p.key,
            label: p.label,
            description: p.description,
            axis: p.axis,
            filters: {
              ...(p.filters.companyAge ? { companyAge: p.filters.companyAge } : {}),
              ...(p.filters.websiteFilter ? { websiteFilter: p.filters.websiteFilter } : {}),
              ...(p.filters.industryKeys ? { industryKeys: [...p.filters.industryKeys] } : {}),
            },
          }))}
          ageOptions={Object.entries(COMPANY_AGE_LABELS).map(([value, label]) => ({ value, label }))}
          websiteOptions={WEBSITE_FILTERS.map((value) => ({ value, label: WEBSITE_FILTER_LABELS[value] }))}
        />
      </Card>
    </div>
  );
}
