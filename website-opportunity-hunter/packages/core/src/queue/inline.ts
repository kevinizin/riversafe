import { randomUUID } from 'node:crypto';
import type { Db } from '@woh/db';
import { logger } from '../logging/logger.js';
import type { JobHandlers, JobPayloads, JobQueue, JobType } from './types.js';

/**
 * Runs jobs in the current process, immediately, without blocking the caller.
 *
 * This exists so the product works on a laptop with nothing but Postgres. It is
 * not for production: an inline job dies with the process that started it, which
 * is exactly why `health()` reports the trade-off rather than a bare "ok".
 */
export class InlineQueue implements JobQueue {
  readonly driver = 'inline' as const;
  private readonly running = new Set<Promise<void>>();

  constructor(
    private readonly handlers: JobHandlers,
    private readonly db?: Db,
  ) {}

  async enqueue<T extends JobType>(type: T, payload: JobPayloads[T]): Promise<string> {
    const jobId = randomUUID();
    await this.record(jobId, type, payload, 'QUEUED');

    const task = (async () => {
      await this.record(jobId, type, payload, 'RUNNING');
      try {
        await (this.handlers[type] as (p: JobPayloads[T]) => Promise<void>)(payload);
        await this.record(jobId, type, payload, 'COMPLETED');
      } catch (err) {
        logger.error('queue.job_failed', `${type} failed`, {
          jobId,
          error: err instanceof Error ? err.message : String(err),
        });
        await this.record(jobId, type, payload, 'FAILED', err);
      }
    })();

    this.running.add(task);
    void task.finally(() => this.running.delete(task));
    return jobId;
  }

  async health(): Promise<{ ok: boolean; detail: string }> {
    return {
      ok: true,
      detail: `inline driver, ${this.running.size} job(s) in flight; jobs do not survive a restart`,
    };
  }

  /** Test helper: wait for everything currently in flight. */
  async drain(): Promise<void> {
    while (this.running.size > 0) await Promise.all([...this.running]);
  }

  async close(): Promise<void> {
    await this.drain();
  }

  private async record(
    jobId: string,
    type: JobType,
    payload: unknown,
    status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED',
    error?: unknown,
  ): Promise<void> {
    if (!this.db) return;
    const message = error instanceof Error ? error.message : error ? String(error) : null;
    await this.db.jobRecord
      .upsert({
        where: { jobId },
        create: {
          jobId,
          queue: 'inline',
          type,
          status,
          payload: payload as object,
          ...(status === 'RUNNING' ? { startedAt: new Date() } : {}),
        },
        update: {
          status,
          ...(status === 'RUNNING' ? { startedAt: new Date() } : {}),
          ...(status === 'COMPLETED' || status === 'FAILED' ? { finishedAt: new Date() } : {}),
          ...(message ? { error: message.slice(0, 1000) } : {}),
        },
      })
      .catch(() => {});
  }
}
