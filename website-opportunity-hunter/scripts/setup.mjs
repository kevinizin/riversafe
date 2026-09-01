#!/usr/bin/env node
/**
 * One-command local setup.
 *
 * Takes a clean clone from nothing to a running dashboard with demo data:
 * writes a .env with a real secret, installs dependencies, starts PostgreSQL if
 * Docker is available, applies migrations and seeds the fictional dataset.
 *
 * Safe to re-run: an existing .env is never overwritten, migrations are
 * idempotent, and the seed upserts.
 */

import { execSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = join(root, '.env');
const examplePath = join(root, '.env.example');

// Written as an escape sequence rather than a literal control byte, which
// diffs and editors mangle.
const ESC = '\u001b[';
const colour = (code, text) => (process.stdout.isTTY ? `${ESC}${code}m${text}${ESC}0m` : text);
const bold = (t) => colour('1', t);
const green = (t) => colour('32', t);
const yellow = (t) => colour('33', t);
const red = (t) => colour('31', t);

let step = 0;
const say = (message) => console.log(`\n${bold(`[${++step}]`)} ${message}`);
const ok = (message) => console.log(`    ${green('OK')} ${message}`);
const warn = (message) => console.log(`    ${yellow('!')} ${message}`);

function run(command, options = {}) {
  execSync(command, { cwd: root, stdio: 'inherit', ...options });
}

function tryRun(command, options = {}) {
  const { quiet, ...rest } = options;
  const result = spawnSync(command, {
    cwd: root,
    shell: true,
    stdio: quiet ? 'pipe' : 'inherit',
    ...rest,
  });
  return result.status === 0;
}

function has(command) {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  return spawnSync(probe, [command], { stdio: 'ignore' }).status === 0;
}

/** Blocking sleep. Keeps the wait loop readable without an async main(). */
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function fail(message, hint) {
  console.error(`\n${red('Setup stopped:')} ${message}`);
  if (hint) console.error(`\n${hint}\n`);
  process.exit(1);
}

// --- 1. Node version --------------------------------------------------------
say('Checking Node');
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 20 || (major === 20 && minor < 11)) {
  fail(
    `Node ${process.versions.node} is too old; this project needs 20.11 or newer.`,
    'Install a current Node from https://nodejs.org and run this again.',
  );
}
ok(`Node ${process.versions.node}`);

// --- 2. Environment file ----------------------------------------------------
say('Preparing .env');
if (existsSync(envPath)) {
  ok('.env already exists, leaving it exactly as it is');
} else {
  copyFileSync(examplePath, envPath);
  const secret = randomBytes(48).toString('base64');
  writeFileSync(
    envPath,
    readFileSync(envPath, 'utf8').replace(/^AUTH_SECRET=.*$/m, `AUTH_SECRET=${secret}`),
  );
  ok('.env created with a freshly generated AUTH_SECRET');
  warn('No Companies House key yet, so searches will use the fictional demo dataset.');
}

const databaseUrl = readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim() ?? '';
if (!databaseUrl) fail('DATABASE_URL is missing from .env.');

// --- 3. Dependencies --------------------------------------------------------
say('Installing dependencies');
if (existsSync(join(root, 'node_modules', '.package-lock.json'))) {
  ok('node_modules is already present, skipping install');
} else {
  run('npm install --no-audit --no-fund');
  ok('dependencies installed');
}

// --- 4. Database ------------------------------------------------------------
say('Connecting to PostgreSQL');
run('npm run db:generate --silent');

const migrate = () =>
  tryRun('npx dotenv -e ../../.env -- prisma migrate deploy', {
    cwd: join(root, 'packages', 'db'),
    quiet: true,
  });

let migrated = migrate();

if (!migrated) {
  warn('Could not reach the database.');
  if (has('docker')) {
    console.log('    Starting PostgreSQL and Redis with Docker Compose...');
    if (!tryRun('docker compose up -d')) {
      fail(
        'Docker is installed but did not answer, so the database could not be started.',
        [
          'Most likely Docker Desktop is not running yet. Open it, wait until it',
          'reports "Running", then re-run: npm run setup',
          '',
          'Or skip Docker entirely: point DATABASE_URL in .env at any PostgreSQL 16',
          'you can reach — a local install or a free hosted one — and re-run the same',
          'command.',
        ].join('\n'),
      );
    }
    process.stdout.write('    Waiting for PostgreSQL');
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (tryRun('docker compose exec -T postgres pg_isready -U woh', { quiet: true })) break;
      process.stdout.write('.');
      sleep(1000);
    }
    console.log('');
    migrated = migrate();
  } else {
    warn('Docker is not installed, so the database cannot be started automatically.');
  }
}

if (!migrated) {
  fail(
    `Cannot reach the database at ${databaseUrl.replace(/:\/\/[^@]*@/, '://***@')}`,
    [
      'Point DATABASE_URL in .env at a PostgreSQL 16 you can reach. Any of:',
      '',
      '  - a free hosted database (Neon, Supabase, Railway): create one, copy its',
      '    connection string into .env, and re-run. Nothing to install.',
      '  - Docker Desktop: install it, start it, and re-run — this script will',
      '    bring the database up for you.',
      '  - a local PostgreSQL install: create a database and point DATABASE_URL at it.',
      '',
      'The .env file is in this folder. Edit the DATABASE_URL line, then re-run:',
      '  npm run setup',
    ].join('\n'),
  );
}
ok('schema applied');

// --- 5. Demo data -----------------------------------------------------------
say('Seeding fictional demo data');
if (!tryRun('npm run db:seed --silent')) {
  fail(
    'The seed did not complete.',
    'The schema is in place, so the app will still start with an empty database.\nRun "npm run db:seed" on its own to see the full error.',
  );
}

// --- 6. Done ----------------------------------------------------------------
console.log(`
${green(bold('Ready.'))}

  ${bold('npm run dev')}      then open ${bold('http://localhost:3000')}

  Sign in with the credentials printed just above (demo@example.com).
  Every company you will see is fictional, and the dashboard says so at the top.

  To search real UK companies, get a free key at
  https://developer.company-information.service.gov.uk/
  put it in .env as COMPANIES_HOUSE_API_KEY, and run a new search.
`);
