#!/usr/bin/env node
/**
 * Imports a Receita Federal monthly snapshot into the local database.
 *
 * Run `npm run download:br` first. With no arguments this then picks up the
 * newest dated folder that left behind and reads every part in it, which is
 * the ordinary case; typing twenty-one paths back in is busywork, and typing
 * them wrongly is the likeliest way to import a subset by accident.
 *
 *   npm run ingest:br -- --inspect
 *   npm run ingest:br -- --uf AM
 *
 * Files elsewhere can still be named:
 *
 *   npm run ingest:br -- --estabelecimentos ./Estabelecimentos*.zip \
 *                        --empresas ./Empresas*.zip \
 *                        --municipios ./Municipios.zip \
 *                        --uf AM --tag 2026-08
 *
 * Run --inspect first, always. The declared column order has not been verified
 * against the official layout document (see layout.ts for why), and --inspect
 * prints the first rows column by column so you can check it against
 * https://www.gov.br/receitafederal/dados/cnpj-metadados.pdf in a couple of
 * minutes. Without that check the import will still refuse to write anything if
 * the rows do not match — but a refusal tells you less than the comparison does.
 */

import { existsSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EMPRESAS_LAYOUT,
  ESTABELECIMENTOS_LAYOUT,
  LayoutMismatchError,
  ingestReceita,
  inspectFile,
} from '@woh/core';
import { loadEnvFileIfPresent } from '../../../scripts/load-env.mjs';
import { prisma } from '@woh/db';

loadEnvFileIfPresent();

/**
 * The repository root, regardless of where npm ran this from.
 *
 * `npm run -w @woh/worker …` sets the working directory to the workspace, so a
 * relative default like `./dados-cnpj` lands in apps/worker rather than beside
 * the launchers — where the operator looked for it, and where the .cmd files
 * check for it.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');


interface Args {
  estabelecimentos: string[];
  empresas: string[];
  municipios?: string;
  ufs: string[];
  tag?: string;
  inspect: boolean;
  /** Where `npm run download:br` put the files. Defaults to ./dados-cnpj. */
  pasta?: string;
}

/**
 * Expands a `*` in a path.
 *
 * Bash does this before the process ever starts, so on Linux it was invisible.
 * PowerShell does not expand inside quotes — and the documented command quotes
 * the paths because Windows paths contain spaces. The result was an argument
 * like `Estabelecimentos*.zip` arriving as a literal filename that cannot
 * exist, which is a confusing way to be told nothing was read.
 */
function expandGlob(pattern: string): string[] {
  if (!pattern.includes('*')) return [pattern];

  const folder = dirname(pattern);
  const name = basename(pattern);
  const matcher = new RegExp(
    `^${name.split('*').map(escapeRegExp).join('.*')}$`,
    // Windows filenames are case-insensitive, and the Receita's own casing has
    // changed between extractions before.
    'i',
  );

  let entries: string[];
  try {
    entries = readdirSync(folder);
  } catch {
    return [];
  }

  return entries
    .filter((entry) => matcher.test(entry))
    .sort()
    .map((entry) => join(folder, entry));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

function parseArgs(argv: string[]): Args {
  const args: Args = { estabelecimentos: [], empresas: [], ufs: [], inspect: false };
  let current: 'estabelecimentos' | 'empresas' | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    switch (arg) {
      case '--inspect':
        args.inspect = true;
        current = null;
        break;
      case '--estabelecimentos':
        current = 'estabelecimentos';
        break;
      case '--empresas':
        current = 'empresas';
        break;
      case '--municipios':
        args.municipios = argv[++i];
        current = null;
        break;
      case '--uf':
        args.ufs.push(...(argv[++i] ?? '').split(',').filter(Boolean));
        current = null;
        break;
      case '--tag':
        args.tag = argv[++i];
        current = null;
        break;
      case '--pasta':
        args.pasta = argv[++i];
        current = null;
        break;
      default:
        // A bare path continues whichever list was last named, so a shell glob
        // expanding to several files works without repeating the flag.
        if (arg.startsWith('--')) throw new Error(`Unknown option ${arg}`);
        if (!current) throw new Error(`Path "${arg}" does not follow --estabelecimentos or --empresas.`);
        args[current].push(...expandGlob(arg));
    }
  }

  return args;
}

/**
 * The newest extraction folder `npm run download:br` left behind.
 *
 * Having downloaded the files, being asked to type their paths back in is
 * busywork, and typing them wrongly is the most likely way to end up importing
 * a subset by accident.
 */
function discoverDownload(folder: string): { path: string; month: string } | undefined {
  let months: string[];
  try {
    months = readdirSync(folder).filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry));
  } catch {
    return undefined;
  }
  const month = months.sort().pop();
  return month ? { path: join(folder, month), month } : undefined;
}

