import { COMPANY_AGE_LABELS, INDUSTRIES, enabledCountries, getCountry } from '@woh/core';
import { DEFAULT_COUNTRY } from '@woh/config';
import { Card, Notice, SectionTitle } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { env, integrations } from '@/lib/context';
import { loadSettings } from './actions';
import { SettingsForm } from './settings-form';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  await requireUser();
  const settings = await loadSettings();
  const config = env();
  const status = integrations();
  // Read from the country profile rather than written out here. The card used
  // to state "United Kingdom (GB) · GBP (£) · Europe/London" as fixed text,
  // which quietly became false the moment the default country changed — a
  // settings page that lies about the settings is worse than no card at all.
  const home = getCountry(DEFAULT_COUNTRY);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Configurações</h1>
        <p className="text-sm text-slate-500">
          Padrões para novas buscas, e os limites que transformam um score em uma classificação.
        </p>
      </div>

      <Card>
        <SettingsForm
          settings={settings}
          countries={enabledCountries().map((c) => ({ code: c.code, name: c.name }))}
          industries={INDUSTRIES.map((i) => ({ key: i.key, label: i.label }))}
          ageOptions={Object.entries(COMPANY_AGE_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </Card>

      <Card>
        <SectionTitle hint="Definido por variáveis de ambiente; nunca editável pelo navegador">
          Configuração da instalação
        </SectionTitle>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Item label="País padrão" value={home ? `${home.name} (${home.code})` : DEFAULT_COUNTRY} />
          <Item label="Moeda" value={home ? `${home.currency} (${home.currencySymbol})` : '—'} />
          <Item label="Fuso horário" value={home?.timezone ?? '—'} />
          <Item label="Idioma" value={home?.language ?? '—'} />
          <Item label="Países habilitados" value={enabledCountries().map((c) => c.code).join(', ')} />
          <Item label="Driver da fila" value={config.QUEUE_DRIVER} />
          <Item label="Companies House" value={status.companiesHouse} />
          <Item label="Busca na web" value={String(status.webSearch)} />
          <Item label="Fichas de negócio" value={String(status.places)} />
          <Item label="IA" value={String(status.ai)} />
          <Item
            label="Orçamento mensal de IA"
            value={config.AI_MONTHLY_BUDGET_GBP.toFixed(2)}
          />
          <Item label="Respeitar robots.txt" value={config.RESPECT_ROBOTS_TXT ? 'sim' : 'não'} />
          <Item label="Cache da análise de site" value={`${config.WEBSITE_ANALYSIS_TTL_HOURS}h`} />
        </dl>
        <div className="mt-3">
          <Notice>
            Outros países não estão habilitados de propósito: cada um precisa do seu próprio provedor
            de registro e da sua própria revisão de privacidade antes de ser ligado. A arquitetura
            comporta mais países; esta versão entrega apenas os que foram revisados.
          </Notice>
        </div>
      </Card>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
