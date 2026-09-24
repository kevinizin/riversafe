/**
 * The column layout of the Receita Federal CNPJ open-data CSVs.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  READ THIS BEFORE TRUSTING AN IMPORT
 *
 *  The orders declared below are UNVERIFIED against the official layout
 *  document. That document is published as a PDF at
 *  https://www.gov.br/receitafederal/dados/cnpj-metadados.pdf and carries no
 *  ToUnicode mapping, so its text cannot be extracted programmatically; and the
 *  file host (arquivos.receitafederal.gov.br) refuses connections from outside
 *  Brazil, so the order could not be checked against a real file either.
 *
 *  A CSV parser with the wrong column order does not crash. It files a capital
 *  social as a porte and produces confident nonsense, which is the single worst
 *  failure this project can have. So two things guard it:
 *
 *   1. Every field below declares what its values must look like. The importer
 *      checks a sample of rows against those rules and refuses the whole import
 *      if they do not hold — a wrong order fails loudly on the first rows
 *      instead of silently poisoning the database.
 *
 *   2. `npm run ingest:br -- --inspect` prints the first rows column by column
 *      with the name this file believes each one has. Two minutes with the PDF
 *      open confirms or corrects it, and the correction is a one-line edit
 *      here rather than a hunt through the parser.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Format notes that are verified, because they are properties of the files
 * rather than of the layout: the CSVs are semicolon-separated, Latin-1
 * (ISO-8859-1) encoded, quoted with `"`, and carry no header row — which is
 * exactly why the column order has to be declared somewhere and why getting it
 * wrong is invisible without the checks above.
 */

/** What a column's values must look like for the layout to be believable. */
export interface FieldRule {
  /** Name used in error messages and in `--inspect` output. */
  name: string;
  /** False when the column is routinely blank, so emptiness proves nothing. */
  required: boolean;
  /** Returns an explanation when the value is wrong, or null when it is fine. */
  check(value: string): string | null;
}

const anything = (name: string): FieldRule => ({
  name,
  required: false,
  check: () => null,
});

const digits = (name: string, length: number, required = true): FieldRule => ({
  name,
  required,
  check: (v) =>
    v === '' ? null : new RegExp(`^\\d{${length}}$`).test(v) ? null : `expected ${length} digits, got "${v}"`,
});

const digitsUpTo = (name: string, max: number, required = true): FieldRule => ({
  name,
  required,
  check: (v) => (v === '' ? null : new RegExp(`^\\d{1,${max}}$`).test(v) ? null : `expected up to ${max} digits, got "${v}"`),
});

const oneOf = (name: string, values: string[], required = true): FieldRule => ({
  name,
  required,
  check: (v) =>
    v === '' ? null : values.includes(v) ? null : `expected one of ${values.join(', ')}, got "${v}"`,
});

/** `YYYYMMDD`. Zeroes are used for "no date" throughout these files. */
const dateField = (name: string, required = false): FieldRule => ({
  name,
  required,
  check: (v) => {
    if (v === '' || v === '0' || /^0+$/.test(v)) return null;
    if (!/^\d{8}$/.test(v)) return `expected YYYYMMDD, got "${v}"`;
    const year = Number(v.slice(0, 4));
    const month = Number(v.slice(4, 6));
    const day = Number(v.slice(6, 8));
    if (year < 1800 || year > 2100) return `year out of range in "${v}"`;
    if (month < 1 || month > 12) return `month out of range in "${v}"`;
    if (day < 1 || day > 31) return `day out of range in "${v}"`;
    return null;
  },
});

/** Decimal with a comma separator, as these files write money. */
const money = (name: string): FieldRule => ({
  name,
  required: false,
  check: (v) => (v === '' || /^\d+(,\d+)?$/.test(v) ? null : `expected a number, got "${v}"`),
});

const UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN',
  'RO','RR','RS','SC','SE','SP','TO',
  // The register also uses EX for companies registered abroad.
  'EX',
];

/** `porte_empresa`. The one domain in these files this project depends on. */
export const PORTE_VALUES = ['00', '01', '03', '05'];

/**
 * `Empresas` — one row per CNPJ root (the parent company).
 *
 * UNVERIFIED ORDER. See the header.
 */