/** The month a snapshot belongs to, when the operator has not said. */
function defaultTag(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Nothing named: fall back to what the download command produced. This is
  // the ordinary case, and spelling out twenty-one paths is not.
  let discoveredMonth: string | undefined;
  if (!args.estabelecimentos.length && !args.empresas.length) {
    const found = discoverDownload(resolve(ROOT, args.pasta ?? 'dados-cnpj'));
    if (found) {
      args.estabelecimentos = expandGlob(join(found.path, 'Estabelecimentos*.zip'));
      args.empresas = expandGlob(join(found.path, 'Empresas*.zip'));
      const municipios = join(found.path, 'Municipios.zip');
      if (existsSync(municipios)) args.municipios = municipios;
      discoveredMonth = found.month;

      console.log(`Usando a extração de ${found.month} em ${found.path}`);
      console.log(
        `  ${args.estabelecimentos.length} arquivo(s) de estabelecimentos, ` +
          `${args.empresas.length} de empresas\n`,
      );
    }
  }

  if (!args.estabelecimentos.length) {
    console.error(
      'Nenhum arquivo para ler.\n\n' +
        'Baixe a extração primeiro:\n' +
        '  npm run download:br\n\n' +
        'Ou aponte os arquivos você mesmo:\n' +
        '  npm run ingest:br -- --inspect --estabelecimentos ./Estabelecimentos0.zip\n',
    );
    process.exit(1);
  }

  if (args.inspect) {
    // One file of each is enough to read a column layout, and inspecting all
    // twenty-one would bury the answer in output nobody reads.
    for (const file of args.estabelecimentos.slice(0, 1)) {
      console.log(await inspectFile(file, ESTABELECIMENTOS_LAYOUT));
    }
    for (const file of args.empresas) {
      console.log(await inspectFile(file, EMPRESAS_LAYOUT));
    }
    console.log(
      'Compare com https://www.gov.br/receitafederal/dados/cnpj-metadados.pdf\n' +
        'Se alguma coluna estiver no lugar errado, corrija em\n' +
        '  packages/core/src/providers/companies/receita/layout.ts\n' +
        'e rode --inspect de novo antes de importar.',
    );
    return;
  }

  if (!args.empresas.length) {
    console.error(
      'Não importo sem os arquivos de Empresas: o de Estabelecimentos não traz razão\n' +
        'social, porte nem capital, então todo lead ficaria sem nome e sem porte.',
    );
    process.exit(1);
  }

  const ufs = args.ufs.length ? args.ufs : ['AM'];
  // The extraction date is a better tag than today's month: it says which
  // snapshot the answers come from, which is the question the UI asks.
  const tag = args.tag ?? discoveredMonth ?? defaultTag();

  console.log(`Importando a extração ${tag}, mantendo ${ufs.join(', ')}.`);
  console.log('Nada é gravado enquanto as linhas conferidas não baterem com o layout.\n');

  const started = Date.now();
  const result = await ingestReceita(prisma, {
    estabelecimentos: args.estabelecimentos,
    empresas: args.empresas,
    ...(args.municipios ? { municipios: args.municipios } : {}),
    ufs,
    importTag: tag,
    onProgress: ({ read, kept }) => {
      process.stdout.write(
        `\r  li ${read.toLocaleString('pt-BR')} linhas, guardei ${kept.toLocaleString('pt-BR')}   `,
      );
    },
  });

  const seconds = Math.round((Date.now() - started) / 1000);

  // The loudest thing on the screen when it applies. The Receita splits each
  // table into numbered parts and the split is arbitrary, not by state, so a
  // company in Manaus can be in any of them. Importing some of the parts gives
  // a database that looks complete and quietly is not.
  const gaps: string[] = [];
  if (result.missingEstabelecimentos.length) {
    gaps.push(
      `  Estabelecimentos: faltam as partes ${result.missingEstabelecimentos.join(', ')} ` +
        `(li ${result.estabelecimentosFiles} arquivo(s))`,
    );
  }
  if (result.missingEmpresas.length) {
    gaps.push(
      `  Empresas: faltam as partes ${result.missingEmpresas.join(', ')} ` +
        `(li ${result.empresasFiles} arquivo(s))`,
    );
  }
  console.log(`\n
Concluído em ${seconds}s.

  linhas lidas         ${result.establishmentsRead.toLocaleString('pt-BR')}
  guardadas (${ufs.join(', ')})${' '.repeat(Math.max(1, 10 - ufs.join(', ').length))}${result.establishmentsKept.toLocaleString('pt-BR')}
  registros de empresa ${result.companiesMatched.toLocaleString('pt-BR')}
  municípios           ${result.municipalitiesLoaded.toLocaleString('pt-BR')}

As buscas pelo Brasil agora respondem da extração ${tag}. Rode uma no painel —
os resultados carregam essa data, para ficar claro o quanto estão atualizados.
`);

  if (gaps.length) {
    console.warn(
      `ATENÇÃO — a importação está incompleta:\n\n${gaps.join('\n')}\n\n` +
        `  A Receita divide cada tabela em partes numeradas, e a divisão é arbitrária —\n` +
        `  não é por estado. Uma empresa de Manaus pode estar em qualquer uma delas, então\n` +
        `  o que foi importado parece completo e não é. Baixe as partes que faltam e rode\n` +
        `  o comando de novo com todas de uma vez.\n`,
    );
  }
}

main()
  .catch((error) => {
    if (error instanceof LayoutMismatchError) {
      // Already a full explanation; a stack trace on top of it only buries the
      // part that says what to do.
      console.error(`\n${error.message}\n`);
      process.exit(2);
    }
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
