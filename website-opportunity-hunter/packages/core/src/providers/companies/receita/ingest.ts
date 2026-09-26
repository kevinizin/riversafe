/**
 * Loading the Receita Federal monthly files into the staging table.
 *
 * The shape of the job is decided by two things about the source data:
 *
 *  - It is published as whole-country monthly snapshots, so an import is a
 *    replacement, not a merge. That is why it writes to its own table and never
 *    touches `companies` directly — a re-import must not wipe the enrichment,
 *    CRM state and notes accumulated against a lead.
 *  - It is far too large to hold in memory. Everything here streams and
 *    discards, and the UF filter is applied as rows go past rather than
 *    afterwards, which is what makes a single state tractable on a laptop.
 *
 * The join is the awkward part. `Estabelecimentos` carries the address, the
 * CNAE and the status; `Empresas` carries the name, the porte and the capital.
 * They join on the 8-digit CNPJ root. Doing it in one pass would mean holding
 * one of the two tables in memory, so `Empresas` is read first into a map
 * restricted to the roots that survived the UF filter — which is why the
 * establishments pass comes first, collecting roots, and the companies pass
 * second.
 */

import type { Db } from '@woh/db';
import {
  EMPRESAS_LAYOUT,
  ESTABELECIMENTOS_LAYOUT,
  LOOKUP_LAYOUT,
  SITUACAO,
  checkLayout,
  describeRow,
  type FieldRule,
  type LayoutProblem,
} from './layout.js';
import { rowsOfFile } from './read.js';

/**
 * Which numbered parts of a set were supplied, and which are missing.
 *
 * The Receita splits each table into numbered files — Estabelecimentos0
 * through Estabelecimentos9 — and the split is arbitrary, not by state. A
 * company in Manaus can be in any of them. So importing three of the ten
 * produces a database that looks complete, reports a cheerful row count, and
 * is silently missing most of the state. Nothing downstream can detect that,
 * which is why it is checked here.
 *
 * Only the published zip naming is recognised. An extracted file is named like
 * `K3241.K03200Y0.D60314.ESTABELE`, which carries an extraction date and no
 * part number — a first attempt at this read the `60314` as a part index and
 * would have reported confident nonsense. When the names do not follow the
 * convention this returns nothing rather than guessing, and the operator still
 * sees the file count.
 *
 * The expected number of parts comes from the highest index present rather
 * than being hardcoded, because how many parts the Receita publishes is theirs
 * to change. That makes this a floor on the damage, not a proof of
 * completeness: parts 0 and 1 alone look contiguous.
 */
export function missingParts(paths: string[]): { present: number[]; missing: number[] } {
  const present = paths
    .map((path) => {
      const base = path.split(/[\\/]/).pop() ?? path;
      return /^(?:estabelecimentos|empresas)(\d{1,2})\.zip$/i.exec(base)?.[1];
    })
    .filter((n): n is string => n !== undefined)
    .map(Number)
    .sort((a, b) => a - b);

  if (present.length === 0) return { present: [], missing: [] };

  const highest = present[present.length - 1]!;
  const seen = new Set(present);
  const missing: number[] = [];
  for (let i = 0; i <= highest; i += 1) if (!seen.has(i)) missing.push(i);

  return { present, missing };
}

/** How many rows are checked against the layout before the import is trusted. */
const LAYOUT_SAMPLE = 50;

export interface IngestOptions {
  /** Path to an Estabelecimentos file, zipped or extracted. */
  estabelecimentos: string[];
  /** Path to an Empresas file, zipped or extracted. */
  empresas: string[];
  /** The municipality lookup (`Municipios.zip`), so codes become names. */
  municipios?: string;
  /** Which states to keep. Everything else is discarded as it streams. */
  ufs: string[];
  /** Which monthly snapshot this is, e.g. "2026-08". Recorded on every row. */
  importTag: string;
  /** Keep only these registry statuses. Defaults to active companies. */
  situacoes?: string[];
  /** Progress, called every `reportEvery` rows read. */
  onProgress?: (info: { file: string; read: number; kept: number }) => void;
  reportEvery?: number;
}

export interface IngestResult {
  importTag: string;
  establishmentsRead: number;
  establishmentsKept: number;
  companiesMatched: number;
  municipalitiesLoaded: number;
  /** How many numbered parts of each table were read. */
  estabelecimentosFiles: number;
  empresasFiles: number;
  /**
   * Part numbers that look absent from a numbered set, e.g. [3, 7]. Non-empty
   * means the import is incomplete in a way nothing downstream can see.
   */
  missingEstabelecimentos: number[];
  missingEmpresas: number[];
}

/**
 * Thrown when sampled rows do not match the declared layout.
 *
 * This is the guard the whole module exists around: the declared column order
 * is unverified (see `layout.ts`), and a wrong order produces plausible-looking
 * rubbish rather than an error. Refusing the import is the only safe response,
 * and the message points at `--inspect` because that is what resolves it.
 */
