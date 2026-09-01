import 'server-only';
import { verifyPassword } from '@woh/core';
import { prisma } from '@woh/db';
import { redirect } from 'next/navigation';
import { createSession, destroySession, readSession, type SessionPayload } from './session.js';

export interface CurrentUser extends SessionPayload {
  name: string;
}

/** The signed-in user, or null. Re-checks the database so a disabled account
 *  loses access immediately rather than at cookie expiry. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await readSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.isActive) return null;
  return { userId: user.id, email: user.email, role: user.role, name: user.name };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') redirect('/');
  return user;
}

export type LoginResult = { ok: true } | { ok: false; error: string };

/**
 * Verifies credentials.
 *
 * The failure message is identical for an unknown email and a wrong password so
 * the form cannot be used to enumerate accounts, and a dummy hash comparison
 * runs for unknown emails so the response time does not leak existence either.
 */
const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEe.uCS9nBIvUB0Wp8Q2H1yEfC0V2AbEyOy';

export async function login(email: string, password: string): Promise<LoginResult> {
  const normalised = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalised } });
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !user.isActive || !ok) {
    await prisma.auditLog
      .create({
        data: { action: 'login.failed', entity: 'user', entityId: normalised },
      })
      .catch(() => {});
    return { ok: false, error: 'Email or password is incorrect.' };
  }

  await createSession({ userId: user.id, email: user.email, role: user.role });
  await prisma.auditLog
    .create({ data: { userId: user.id, action: 'login.success', entity: 'user', entityId: user.id } })
    .catch(() => {});
  return { ok: true };
}

export async function logout(): Promise<void> {
  const session = await readSession();
  if (session) {
    await prisma.auditLog
      .create({ data: { userId: session.userId, action: 'logout', entity: 'user', entityId: session.userId } })
      .catch(() => {});
  }
  await destroySession();
}

/** Records an action against an entity. Never throws into the caller. */
export async function audit(
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await prisma.auditLog
    .create({
      data: {
        userId,
        action,
        entity,
        entityId: entityId ?? null,
        ...(metadata ? { metadata: metadata as object } : {}),
      },
    })
    .catch(() => {});
}
