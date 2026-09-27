import type { Env } from '@woh/config';
import type { PipelineContext } from '../pipeline/context.js';
import { createJobHandlers } from './handlers.js';
import { InlineQueue } from './inline.js';
import { RedisQueue, createRedisConnection } from './redis.js';
import type { JobQueue } from './types.js';

export * from './types.js';
export { InlineQueue } from './inline.js';
export { RedisQueue, createRedisConnection } from './redis.js';
export { createJobHandlers } from './handlers.js';

let cached: JobQueue | null = null;

/**
 * Returns the process-wide queue for the configured driver.
 *
 * With QUEUE_DRIVER=redis the caller only ever enqueues; the worker process
 * owns execution. With QUEUE_DRIVER=inline the same call runs the handler here.
 */
export function getQueue(env: Env, ctx: PipelineContext): JobQueue {
  if (cached) return cached;
  cached =
    env.QUEUE_DRIVER === 'redis'
      ? new RedisQueue(createRedisConnection(env.REDIS_URL))
      : new InlineQueue(createJobHandlers(ctx), ctx.db);
  return cached;
}

export function resetQueue(): void {
  cached = null;
}
