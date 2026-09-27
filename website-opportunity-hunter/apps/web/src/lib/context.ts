import 'server-only';
import { loadEnv, integrationStatus, type Env } from '@woh/config';
import { createPipelineContext, enabledCountries, getQueue, type JobQueue, type PipelineContext } from '@woh/core';
import { prisma } from '@woh/db';

/**
 * Process-wide singletons.
 *
 * Next.js re-evaluates modules on hot reload, so these are parked on globalThis
 * to avoid rebuilding provider clients (and their rate limiters) on every edit.
 */
const globalForApp = globalThis as unknown as {
  __wohCtx?: PipelineContext;
  __wohQueue?: JobQueue;
};

export function env(): Env {
  return loadEnv();
}

export function pipelineContext(): PipelineContext {
  globalForApp.__wohCtx ??= createPipelineContext(env(), { db: prisma });
  return globalForApp.__wohCtx;
}

export function queue(): JobQueue {
  globalForApp.__wohQueue ??= getQueue(env(), pipelineContext());
  return globalForApp.__wohQueue;
}

export function integrations() {
  return integrationStatus(env());
}

/**
 * Which enabled countries currently have no real source of companies.
 *
 * The header banner used to ask a narrower question — "is the Companies House
 * key missing?" — which meant someone holding a UK key and searching Brazil was
 * told nothing at all, and their Brazilian searches quietly returned the
 * fifteen demo companies. Asking it per country is the same check the pipeline
 * itself makes when it picks a provider.
 */
export async function countriesWithoutRealData(): Promise<string[]> {
  const ctx = pipelineContext();
  const missing: string[] = [];

  for (const country of enabledCountries()) {
    const providers = ctx.providers.companySources.filter(
      (p) => p.countries.includes(country.code) && p.name !== 'fixture',
    );
    // A snapshot-backed provider only knows whether it holds anything after it
    // has looked, so ask it before believing its answer.
    for (const provider of providers) {
      const refreshable = provider as { refresh?: () => Promise<void> };
      if (typeof refreshable.refresh === 'function') await refreshable.refresh();
    }
    if (!providers.some((p) => p.isConfigured())) missing.push(country.name);
  }

  return missing;
}
