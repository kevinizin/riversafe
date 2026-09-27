import { PrismaClient } from '@prisma/client';

/**
 * A single PrismaClient per process. Next.js dev-mode hot reload re-evaluates
 * modules, so the instance is parked on globalThis to avoid exhausting the
 * Postgres connection pool.
 */
const globalForPrisma = globalThis as unknown as { __wohPrisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.__wohPrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.__wohPrisma = prisma;

export type Db = PrismaClient;
