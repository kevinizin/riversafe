import type { Env } from '@woh/config';
import { prisma as defaultPrisma, type Db } from '@woh/db';
import { createLogger, setLogSink, type Logger } from '../logging/logger.js';
import { buildProviders, type ProviderSet } from '../providers/registry.js';
import { DEFAULT_THRESHOLDS, type ClassificationThresholds } from '../scoring/config.js';

export interface PipelineContext {
  env: Env;
  db: Db;
  providers: ProviderSet;
  log: Logger;
  now(): Date;
  thresholds: ClassificationThresholds;
}

/**
 * Wires configuration, database and providers into one context.
 *
 * The API-usage recorder is attached here rather than inside each provider, so
 * every outbound call is accounted for in exactly one place and no provider can
 * forget to report itself.
 */
export function createPipelineContext(
  env: Env,
  options: {
    db?: Db;
    thresholds?: ClassificationThresholds;
    persistLogs?: boolean;
    /** Overrides the providers built from configuration. Used by tests. */
    providers?: ProviderSet;
    now?: () => Date;
  } = {},
): PipelineContext {
  const db = options.db ?? defaultPrisma;

  const providers = options.providers ?? buildProviders(env, (info) => {
    void db.apiUsage
      .create({
        data: {
          provider: info.provider,
          endpoint: info.endpoint,
          ...(info.status !== undefined ? { status: info.status } : {}),
          ok: info.ok,
          durationMs: info.durationMs,
        },
      })
      .catch(() => {
        /* usage accounting must never break a search */
      });
  });

  if (options.persistLogs !== false) {
    setLogSink((record) => {
      if (record.level === 'debug') return;
      void db.systemLog
        .create({
          data: {
            level: record.level.toUpperCase() as 'INFO' | 'WARN' | 'ERROR',
            event: record.event,
            message: record.message.slice(0, 2000),
            ...(record.jobId ? { jobId: record.jobId } : {}),
            ...(record.companyId ? { companyId: record.companyId } : {}),
            ...(record.context ? { context: record.context as object } : {}),
          },
        })
        .catch(() => {});
    });
  }

  return {
    env,
    db,
    providers,
    log: createLogger(),
    now: options.now ?? (() => new Date()),
    thresholds: options.thresholds ?? DEFAULT_THRESHOLDS,
  };
}
