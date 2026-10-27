import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/env";
import { hashPassword, passwordVersion, verifyPassword } from "@/lib/password";
import { readFile, writeFile } from "@/lib/store";

/**
 * Login do painel.
 * - Usuário e hash da senha vêm de data/auth.json (Blob privado) ou, antes da
 *   primeira troca de senha, das variáveis ADMIN_USER / ADMIN_PASSWORD_HASH.
 * - A sessão é um cookie httpOnly assinado com HMAC (SESSION_SECRET), válido
 *   por 7 dias e invalidado automaticamente quando a senha muda.
 */

export const SESSION_COOKIE = "sofi_session";
const SESSION_DAYS = 7;
const AUTH_FILE = "data/auth.json";

type Credentials = { user: string; hash: string };

function secret(): Buffer {
  const s = process.env.SESSION_SECRET ?? "";
  if (s.length < 32) throw new Error("SESSION_SECRET ausente ou curto demais.");
  return Buffer.from(s);
}

async function getCredentials(): Promise<Credentials | null> {
  const file = await readFile(AUTH_FILE);
  if (file) return JSON.parse(file.data.toString("utf8")) as Credentials;
  const user = process.env.ADMIN_USER;
  const hash = process.env.ADMIN_PASSWORD_HASH;
  return user && hash ? { user, hash } : null;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function createToken(creds: Credentials) {
  const payload = Buffer.from(
    JSON.stringify({
      u: creds.user,
      v: passwordVersion(creds.hash),
      exp: Date.now() + SESSION_DAYS * 86_400_000,
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

async function readSession(): Promise<{ user: string } | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  let data: { u: string; v: string; exp: number };
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof data.exp !== "number" || data.exp < Date.now()) return null;

  const creds = await getCredentials();
  if (!creds || data.u !== creds.user || data.v !== passwordVersion(creds.hash)) return null;
  return { user: creds.user };
}

async function setSessionCookie(creds: Credentials) {
  (await cookies()).set(SESSION_COOKIE, createToken(creds), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

/** Barreira de toda página e ação do painel. */
export async function requireAdmin() {
  if (isDemoMode) redirect("/admin/login");
  const session = await readSession();
  if (!session) redirect("/admin/login");
  return session;
}

export async function isLoggedIn() {
  if (isDemoMode) return false;
  return !!(await readSession());
}

// --------------------------------------------------------------------------
// Limite de tentativas: 5 erros seguidos bloqueiam por 15 minutos.
// (Por instância do servidor; somado ao custo do scrypt e à espera fixa,
// torna inviável tentar adivinhar a senha.)
// --------------------------------------------------------------------------

const attempts = new Map<string, { fails: number; until: number }>();
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60_000;

async function clientKey() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "local").split(",")[0].trim();
}

export type LoginResult = "ok" | "invalid" | "locked";

export async function login(user: string, password: string): Promise<LoginResult> {
  const key = await clientKey();
  const entry = attempts.get(key);
  if (entry && entry.until > Date.now()) return "locked";

  const creds = await getCredentials();
  const ok =
    !!creds &&
    user.trim().toLowerCase() === creds.user.toLowerCase() &&
    (await verifyPassword(password, creds.hash));

  if (!ok) {
    const fails = (entry?.fails ?? 0) + 1;
    attempts.set(key, { fails, until: fails >= MAX_FAILS ? Date.now() + LOCK_MS : 0 });
    await new Promise((r) => setTimeout(r, 400));
    return fails >= MAX_FAILS ? "locked" : "invalid";
  }

  attempts.delete(key);
  await setSessionCookie(creds!);
  return "ok";
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function changePassword(current: string, next: string): Promise<boolean> {
  const creds = await getCredentials();
  if (!creds || !(await verifyPassword(current, creds.hash))) return false;
  const updated = { user: creds.user, hash: await hashPassword(next) };
  await writeFile(AUTH_FILE, JSON.stringify(updated), "application/json");
  await setSessionCookie(updated); // mantém este aparelho logado; os outros saem
  return true;
}