export class LayoutMismatchError extends Error {
  constructor(
    readonly file: string,
    readonly problems: LayoutProblem[],
  ) {
    const shown = problems.slice(0, 12).map((p) => `  row ${p.row}, column ${p.column} (${p.field}): ${p.problem}`);
    super(
      `The rows in ${file} do not match the declared column layout, so the import was refused ` +
        `before anything was written.\n\n${shown.join('\n')}\n` +
        (problems.length > shown.length ? `  …and ${problems.length - shown.length} more\n` : '') +
        `\nRun the same command with --inspect to see the first rows column by column, and ` +
        `correct the order in packages/core/src/providers/companies/receita/layout.ts.`,
    );
    this.name = 'LayoutMismatchError';
  }
}

/** Reads the first rows of a file and checks them against a layout. */
async function verifyLayout(path: string, layout: FieldRule[]): Promise<string[][]> {
  const sample: string[][] = [];
  for await (const row of rowsOfFile(path)) {
    sample.push(row);
    if (sample.length >= LAYOUT_SAMPLE) break;
  }
  if (sample.length === 0) throw new Error(`${path} contains no rows.`);

  const problems = checkLayout(sample, layout);
  if (problems.length) throw new LayoutMismatchError(path, problems);
  return sample;
}

/**
 * Prints the first rows of a file column by column, with the name this codebase
 * believes each column has. The two-minute check that confirms the layout
 * against the official PDF.
 */
export async function inspectFile(path: string, layout: FieldRule[], rows = 3): Promise<string> {
  const out: string[] = [`${path}`, ''];
  let n = 0;
  for await (const row of rowsOfFile(path)) {
    out.push(`row ${n + 1}  (${row.length} columns, layout declares ${layout.length})`);
    out.push(...describeRow(row, layout));
    out.push('');
    if (++n >= rows) break;
  }
  if (n === 0) out.push('  (no rows)');
  return out.join('\n');
}

/** `Municipios.zip`: the 4-digit Receita code to a name. Not the IBGE code. */
async function loadMunicipios(path: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const sample: string[][] = [];
  for await (const row of rowsOfFile(path)) {
    if (sample.length < LAYOUT_SAMPLE) sample.push(row);
    const code = row[0]?.trim();
    const name = row[1]?.trim();
    if (code && name) map.set(code.padStart(4, '0'), name);
  }
  const problems = checkLayout(sample, LOOKUP_LAYOUT);
  if (problems.length) throw new LayoutMismatchError(path, problems);
  return map;
}

const digitsOnly = (value: string | undefined): string => (value ?? '').replace(/\D/g, '');

/** `YYYYMMDD` to a Date, or undefined for the zeroes these files use for "none". */
function parseDate(value: string | undefined): Date | undefined {
  const raw = (value ?? '').trim();
  if (!/^\d{8}$/.test(raw) || /^0+$/.test(raw)) return undefined;
  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return new Date(Date.UTC(year, month - 1, day));
}

