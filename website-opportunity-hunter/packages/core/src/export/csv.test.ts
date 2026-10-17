import { describe, expect, it } from 'vitest';
import { CSV_DELIMITER, csvEscape, toCsv } from './csv.js';

describe('csvEscape', () => {
  it('quotes fields containing the separator, quotes or newlines', () => {
    // A sector list is the ordinary case: written unquoted it would split
    // across two columns, in some rows only.
    expect(csvEscape('Arquitetura; Engenharia')).toBe('"Arquitetura; Engenharia"');
    expect(csvEscape('He said "hello"')).toBe('"He said ""hello"""');
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
  });

  it('leaves a comma alone, because the separator is not a comma', () => {
    // Quoting a comma would be harmless but wrong, and it hides which
    // separator the file actually uses from anyone reading the output.
    expect(csvEscape('Smith, Jones & Co')).toBe('Smith, Jones & Co');
  });

  it('quotes on whichever separator it is given', () => {
    expect(csvEscape('Smith, Jones & Co', ',')).toBe('"Smith, Jones & Co"');
    expect(csvEscape('Arquitetura; Engenharia', ',')).toBe('Arquitetura; Engenharia');
  });

  it('neutralises spreadsheet formula injection', () => {
    expect(csvEscape('=cmd|/c calc')).toBe("'=cmd|/c calc");
    // A dangerous value that also needs quoting gets both treatments.
    expect(csvEscape('=SUM(A1;B1)')).toBe('"\'=SUM(A1;B1)"');
    expect(csvEscape('+1234')).toBe("'+1234");
    expect(csvEscape('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvEscape('-5')).toBe("'-5");
  });

  it('renders empty for null and undefined, and dates as ISO days', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
    expect(csvEscape(new Date('2026-08-28T12:00:00Z'))).toBe('2026-08-28');
    expect(csvEscape(true)).toBe('sim');
  });
});

describe('toCsv', () => {
  it('writes a BOM, CRLF line endings and a header row', () => {
    const csv = toCsv(['a', 'b'], [[1, 'two']]);
    // Without the BOM, Excel reads the file in the local codepage and
    // "Construção" arrives as "ConstruÃ§Ã£o".
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('a;b\r\n');
    expect(csv).toContain('1;two\r\n');
  });

  it('separates with a semicolon, which is what Excel in pt-BR splits on', () => {
    // A comma-separated file opens as one column per row there, which reads
    // as a broken export rather than as a settings mismatch.
    expect(CSV_DELIMITER).toBe(';');
    expect(toCsv(['Empresa', 'Cidade'], [['Estúdio X', 'Manaus']])).toContain(
      'Estúdio X;Manaus',
    );
  });

  it("writes a +55 phone with the leading apostrophe, and Excel shows it plain", () => {
    // Alarming in a text editor, correct in a spreadsheet: without it Excel
    // reads +559233334444 as a formula. The apostrophe is Excel's marker for
    // "this is text" and is not displayed in the cell.
    expect(toCsv(['Telefone'], [['+559233334444']])).toContain("'+559233334444");
  });

  it('can still write a comma-separated file when asked', () => {
    expect(toCsv(['a', 'b'], [[1, 'two']], ',')).toContain('a,b\r\n');
  });
});
