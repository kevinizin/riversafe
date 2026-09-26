#!/usr/bin/env node
/**
 * Downloads a Receita Federal monthly extraction.
 *
 *   npm run download:br
 *   npm run download:br -- --pasta ./dados-cnpj --mes 2026-09-14
 *
 * Picks the newest monthly folder unless told otherwise, checks what the
 * folder actually contains before starting, and fetches one file at a time —
 * the host rate-limits, so a parallel download finishes sooner right up until
 * it starts getting refused.
 *
 * Safe to interrupt and re-run. Each file resumes from what is already on
 * disk, and a file that is already complete is skipped without transferring
 * anything. An extraction is roughly 6.4 GB across 21 files.
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// Deliberately the module rather than the '@woh/core' barrel: that barrel
// re-exports @woh/db, which loads @prisma/client, so importing it would make a
// six-gigabyte HTTP download refuse to start until the database was generated
// and reachable. Downloading needs neither. This module imports only node:*.
import {
  RECEITA_BASE_URL,
  downloadFile,
  monthlyFiles,
  parseFileListing,
  parseFolderListing,
} from '@woh/core/providers/companies/receita/download';

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
  folder?: string;
  month?: string;
  baseUrl: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { baseUrl: RECEITA_BASE_URL };
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--pasta':
        args.folder = argv[++i];
        break;
      case '--mes':
        args.month = argv[++i];
        break;
      case '--url':
        args.baseUrl = argv[++i] ?? RECEITA_BASE_URL;
        break;
      default:
        throw new Error(`Opção desconhecida: ${argv[i]}`);
    }
  }
  return args;
}

/** A size a human reads at a glance. Municipios.zip is 42 KB and the big
 *  archives are gigabytes, so one fixed unit is wrong for one end or the other. */
function size(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function bar(received: number, total: number | undefined): string {
  if (!total) return size(received);
  const done = Math.min(24, Math.round((received / total) * 24));
  return `[${'#'.repeat(done)}${'.'.repeat(24 - done)}] ${size(received)} / ${size(total)}`;
}

async function readListing(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (cause) {
    // fetch throws a bare "fetch failed" for everything below HTTP: no route,
    // refused connection, DNS, a TLS reset. That tells the operator nothing,
    // and the likeliest cause here is specific enough to name.
    throw new Error(
      `Não consegui nem conectar em ${url}.\n` +
        `  Causa técnica: ${cause instanceof Error ? cause.message : String(cause)}\n\n` +
        `  O servidor da Receita costuma recusar conexões de fora do Brasil, e sai do ar\n` +
        `  com alguma frequência. Abra ${RECEITA_BASE_URL}/ no navegador:\n` +
        `  se abrir aí e não aqui, me avise; se não abrir, é o servidor deles.`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Não consegui ler a listagem em ${url} (HTTP ${response.status}).\n` +
        `  O servidor respondeu, mas recusou. Se for 403, é bloqueio por região.`,
    );
  }
  return response.text();
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const destination = resolve(ROOT, args.folder ?? 'dados-cnpj');

  console.log(`\n  Dados abertos do CNPJ — Receita Federal`);
  console.log(`  ${'='.repeat(38)}\n`);

  let month = args.month;
  if (!month) {
    console.log('  Procurando a extração mais recente...');
    const folders = parseFolderListing(await readListing(`${args.baseUrl}/`));
    month = folders[folders.length - 1];
    if (!month) {
      throw new Error(
        `Nenhuma pasta mensal encontrada em ${args.baseUrl}/.\n` +
          `Abra esse endereço no navegador e passe a pasta com --mes AAAA-MM-DD.`,
      );
    }
    console.log(`  Extração mais recente: ${month}\n`);
  }

  const folderUrl = `${args.baseUrl}/${month}`;

  // Confirm against what the folder actually holds rather than trusting the
  // ten-parts convention: how many parts the Receita publishes is theirs to
  // change, and downloading a list of names that no longer exist would be 21
  // 404s and a confusing afternoon.
  const offered = new Set(parseFileListing(await readListing(`${folderUrl}/`)));
  const wanted = monthlyFiles().filter((f) => offered.has(f));
  const absent = monthlyFiles().filter((f) => !offered.has(f));
  const extra = [...offered].filter(
    (f) => /^(Empresas|Estabelecimentos)\d+\.zip$/i.test(f) && !wanted.includes(f),
  );

  if (wanted.length === 0) {
    throw new Error(
      `A pasta ${month} não tem nenhum dos arquivos esperados.\n` +
        `Ela oferece: ${[...offered].slice(0, 10).join(', ') || '(nada)'}`,
    );
  }
  if (absent.length) {
    console.log(`  Aviso: a pasta não oferece ${absent.join(', ')}.`);
  }
  if (extra.length) {
    console.log(`  A Receita publicou partes a mais desta vez: ${extra.join(', ')}. Baixando também.`);
    wanted.push(...extra);
  }

  console.log(`  ${wanted.length} arquivos para ${destination}`);
  console.log(`  Cerca de 6 GB. Pode interromper e rodar de novo — continua de onde parou.\n`);

  const started = Date.now();
  let transferred = 0;
  let skipped = 0;

  for (const [index, file] of wanted.entries()) {
    const path = resolve(destination, month, file);
    const prefix = `  ${String(index + 1).padStart(2)}/${wanted.length} ${file.padEnd(24)}`;

    const outcome = await downloadFile(`${folderUrl}/${file}`, path, {
      onProgress: ({ received, total }) => {
        process.stdout.write(`\r${prefix} ${bar(received, total)}   `);
      },
    });

    if (outcome.skipped) {
      skipped += 1;
      process.stdout.write(`\r${prefix} já estava completo (${size(outcome.bytes)})${' '.repeat(12)}\n`);
    } else {
      transferred += 1;
      const note = outcome.resumed ? ' (retomado)' : '';
      process.stdout.write(`\r${prefix} pronto ${size(outcome.bytes)}${note}${' '.repeat(12)}\n`);
    }
  }

  const minutes = Math.round((Date.now() - started) / 60_000);
  const at = resolve(destination, month);

  console.log(`
  Pronto em ${minutes} min. ${transferred} baixados, ${skipped} já estavam completos.

  Os arquivos estão em:
    ${at}

  Próximo passo — confira o layout das colunas antes de importar:

    npm run ingest:br -- --inspect

  E depois a importação, só o Amazonas:

    npm run ingest:br -- --uf AM

  Os dois acham esta pasta sozinhos. No Windows, é só dar dois cliques em
  importar-dados.cmd, que faz os dois passos na ordem.
`);
}

main().catch((error) => {
  console.error(`\n  ${error instanceof Error ? error.message : String(error)}\n`);
  if (!existsSync(resolve(ROOT, 'dados-cnpj'))) {
    console.error('  Nada foi baixado. Nenhum arquivo parcial ficou para trás.\n');
  } else {
    console.error('  O que já tinha sido baixado continua lá. Rode o comando de novo para continuar.\n');
  }
  process.exit(1);
});
