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
say('Conferindo o Node');
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 20 || (major === 20 && minor < 11)) {
  fail(
    `O Node ${process.versions.node} é antigo demais; este projeto precisa da versão 20.11 ou mais nova.`,
    'Instale um Node atual em https://nodejs.org e rode isto de novo.',
  );
}
ok(`Node ${process.versions.node}`);

// --- 2. Environment file ----------------------------------------------------
say('Preparando o .env');
if (existsSync(envPath)) {
  ok('.env já existe, deixando exatamente como está');
} else {
  copyFileSync(examplePath, envPath);
  const secret = randomBytes(48).toString('base64');
  writeFileSync(
    envPath,
    readFileSync(envPath, 'utf8').replace(/^AUTH_SECRET=.*$/m, `AUTH_SECRET=${secret}`),
  );
  ok('.env criado com um AUTH_SECRET gerado na hora');
  warn('Nenhuma fonte de dados reais ainda, então as buscas vão usar as empresas fictícias de demonstração.');
}

const databaseUrl = readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim() ?? '';
if (!databaseUrl) fail('Falta o DATABASE_URL no .env.');

// --- 3. Dependencies --------------------------------------------------------
say('Instalando dependências');
if (existsSync(join(root, 'node_modules', '.package-lock.json'))) {
  ok('node_modules já existe, pulando a instalação');
} else {
  run('npm install --no-audit --no-fund');
  ok('dependências instaladas');
}

// --- 4. Database ------------------------------------------------------------
say('Conectando ao PostgreSQL');
run('npm run db:generate --silent');

const migrate = () =>
  tryRun('npx dotenv -e ../../.env -- prisma migrate deploy', {
    cwd: join(root, 'packages', 'db'),
    quiet: true,
  });

let migrated = migrate();

if (!migrated) {
  warn('Não consegui alcançar o banco de dados.');
  if (has('docker')) {
    console.log('    Subindo PostgreSQL e Redis com o Docker Compose...');
    if (!tryRun('docker compose up -d')) {
      fail(
        'O Docker está instalado mas não respondeu, então o banco não pôde ser iniciado.',
        [
          'O mais provável é que o Docker Desktop ainda não esteja rodando. Abra-o,',
          'espere ele dizer "Running", e rode de novo: npm run setup',
          '',
          'Ou pule o Docker: aponte o DATABASE_URL do .env para qualquer PostgreSQL 16',
          'que você alcance — uma instalação local ou uma hospedada gratuita — e rode',
          'o mesmo comando de novo.',
        ].join('\n'),
      );
    }
    process.stdout.write('    Esperando o PostgreSQL');
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (tryRun('docker compose exec -T postgres pg_isready -U woh', { quiet: true })) break;
      process.stdout.write('.');
      sleep(1000);
    }
    console.log('');
    migrated = migrate();
  } else {
    warn('O Docker não está instalado, então o banco não pode ser iniciado automaticamente.');
  }
}

if (!migrated) {
  fail(
    `Não consigo alcançar o banco em ${databaseUrl.replace(/:\/\/[^@]*@/, '://***@')}`,
    [
      'Aponte o DATABASE_URL do .env para um PostgreSQL 16 que você alcance. Pode ser:',
      '',
      '  - um banco hospedado gratuito (Neon, Supabase, Railway): crie um, copie a',
      '    string de conexão para o .env e rode de novo. Nada a instalar.',
      '  - Docker Desktop: instale, abra e rode de novo — este script sobe o banco',
      '    para você.',
      '  - um PostgreSQL local: crie um banco e aponte o DATABASE_URL para ele.',
      '',
      'O arquivo .env está nesta pasta. Edite a linha do DATABASE_URL e rode de novo:',
      '  npm run setup',
    ].join('\n'),
  );
}
ok('esquema aplicado');

// --- 5. Demo data -----------------------------------------------------------
say('Populando com os dados fictícios de demonstração');
if (!tryRun('npm run db:seed --silent')) {
  fail(
    'A carga de demonstração não terminou.',
    'O esquema está no lugar, então o sistema ainda sobe com o banco vazio.\nRode "npm run db:seed" sozinho para ver o erro completo.',
  );
}

// --- 6. Desktop shortcut ----------------------------------------------------
// Created here rather than left for the reader to find. The launcher and the
// script that pins it to the desktop were both documented in the README, and
// someone who had run this setup end to end still had nothing to click —
// because nothing at the end of a successful setup ever mentioned them.
let shortcut = false;
if (process.platform === 'win32') {
  say('Colocando um atalho na área de trabalho');
  shortcut = tryRun('create-desktop-shortcut.cmd', { quiet: true });
  if (shortcut) ok('"Azven" adicionado à área de trabalho');
  else warn('Não foi possível criar o atalho. Rode create-desktop-shortcut.cmd você mesmo, ou inicie com start.cmd.');
}

// --- 7. Done ----------------------------------------------------------------
const howToStart =
  process.platform === 'win32'
    ? shortcut
      ? `  Dê dois cliques em ${bold('Azven')} na sua área de trabalho.`
      : `  Dê dois cliques em ${bold('start.cmd')} nesta pasta.`
    : `  Rode ${bold('./start.sh')} nesta pasta.`;

console.log(`
${green(bold('Pronto.'))}

${howToStart}
  Ele abre ${bold('http://localhost:3000')} sozinho assim que o servidor responder.

  Entre com as credenciais impressas logo acima (demo@example.com).
  Toda empresa que você vai ver é fictícia, e o painel avisa isso no topo.

  Prefere terminal? ${bold('npm run dev')} faz o mesmo sem abrir o navegador.

  Para buscar empresas brasileiras de verdade, importe um arquivo mensal da
  Receita Federal:  ${bold('npm run ingest:br -- --inspect --estabelecimentos <arquivo>')}
  Veja o README para o passo a passo completo.
`);
