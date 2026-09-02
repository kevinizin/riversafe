'use client';

import { useActionState, useState } from 'react';
import { createSearchAction, type SearchFormState } from './actions';

interface Props {
  countries: { code: string; name: string }[];
  industriesByGroup: { group: string; industries: { key: string; label: string }[] }[];
  regions: string[];
  cities: string[];
  ageOptions: { value: string; label: string }[];
  websiteOptions: { value: string; label: string }[];
}

export function SearchForm(props: Props) {
  const [state, formAction, pending] = useActionState<SearchFormState, FormData>(
    createSearchAction,
    {},
  );
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (key: string) =>
    setSelected((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="countryCode">Country</label>
          <select id="countryCode" name="countryCode" className="input" defaultValue="GB">
            {props.countries.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="region">Nation or region</label>
          <select id="region" name="region" className="input" defaultValue="">
            <option value="">Entire UK</option>
            {props.regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="city">City or town</label>
          <input
            id="city"
            name="city"
            list="uk-cities"
            className="input"
            placeholder="Any — or type any town"
          />
          <datalist id="uk-cities">
            {props.cities.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="label" htmlFor="companyAge">Company age</label>
          <select id="companyAge" name="companyAge" className="input" defaultValue="LAST_30_DAYS">
            {props.ageOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="label">Industries</legend>
        <p className="mb-2 text-xs text-slate-500">
          Leave everything unticked to search all industries. Selected industries are matched on
          registered SIC codes.
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
          <label className="label" htmlFor="websiteFilter">Website</label>
          <select id="websiteFilter" name="websiteFilter" className="input" defaultValue="ANY">
            {props.websiteOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="minScore">Minimum opportunity score</label>
          <input id="minScore" name="minScore" type="number" min={0} max={100} defaultValue={0} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="minReviews">Minimum reviews</label>
          <input id="minReviews" name="minReviews" type="number" min={0} className="input" placeholder="Any" />
        </div>
        <div>
          <label className="label" htmlFor="maxCompanies">Maximum companies</label>
          <input id="maxCompanies" name="maxCompanies" type="number" min={1} max={500} defaultValue={100} className="input" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Save this search as</label>
          <input id="name" name="name" className="input" placeholder="Optional — a name is generated for you" />
        </div>
        <div>
          <label className="label" htmlFor="nameIncludes">Company name contains</label>
          <input id="nameIncludes" name="nameIncludes" className="input" placeholder="Optional" />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="requireSocialPresence" className="rounded border-slate-300" />
          Only companies with a social profile
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="skipWebsiteAnalysis" className="rounded border-slate-300" />
          Skip website analysis (faster, much less useful)
        </label>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Starting…' : 'Search'}
        </button>
        <p className="text-xs text-slate-500">
          The search runs in the background. You will land on its progress page.
        </p>
      </div>
    </form>
  );
}
