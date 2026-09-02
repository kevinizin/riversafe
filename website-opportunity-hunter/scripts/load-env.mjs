import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Loads the repository-root `.env` into `process.env`.
 *
 * Configuration lives in one file at the root, but nothing reads it there by
 * default: Next.js looks in the app directory, and a plain Node process does
 * not look anywhere. Without this, a fresh clone starts with no DATABASE_URL
 * and fails with "Required", which reads like a missing variable rather than an
 * unread file.
 *
 * Variables already present always win. On a hosting platform the real
 * environment is authoritative, and a stray `.env` inside an image must never
 * override it. Absent file: no-op.
 *
 * Deliberately dependency-free and plain ESM so the Next config, the worker and
 * the setup script can all share one implementation.
 */
export function loadEnvFileIfPresent() {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const path = join(root, '.env');
  if (!existsSync(path)) return;

  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    if (!key || key in process.env) continue;

    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
