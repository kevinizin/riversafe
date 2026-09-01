import { COMPANY_AGE_LABELS, INDUSTRIES, enabledCountries } from '@woh/core';
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-slate-500">
          Defaults for new searches, and the thresholds that turn a score into a classification.
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
        <SectionTitle hint="Set with environment variables; never editable from the browser">
          Deployment configuration
        </SectionTitle>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Item label="Country" value="United Kingdom (GB)" />
          <Item label="Currency" value="GBP (£)" />
          <Item label="Timezone" value="Europe/London" />
          <Item label="Language" value="en-GB" />
          <Item label="Queue driver" value={config.QUEUE_DRIVER} />
          <Item label="Companies House" value={status.companiesHouse} />
          <Item label="Web search" value={String(status.webSearch)} />
          <Item label="Places" value={String(status.places)} />
          <Item label="AI" value={String(status.ai)} />
          <Item label="AI monthly budget" value={`£${config.AI_MONTHLY_BUDGET_GBP.toFixed(2)}`} />
          <Item label="Respect robots.txt" value={config.RESPECT_ROBOTS_TXT ? 'yes' : 'no'} />
          <Item label="Website analysis cache" value={`${config.WEBSITE_ANALYSIS_TTL_HOURS}h`} />
        </dl>
        <div className="mt-3">
          <Notice>
            Additional countries (Germany, Netherlands, France, Spain, Ireland, Portugal, Italy) are
            deliberately not enabled: each needs its own registry provider and its own privacy review
            before it can be switched on. The architecture supports them; the MVP does not ship them.
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
