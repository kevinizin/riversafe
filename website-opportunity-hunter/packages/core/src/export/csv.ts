/**
 * CSV writing, with the spreadsheet-injection guard.
 *
 * The separator is a semicolon, not a comma. Excel splits a CSV on whatever
 * its locale calls the list separator, and in pt-BR that is the semicolon —
 * a comma-separated file opens as one column of text per row, which reads as
 * a broken export rather than as a settings mismatch. Everything else that
 * reads CSV sniffs the separator; Excel does not.
 */

export type CsvValue = string | number | boolean | Date | null | undefined;

/**
 * Escapes one field.
 *
 * The leading apostrophe on `=`, `+`, `-` and `@` is not decoration: without it
 * a company name such as "=cmd" is executed as a formula when the export is
 * opened in Excel.
 */
/** The separator Excel expects in pt-BR, and which every other reader sniffs. */
export const CSV_DELIMITER = ';';

export function csvEscape(value: CsvValue, delimiter: string = CSV_DELIMITER): string {
  if (value === null || value === undefined) return '';
  let text: string;
  if (value instanceof Date) text = value.toISOString().slice(0, 10);
  else if (typeof value === 'boolean') text = value ? 'sim' : 'não';
  else text = String(value);

  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  // Quote on the separator actually in use. Escaping for a comma while
  // writing semicolons would split a field like "Arquitetura; Engenharia"
  // across two columns, silently and only in some rows.
  if (text.includes(delimiter) || /["\n\r]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(
  headers: string[],
  rows: CsvValue[][],
  delimiter: string = CSV_DELIMITER,
): string {
  const line = (cells: CsvValue[]) => cells.map((cell) => csvEscape(cell, delimiter)).join(delimiter);
  const lines = [line(headers), ...rows.map(line)];
  // A BOM makes Excel read the file as UTF-8 rather than the local codepage,
  // which is what keeps "Construção" from arriving as "ConstruÃ§Ã£o".
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