export const EMPRESAS_LAYOUT: FieldRule[] = [
  digits('cnpj_basico', 8),
  anything('razao_social'),
  digitsUpTo('natureza_juridica', 4),
  digitsUpTo('qualificacao_responsavel', 2),
  money('capital_social'),
  oneOf('porte_empresa', PORTE_VALUES, false),
  anything('ente_federativo_responsavel'),
];

/**
 * `Estabelecimentos` — one row per trading address. This is the table that
 * carries the CNAE, the municipality and the registration status, so it is the
 * one the search actually runs against.
 *
 * UNVERIFIED ORDER. See the header.
 */
export const ESTABELECIMENTOS_LAYOUT: FieldRule[] = [
  digits('cnpj_basico', 8),
  digits('cnpj_ordem', 4),
  digits('cnpj_dv', 2),
  oneOf('identificador_matriz_filial', ['1', '2']),
  anything('nome_fantasia'),
  oneOf('situacao_cadastral', ['01', '02', '03', '04', '08']),
  dateField('data_situacao_cadastral'),
  digitsUpTo('motivo_situacao_cadastral', 2, false),
  anything('nome_cidade_exterior'),
  digitsUpTo('pais', 3, false),
  dateField('data_inicio_atividade', true),
  digits('cnae_fiscal_principal', 7),
  anything('cnae_fiscal_secundaria'),
  anything('tipo_logradouro'),
  anything('logradouro'),
  anything('numero'),
  anything('complemento'),
  anything('bairro'),
  digits('cep', 8, false),
  oneOf('uf', UFS),
  digitsUpTo('municipio', 4, false),
  digitsUpTo('ddd_1', 4, false),
  anything('telefone_1'),
  digitsUpTo('ddd_2', 4, false),
  anything('telefone_2'),
  digitsUpTo('ddd_fax', 4, false),
  anything('fax'),
  anything('correio_eletronico'),
  anything('situacao_especial'),
  dateField('data_situacao_especial'),
];

/** The small lookup tables are all `code;description`. */
export const LOOKUP_LAYOUT: FieldRule[] = [digitsUpTo('codigo', 7), anything('descricao')];

/** `situacao_cadastral` values, per the register's own documentation. */
export const SITUACAO = {
  NULA: '01',
  ATIVA: '02',
  SUSPENSA: '03',
  INAPTA: '04',
  BAIXADA: '08',
} as const;

export interface LayoutProblem {
  row: number;
  column: number;
  field: string;
  problem: string;
  value: string;
}

/**
 * Checks sampled rows against a layout.
 *
 * The caller decides what to do with the result; the importer refuses the whole
 * file when anything comes back. The column count is checked first, because a
 * row with the wrong number of fields means the layout is wrong in a way that
 * makes every other complaint noise.
 */
export function checkLayout(
  rows: string[][],
  layout: FieldRule[],
  startRow = 1,
): LayoutProblem[] {
  const problems: LayoutProblem[] = [];

  for (const [index, row] of rows.entries()) {
    const rowNumber = startRow + index;

    if (row.length !== layout.length) {
      problems.push({
        row: rowNumber,
        column: 0,
        field: '(row)',
        problem: `expected ${layout.length} columns, got ${row.length}`,
        value: '',
      });
      // One more complaint per row would be noise; the count is the story.
      continue;
    }

    for (const [column, rule] of layout.entries()) {
      const value = (row[column] ?? '').trim();
      if (value === '' && rule.required) {
        problems.push({ row: rowNumber, column, field: rule.name, problem: 'is empty but required', value });
        continue;
      }
      const problem = rule.check(value);
      if (problem) problems.push({ row: rowNumber, column, field: rule.name, problem, value });
    }
  }

  return problems;
}

/** A human-readable report for `--inspect`, one line per column. */
export function describeRow(row: string[], layout: FieldRule[]): string[] {
  const width = Math.max(...layout.map((f) => f.name.length));
  return layout.map((rule, i) => {
    const value = row[i] ?? '(missing)';
    const problem = value === '(missing)' ? 'no such column' : rule.check(value.trim());
    return `  ${String(i).padStart(2)} ${rule.name.padEnd(width)}  ${JSON.stringify(value)}${
      problem ? `   <-- ${problem}` : ''
    }`;
  });
}
