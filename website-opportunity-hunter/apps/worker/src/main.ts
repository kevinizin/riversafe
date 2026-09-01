import { loadEnv } from '@woh/config';
import {
  QUEUE_NAME,
  createJobHandlers,
  createPipelineContext,
  createRedisConnection,
  createLogger,
  type JobPayloads,
  type JobType,
} from '@woh/core';
import { loadEnvFileIfPresent } from '../../../scripts/load-env.mjs';
import { prisma } from '@woh/db';
import { Worker, type Job } from 'bullmq';

/**
 * The background worker.
 *
 * Only needed when QUEUE_DRIVER=redis. With the inline driver the web process
 * runs jobs itself and this process should not be started at all — it says so
 * and exits rather than sitting idle pretending to work.
 */
// Must run before loadEnv(): a plain Node process does not read .env itself.
loadEnvFileIfPresent();

async function main(): Promise<void> {
  const env = loadEnv();
  const log = createLogger();

  if (env.QUEUE_DRIVER !== 'redis') {
    log.warn(
      'worker.not_needed',
      'QUEUE_DRIVER is not "redis", so the web process runs jobs inline. Exiting.',
    );
    return;
  }

  const ctx = createPipelineContext(env, { db: prisma });
  const handlers = createJobHandlers(ctx);
  const connection = createRedisConnection(env.REDIS_URL);

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      const type = job.name as JobType;
      const handler = handlers[type];
      if (!handler) throw new Error(`No handler registered for job type "${type}"`);
      await recordJob(job, 'RUNNING');
      try {
        await (handler as (p: JobPayloads[JobType]) => Promise<void>)(job.data);
        await recordJob(job, 'COMPLETED');
      } catch (err) {
        await recordJob(job, 'FAILED', err);
        throw err;
      }
    },
    { connection, concurrency: 2 },
  );

  worker.on('failed', (job, err) => {
    log.error('worker.job_failed', 'job failed', {
      jobId: job?.id,
      type: job?.name,
      attempts: job?.attemptsMade,
      error: err.message,
    });
  });
  worker.on('completed', (job) => {
    log.info('worker.job_completed', 'job completed', { jobId: job.id, type: job.name });
  });

  log.info('worker.started', `worker listening on queue ${QUEUE_NAME}`, { concurrency: 2 });

  const shutdown = async (signal: string): Promise<void> => {
    log.info('worker.shutdown', `received ${signal}, finishing in-flight jobs`);
    await worker.close();
    connection.disconnect();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

async function recordJob(
  job: Job,
  status: 'RUNNING' | 'COMPLETED' | 'FAILED',
  error?: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : error ? String(error) : null;
  await prisma.jobRecord
    .upsert({
      where: { jobId: String(job.id) },
      create: {
        jobId: String(job.id),
        queue: QUEUE_NAME,
        type: job.name,
        status,
        attempts: job.attemptsMade,
        payload: job.data as object,
        ...(status === 'RUNNING' ? { startedAt: new Date() } : {}),
      },
      update: {
        status,
        attempts: job.attemptsMade,
        ...(status === 'RUNNING' ? { startedAt: new Date() } : {}),
        ...(status !== 'RUNNING' ? { finishedAt: new Date() } : {}),
        ...(message ? { error: message.slice(0, 1000) } : {}),
      },
    })
    .catch(() => {});
}

main().catch((err) => {
  console.error('worker failed to start', err);
  process.exit(1);
});
