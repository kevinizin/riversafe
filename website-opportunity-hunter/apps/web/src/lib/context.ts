import 'server-only';
import { loadEnv, integrationStatus, type Env } from '@woh/config';
import { createPipelineContext, getQueue, type JobQueue, type PipelineContext } from '@woh/core';
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
