#!/usr/bin/env node
/**
 * Imports a Receita Federal monthly snapshot into the local database.
 *
 * The files are not downloaded by this script, deliberately. They are several
 * gigabytes, the host rate-limits and sometimes refuses non-Brazilian
 * connections, and a half-finished download that looks like a finished one is
 * the worst outcome available. Download them with a browser or a resumable
 * downloader, then point this at what you have.
 *
 *   npm run ingest:br -- --inspect --estabelecimentos ./Estabelecimentos0.zip
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

interface Args {
  estabelecimentos: string[];
  empresas: string[];
  municipios?: string;
  ufs: string[];
  tag?: string;
  inspect: boolean;
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
      default:
        // A bare path continues whichever list was last named, so a shell glob
        // expanding to several files works without repeating the flag.
        if (arg.startsWith('--')) throw new Error(`Unknown option ${arg}`);
        if (!current) throw new Error(`Path "${arg}" does not follow --estabelecimentos or --empresas.`);
        args[current].push(arg);
    }
  }

  return args;
}

/** The month a snapshot belongs to, when the operator has not said. */
function defaultTag(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.estabelecimentos.length) {
    console.error(
      'Nothing to read. Pass at least --estabelecimentos <file…>.\n\n' +
        'Example:\n' +
        '  npm run ingest:br -- --inspect --estabelecimentos ./Estabelecimentos0.zip\n',
    );
    process.exit(1);
  }

  if (args.inspect) {
    for (const file of args.estabelecimentos) {
      console.log(await inspectFile(file, ESTABELECIMENTOS_LAYOUT));
    }
    for (const file of args.empresas) {
      console.log(await inspectFile(file, EMPRESAS_LAYOUT));
    }
    console.log(
      'Check these against https://www.gov.br/receitafederal/dados/cnpj-metadados.pdf.\n' +
        'If a column is in the wrong place, correct it in\n' +
        '  packages/core/src/providers/companies/receita/layout.ts\n' +
        'and run --inspect again before importing.',
    );
    return;
  }

  if (!args.empresas.length) {
    console.error(
      'Refusing to import without --empresas: the establishments file carries no\n' +
        'company name, porte or capital, so every lead would be nameless and unsized.',
    );
    process.exit(1);
  }

  const ufs = args.ufs.length ? args.ufs : ['AM'];
  const tag = args.tag ?? defaultTag();

  console.log(`Importing snapshot ${tag}, keeping ${ufs.join(', ')}.`);
  console.log('Nothing is written until the sampled rows match the declared layout.\n');

  const started = Date.now();
  const result = await ingestReceita(prisma, {
    estabelecimentos: args.estabelecimentos,
    empresas: args.empresas,
    ...(args.municipios ? { municipios: args.municipios } : {}),
    ufs,
    importTag: tag,
    onProgress: ({ read, kept }) => {
      process.stdout.write(`\r  read ${read.toLocaleString()} rows, kept ${kept.toLocaleString()}   `);
    },
  });

  const seconds = Math.round((Date.now() - started) / 1000);
  console.log(`\n
Done in ${seconds}s.

  rows read          ${result.establishmentsRead.toLocaleString()}
  kept (${ufs.join(', ')})${' '.repeat(Math.max(1, 12 - ufs.join(', ').length))}${result.establishmentsKept.toLocaleString()}
  company records    ${result.companiesMatched.toLocaleString()}
  municipalities     ${result.municipalitiesLoaded.toLocaleString()}

Searches for Brazil will now answer from snapshot ${tag}. Run one from the
dashboard; the results carry that tag so it is clear how fresh they are.
`);
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
