import 'server-only';
import { loadEnv } from '@woh/config';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'woh_session';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface SessionPayload {
  userId: string;
  email: string;
  role: 'ADMIN' | 'USER';
}

function secret(): Uint8Array {
  return new TextEncoder().encode(loadEnv().AUTH_SECRET);
}

/**
 * Sessions are signed JWTs in an httpOnly cookie.
 *
 * SameSite=Lax is what makes Next.js server actions safe from cross-site POSTs;
 * combined with Next's own origin check it removes the need for a separate CSRF
 * token. The cookie is Secure whenever the app is not served over plain http.
 */
export async function createSession(payload: SessionPayload): Promise<void> {
  const env = loadEnv();
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .setSubject(payload.userId)
    .sign(secret());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.APP_URL.startsWith('https://'),
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    if (typeof payload.userId !== 'string' || typeof payload.email !== 'string') return null;
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role === 'ADMIN' ? 'ADMIN' : 'USER',
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