/** The register writes money with a comma. */
export function parseMoney(value: string | undefined): number | undefined {
  const raw = (value ?? '').trim();
  if (!raw) return undefined;

  // The files write capital social the Brazilian way: comma for the decimal
  // separator, e.g. "3000,00". A comma therefore settles what any dots are —
  // thousand separators — and "1.234.567,89" is one number, not three.
  //
  // Without a comma the dots are ambiguous, and guessing is how a capital of
  // 3000.50 becomes 300050. So those are left for Number to read as it will:
  // a plain integer parses, anything else comes back undefined, and an absent
  // capital is a company sized UNKNOWN rather than one sized wrongly.
  const normalised = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;

  const parsed = Number(normalised);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** A phone from the separate DDD and number columns, or nothing. */
function joinPhone(ddd: string | undefined, number: string | undefined): string | undefined {
  const a = digitsOnly(ddd);
  const b = digitsOnly(number);
  if (!a || !b) return undefined;
  return `+55${a}${b}`;
}

interface StagedRow {
  cnpj: string;
  cnpjBasico: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  situacao: string;
  matrizFilial: string;
  dataInicio: Date | null;
  cnaePrincipal: string;
  cnaeSecundaria: string[];
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  uf: string;
  municipioCode: string | null;
  municipioNome: string | null;
  telefone: string | null;
  email: string | null;
  porte: string | null;
  capitalSocial: number | null;
  naturezaJuridica: string | null;
  importTag: string;
}

/**
 * Runs the import.
 *
 * Both passes verify their layout before a single row is written, so a wrong
 * column order costs seconds rather than a half-finished table.
 */
export async function ingestReceita(db: Db, options: IngestOptions): Promise<IngestResult> {
  const ufs = new Set(options.ufs.map((u) => u.toUpperCase()));
  const situacoes = new Set(options.situacoes ?? [SITUACAO.ATIVA]);
  const reportEvery = options.reportEvery ?? 250_000;

  const municipios = options.municipios ? await loadMunicipios(options.municipios) : new Map<string, string>();

  // --- pass 1: establishments, filtered as they stream ----------------------
  const staged = new Map<string, StagedRow>();
  const roots = new Set<string>();
  let read = 0;

  for (const file of options.estabelecimentos) {
    await verifyLayout(file, ESTABELECIMENTOS_LAYOUT);

    for await (const row of rowsOfFile(file)) {
      read += 1;
      if (reportEvery && read % reportEvery === 0) {
        options.onProgress?.({ file, read, kept: staged.size });
      }

      const uf = (row[19] ?? '').trim().toUpperCase();
      if (!ufs.has(uf)) continue;

      const situacao = (row[5] ?? '').trim();
      if (situacoes.size && !situacoes.has(situacao)) continue;

      const basico = digitsOnly(row[0]).padStart(8, '0');
      const ordem = digitsOnly(row[1]).padStart(4, '0');
      const dv = digitsOnly(row[2]).padStart(2, '0');
      const cnpj = `${basico}${ordem}${dv}`;
      if (cnpj.length !== 14) continue;

      const municipioCode = digitsOnly(row[20]).padStart(4, '0');

      roots.add(basico);
      staged.set(cnpj, {
        cnpj,
        cnpjBasico: basico,
        // Filled in by pass 2. An establishment row has no company name.
        razaoSocial: '',
        nomeFantasia: (row[4] ?? '').trim() || null,
        situacao,
        matrizFilial: (row[3] ?? '').trim() || '1',
        dataInicio: parseDate(row[10]) ?? null,
        cnaePrincipal: digitsOnly(row[11]).padStart(7, '0'),
        cnaeSecundaria: (row[12] ?? '')
          .split(',')
          .map((c) => digitsOnly(c))
          .filter((c) => c.length === 7),
        logradouro: [(row[13] ?? '').trim(), (row[14] ?? '').trim()].filter(Boolean).join(' ') || null,
        numero: (row[15] ?? '').trim() || null,
        complemento: (row[16] ?? '').trim() || null,
        bairro: (row[17] ?? '').trim() || null,
        cep: digitsOnly(row[18]).padStart(8, '0').slice(0, 8) || null,
        uf,
        municipioCode: municipioCode === '0000' ? null : municipioCode,
        municipioNome: municipios.get(municipioCode) ?? null,
        telefone: joinPhone(row[21], row[22]) ?? null,
        email: (row[27] ?? '').trim().toLowerCase() || null,
        porte: null,
        capitalSocial: null,
        naturezaJuridica: null,
        importTag: options.importTag,
      });
    }
  }

  // --- pass 2: companies, only the roots that survived ----------------------
  let matched = 0;
  const byRoot = new Map<string, StagedRow[]>();
  for (const row of staged.values()) {
    const list = byRoot.get(row.cnpjBasico);
    if (list) list.push(row);
    else byRoot.set(row.cnpjBasico, [row]);
  }

  for (const file of options.empresas) {
    await verifyLayout(file, EMPRESAS_LAYOUT);

    for await (const row of rowsOfFile(file)) {
      const basico = digitsOnly(row[0]).padStart(8, '0');
      if (!roots.has(basico)) continue;

      const targets = byRoot.get(basico);
      if (!targets) continue;
      matched += 1;

      for (const target of targets) {
        target.razaoSocial = (row[1] ?? '').trim();
        target.naturezaJuridica = digitsOnly(row[2]).padStart(4, '0') || null;
        target.capitalSocial = parseMoney(row[4]) ?? null;
        const porte = (row[5] ?? '').trim().padStart(2, '0');
        target.porte = porte === '00' ? null : porte || null;
      }
    }
  }

  // --- write ----------------------------------------------------------------
  // Replace this snapshot wholesale. Rows from a previous import of the same
  // states are removed first, so a company that closed between snapshots
  // disappears rather than lingering as a stale active lead.
  await db.receitaEstablishment.deleteMany({ where: { uf: { in: [...ufs] } } });

  const rows = [...staged.values()].filter((r) => r.razaoSocial !== '');
  const BATCH = 2_000;
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.receitaEstablishment.createMany({ data: rows.slice(i, i + BATCH), skipDuplicates: true });
  }

  return {
    importTag: options.importTag,
    establishmentsRead: read,
    establishmentsKept: rows.length,
    companiesMatched: matched,
    municipalitiesLoaded: municipios.size,
    estabelecimentosFiles: options.estabelecimentos.length,
    empresasFiles: options.empresas.length,
    missingEstabelecimentos: missingParts(options.estabelecimentos).missing,
    missingEmpresas: missingParts(options.empresas).missing,
  };
}
