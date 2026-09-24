#!/usr/bin/env node
/**
 * Brings a checkout up to date before the server starts.
 *
 * This exists because of a specific way the launchers used to fail. They
 * rebuilt only when `apps/web/.next/BUILD_ID` was missing, which is right on a
 * first run and wrong after every `git pull`: the old build is still there, so
 * the launcher happily serves last week's code and the person sees none of the
 * changes they just pulled. Worse, a pull that brings new migrations leaves the
 * database a version behind the code, which fails at the first query against a
 * new column rather than at startup where it would be obvious.
 *
 * So both launchers call this first. It is idempotent and quiet when there is
 * nothing to do: on an unchanged checkout it adds a second or two.
 *
 * Run directly to do the same by hand:
 *   node scripts/prepare.mjs
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const buildIdPath = join(root, 'apps', 'web', '.next', 'BUILD_ID');
/** Records which commit produced the build sitting in .next. */
const stampPath = join(root, 'apps', 'web', '.next', 'BUILT_FROM');

const ESC = '\u001b[';
const colour = (code, text) => (process.stdout.isTTY ? `${ESC}${code}m${text}${ESC}0m` : text);
const bold = (t) => colour('1', t);
const green = (t) => colour('32', t);
const red = (t) => colour('31', t);

const say = (message) => console.log(`  ${message}`);
const ok = (message) => console.log(`  ${green('OK')} ${message}`);

function run(command, options = {}) {
  return spawnSync(command, { cwd: root, shell: true, stdio: 'inherit', ...options }).status === 0;
}

function capture(command) {
  try {
    return execSync(command, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

function fail(message, hint) {
  console.error(`\n  ${red('Stopped:')} ${message}`);
  if (hint) console.error(`\n${hint}\n`);
  process.exit(1);
}

// --- Dependencies ------------------------------------------------------------
// A pull that changes package-lock.json needs an install before anything else
// will even parse. Checking the lockfile's own recorded state is cheaper and
// more honest than running a full install every time.
if (!existsSync(join(root, 'node_modules', '.package-lock.json'))) {
  say('Installing dependencies. First run only — a couple of minutes.');
  if (!run('npm install --no-audit --no-fund')) fail('Dependencies could not be installed.');
  ok('dependencies installed');
}

// --- Database ----------------------------------------------------------------
// `migrate deploy` applies whatever is pending and does nothing when the
// database is already current. It never prompts and never drops anything, which
// is what makes it safe to run on every start; `migrate dev` is the one that
// can offer to reset, and it is deliberately not used here.
say('Checking the database...');
if (!run('npm run db:generate --silent', { stdio: 'ignore' })) {
  fail('The database client could not be generated.');
}

const migrated = spawnSync('npx dotenv -e ../../.env -- prisma migrate deploy', {
  cwd: join(root, 'packages', 'db'),
  shell: true,
  stdio: 'pipe',
});

if (migrated.status !== 0) {
  const output = `${migrated.stdout ?? ''}${migrated.stderr ?? ''}`.toString();
  fail(
    'Could not reach the database, so migrations were not applied.',
    [
      'Check that PostgreSQL is running:',
      '',
      '  Windows:      sc query postgresql-x64-16',
      '  macOS/Linux:  pg_isready',
      '',
      'If DATABASE_URL in .env is wrong or missing, run: npm run setup',
      '',
      output.split('\n').filter(Boolean).slice(-4).join('\n'),
    ].join('\n'),
  );
}
ok('database schema is up to date');

// --- Build -------------------------------------------------------------------
// Rebuild when the commit that produced the current build is not the commit
// checked out now. Falling back to "rebuild" whenever either side is unknown is
// deliberate: an unnecessary build costs a minute, while serving a stale one
// costs a confusing hour.
const head = capture('git rev-parse HEAD');
const dirty = capture('git status --porcelain') !== '';
const builtFrom = existsSync(stampPath) ? readFileSync(stampPath, 'utf8').trim() : '';

let reason = '';
if (!existsSync(buildIdPath)) reason = 'no build yet';
else if (!head) reason = 'cannot tell which commit is checked out';
else if (!builtFrom) reason = 'the existing build does not say which commit it came from';
else if (builtFrom !== head) reason = 'the code has changed since the last build';
else if (dirty) reason = 'there are uncommitted changes';

if (reason) {
  say(`Building — ${reason}. A minute or two.`);
  if (!run('npm run build')) fail('The build failed.');
  if (head) writeFileSync(stampPath, `${head}\n`);
  ok('build up to date');
} else {
  ok('build is current');
}

console.log(`\n  ${bold('Ready.')}\n`);
