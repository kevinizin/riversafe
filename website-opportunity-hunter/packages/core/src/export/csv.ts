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
  else if (typeof value === 'boolean') text = value ? 'yes' : 'no';
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
  'Company',
  'Company Number',
  'Industry',
  'City',
  'Region',
  'Postcode',
  'Website',
  'Website Status',
  'Website Score',
  'Opportunity Score',
  'Classification',
  'Phone',
  'Business Email',
  'Instagram',
  'Facebook',
  'LinkedIn',
  'Reviews',
  'Rating',
  'Date Incorporated',
  'Lead Status',
  'Score Confidence',
];
