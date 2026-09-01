import { describe, expect, it } from 'vitest';
import { csvEscape, toCsv } from './csv.js';

describe('csvEscape', () => {
  it('quotes fields containing commas, quotes or newlines', () => {
    expect(csvEscape('Smith, Jones & Co')).toBe('"Smith, Jones & Co"');
    expect(csvEscape('He said "hello"')).toBe('"He said ""hello"""');
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
  });

  it('neutralises spreadsheet formula injection', () => {
    expect(csvEscape('=cmd|/c calc')).toBe("'=cmd|/c calc");
    // A dangerous value that also needs quoting gets both treatments.
    expect(csvEscape('=SUM(A1,B1)')).toBe('"\'=SUM(A1,B1)"');
    expect(csvEscape('+1234')).toBe("'+1234");
    expect(csvEscape('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvEscape('-5')).toBe("'-5");
  });

  it('renders empty for null and undefined, and dates as ISO days', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
    expect(csvEscape(new Date('2026-08-28T12:00:00Z'))).toBe('2026-08-28');
    expect(csvEscape(true)).toBe('yes');
  });
});

describe('toCsv', () => {
  it('writes a BOM, CRLF line endings and a header row', () => {
    const csv = toCsv(['a', 'b'], [[1, 'two']]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('a,b\r\n');
    expect(csv).toContain('1,two\r\n');
  });
});
