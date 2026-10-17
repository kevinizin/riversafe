'use client';

import { useActionState } from 'react';
import { saveSettingsAction } from './actions';
import type { AppSettings, SettingsState } from './schema';

interface Props {
  settings: AppSettings;
  countries: { code: string; name: string }[];
  industries: { key: string; label: string }[];
  ageOptions: { value: string; label: string }[];
}

export function SettingsForm({ settings, countries, industries, ageOptions }: Props) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(saveSettingsAction, {});

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="countryCode">País padrão</label>
          <select id="countryCode" name="countryCode" defaultValue={settings.countryCode} className="input">
            {countries.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="defaultCity">Cidade padrão</label>
          <input id="defaultCity" name="defaultCity" defaultValue={settings.defaultCity} className="input" placeholder="Any" />
        </div>
        <div>
          <label className="label" htmlFor="defaultCompanyAge">Idade padrão da empresa</label>
          <select id="defaultCompanyAge" name="defaultCompanyAge" defaultValue={settings.defaultCompanyAge} className="input">
            {ageOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="minScore">Score mínimo para exibir</label>
          <input id="minScore" name="minScore" type="number" min={0} max={100} defaultValue={settings.minScore} className="input" />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="defaultIndustryKeys">Setores padrão</label>
        <select
          id="defaultIndustryKeys"
          name="defaultIndustryKeys"
          multiple
          defaultValue={settings.defaultIndustryKeys}
          className="input h-40"
        >
          {industries.map((i) => (
            <option key={i.key} value={i.key}>{i.label}</option>
          ))}
        </select>
      </div>

      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <legend className="label mb-2">Limites de classificação</legend>
        <div>
          <label className="label" htmlFor="thresholdHot">🔥 Quente a partir de</label>
          <input id="thresholdHot" name="thresholdHot" type="number" min={0} max={100} defaultValue={settings.thresholds.HOT} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="thresholdHigh">🟠 Alta a partir de</label>
          <input id="thresholdHigh" name="thresholdHigh" type="number" min={0} max={100} defaultValue={settings.thresholds.HIGH_OPPORTUNITY} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="thresholdWarm">🟡 Morno a partir de</label>
          <input id="thresholdWarm" name="thresholdWarm" type="number" min={0} max={100} defaultValue={settings.thresholds.WARM} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="thresholdLow">🔵 Baixa prioridade a partir de</label>
          <input id="thresholdLow" name="thresholdLow" type="number" min={0} max={100} defaultValue={settings.thresholds.LOW_PRIORITY} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="weakWebsiteThreshold">Site fraco abaixo de</label>
          <input id="weakWebsiteThreshold" name="weakWebsiteThreshold" type="number" min={0} max={100} defaultValue={settings.weakWebsiteThreshold} className="input" />
        </div>
      </fieldset>

      <div className="sm:w-64">
        <label className="label" htmlFor="retentionDays">Retenção (dias)</label>
        <input id="retentionDays" name="retentionDays" type="number" min={30} max={3650} defaultValue={settings.retentionDays} className="input" />
        <p className="mt-1 text-xs text-slate-500">
          Por quanto tempo o registro de uma empresa é guardado antes de entrar para revisão ou exclusão.
        </p>
      </div>

      {state.error ? <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      {state.message ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.message}</p> : null}

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? 'Salvando…' : 'Salvar configurações'}
      </button>
    </form>
  );
}
