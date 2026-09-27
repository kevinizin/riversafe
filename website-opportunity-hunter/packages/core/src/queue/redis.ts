import { Queue } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';
import type { JobPayloads, JobQueue, JobType } from './types.js';
import { QUEUE_NAME } from './types.js';

/** Shared Redis connection settings BullMQ requires for both ends. */
export function createRedisConnection(url: string): Redis {
  return new IORedis(url, { maxRetriesPerRequest: null, enableReadyCheck: false });
}

/**
 * Production queue. Jobs survive restarts, retry with backoff, and are worked by
 * a separate process so a long search never ties up an HTTP request.
 */
export class RedisQueue implements JobQueue {
  readonly driver = 'redis' as const;
  private readonly queue: Queue;

  constructor(private readonly connection: Redis) {
    this.queue = new Queue(QUEUE_NAME, { connection });
  }

  async enqueue<T extends JobType>(type: T, payload: JobPayloads[T]): Promise<string> {
    const job = await this.queue.add(type, payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { age: 86_400, count: 1000 },
      removeOnFail: { age: 7 * 86_400 },
    });
    return job.id ?? `${type}-unknown`;
  }

  async health(): Promise<{ ok: boolean; detail: string }> {
    try {
      const counts = await this.queue.getJobCounts('waiting', 'active', 'failed', 'delayed');
      return {
        ok: true,
        detail: `redis driver — waiting ${counts.waiting ?? 0}, active ${counts.active ?? 0}, failed ${counts.failed ?? 0}`,
      };
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : String(err) };
    }
  }

  async close(): Promise<void> {
    await this.queue.close();
    this.connection.disconnect();
  }
}
