/** RFC 4180 CSV writing, with the spreadsheet-injection guard. */

export type CsvValue = string | number | boolean | Date | null | undefined;

/**
 * Escapes one field.
 *
 * The leading apostrophe on `=`, `+`, `-` and `@` is not decoration: without it
 * a company name such as "=cmd" is executed as a formula when the export is
 * opened in Excel.
 */
export function csvEscape(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  let text: string;
  if (value instanceof Date) text = value.toISOString().slice(0, 10);
  else if (typeof value === 'boolean') text = value ? 'sim' : 'não';
  else text = String(value);

  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) lines.push(row.map(csvEscape).join(','));
  // A BOM makes Excel read the file as UTF-8 rather than the local codepage.
  return `﻿${lines.join('\r\n')}\r\n`;
}

export const LEAD_EXPORT_HEADERS = [
  'Empresa',
  'CNPJ / registro',
  'Setor',
  'Cidade',
  'Estado',
  'CEP',
  'Site',
  'Situação do site',
  'Nota do site',
  'Score de site',
  'Classificação (site)',
  'Score de sistema',
  'Classificação (sistema)',
  // Named as an estimate in the header itself. A spreadsheet column outlives
  // the screen it was exported from, and "Funcionários" would be read as a
  // fact by whoever opens the file next.
  'Porte estimado',
  'Faixa estimada de pessoas',
  'Encaixe de porte',
  'Telefone',
  'E-mail comercial',
  'Instagram',
  'Facebook',
  'LinkedIn',
  'Avaliações',
  'Nota',
  'Data de abertura',
  'Etapa no funil',
  'Confiança do score',
];
