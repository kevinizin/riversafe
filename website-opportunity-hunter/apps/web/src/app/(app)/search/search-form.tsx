'use client';

import { useActionState, useState } from 'react';
import { createSearchAction, type SearchFormState } from './actions';

interface Props {
  /** Each country brings its own regions and towns; the form follows the choice. */
  countries: { code: string; name: string; regions: string[]; cities: string[] }[];
  industriesByGroup: { group: string; industries: { key: string; label: string }[] }[];
  ageOptions: { value: string; label: string }[];
  websiteOptions: { value: string; label: string }[];
  presets: { key: string; label: string; description: string; axis: string; filters: PresetFilters }[];
}

interface PresetFilters {
  companyAge?: string;
  websiteFilter?: string;
  industryKeys?: string[];
}

export function SearchForm(props: Props) {
  const [state, formAction, pending] = useActionState<SearchFormState, FormData>(
    createSearchAction,
    {},
  );
  const [selected, setSelected] = useState<string[]>([]);
  const firstCountry = props.countries[0]?.code ?? 'GB';
  const [countryCode, setCountryCode] = useState(firstCountry);
  const [companyAge, setCompanyAge] = useState('LAST_30_DAYS');
  const [websiteFilter, setWebsiteFilter] = useState('ANY');

  const country = props.countries.find((c) => c.code === countryCode) ?? props.countries[0];

  const toggle = (key: string) =>
    setSelected((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );

  /** Fills the form from a preset. Everything stays editable afterwards. */
  const applyPreset = (filters: PresetFilters) => {
    if (filters.companyAge) setCompanyAge(filters.companyAge);
    if (filters.websiteFilter) setWebsiteFilter(filters.websiteFilter);
    setSelected(filters.industryKeys ?? []);
  };

  return (
    <form action={formAction} className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="label mb-2">Começar a partir de</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {props.presets.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyPreset(preset.filters)}
              className="rounded-md border border-slate-200 bg-white p-3 text-left text-sm hover:border-slate-400"
            >
              <span className="font-semibold">{preset.label}</span>
              <span className="mt-1 block text-xs text-slate-500">{preset.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="countryCode">País</label>
          <select
            id="countryCode"
            name="countryCode"
            className="input"
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
          >
            {props.countries.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="region">Estado ou região</label>
          <select id="region" name="region" className="input" defaultValue="">
            <option value="">Todo o {country?.name ?? 'país'}</option>
            {(country?.regions ?? []).map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="city">Cidade</label>
          <input
            id="city"
            name="city"
            list="country-cities"
            className="input"
            placeholder="Qualquer — ou digite uma cidade"
          />
          <datalist id="country-cities">
            {(country?.cities ?? []).map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="label" htmlFor="companyAge">Idade da empresa</label>
          <select
            id="companyAge"
            name="companyAge"
            className="input"
            value={companyAge}
            onChange={(e) => setCompanyAge(e.target.value)}
          >
            {props.ageOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="label">Setores</legend>
        <p className="mb-2 text-xs text-slate-500">
          Deixe tudo desmarcado para buscar em todos os setores. Os setores marcados são casados
          pelos códigos CNAE registrados.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {props.industriesByGroup.map((group) => (
            <div key={group.group} className="rounded-md border border-slate-200 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {group.group}
              </p>
              <div className="space-y-1">
                {group.industries.map((industry) => (
                  <label key={industry.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="industryKeys"
                      value={industry.key}
                      checked={selected.includes(industry.key)}
                      onChange={() => toggle(industry.key)}
                      className="rounded border-slate-300"
                    />
                    {industry.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="websiteFilter">Site</label>
          <select
            id="websiteFilter"
            name="websiteFilter"
            className="input"
            value={websiteFilter}
            onChange={(e) => setWebsiteFilter(e.target.value)}
          >
            {props.websiteOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="minScore">Score mínimo de oportunidade</label>
          <input id="minScore" name="minScore" type="number" min={0} max={100} defaultValue={0} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="minReviews">Mínimo de avaliações</label>
          <input id="minReviews" name="minReviews" type="number" min={0} className="input" placeholder="Qualquer" />
        </div>
        <div>
          <label className="label" htmlFor="maxCompanies">Máximo de empresas</label>
          <input id="maxCompanies" name="maxCompanies" type="number" min={1} max={500} defaultValue={100} className="input" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Salvar esta busca como</label>
          <input id="name" name="name" className="input" placeholder="Opcional — um nome é gerado para você" />
        </div>
        <div>
          <label className="label" htmlFor="nameIncludes">Nome da empresa contém</label>
          <input id="nameIncludes" name="nameIncludes" className="input" placeholder="Opcional" />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="requireSocialPresence" className="rounded border-slate-300" />
          Só empresas com perfil em rede social
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="skipWebsiteAnalysis" className="rounded border-slate-300" />
          Pular a análise do site (mais rápido, bem menos útil)
        </label>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Iniciando…' : 'Buscar'}
        </button>
        <p className="text-xs text-slate-500">
          A busca roda em segundo plano. Você vai cair na página de progresso dela.
        </p>
      </div>
    </form>
  );
}
