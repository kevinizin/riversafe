import { prisma } from '@woh/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Liveness and readiness for a load balancer.
 *
 * Deliberately unauthenticated and deliberately uninformative: it reports
 * whether the process can serve traffic, and nothing about configuration.
 */
export async function GET(): Promise<NextResponse> {
  const startedAt = Date.now();
  let database = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }

  return NextResponse.json(
    { status: database ? 'ok' : 'degraded', database, checkedInMs: Date.now() - startedAt },
    { status: database ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
