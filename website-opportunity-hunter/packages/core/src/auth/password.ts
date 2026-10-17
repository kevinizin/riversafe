import bcrypt from 'bcryptjs';

/** Cost factor. 12 is a reasonable 2020s default for an interactive login. */
const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < 10) throw new Error('Password must be at least 10 characters');
  return bcrypt.hash(plain, ROUNDS);
}

/**
 * Constant-time-ish verification. bcrypt.compare already resists timing attacks
 * on the hash comparison; the `catch` keeps a malformed stored hash from
 * throwing an unhandled error into the login route.
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/** Minimum policy enforced at every entry point that sets a password. */
export function passwordProblems(plain: string): string[] {
  const problems: string[] = [];
  if (plain.length < 10) problems.push('must be at least 10 characters');
  if (!/[a-z]/i.test(plain)) problems.push('must contain a letter');
  if (!/\d/.test(plain)) problems.push('must contain a digit');
  return problems;
}
