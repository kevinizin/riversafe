import { deflateRawSync } from 'node:zlib';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  EMPRESAS_LAYOUT,
  ESTABELECIMENTOS_LAYOUT,
  PORTE_VALUES,
  checkLayout,
  describeRow,
} from './layout.js';
import { parseCsvLine, rowsOfFile } from './read.js';

const dir = mkdtempSync(join(tmpdir(), 'receita-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** An establishment row in the declared column order. */
function establishment(over: Partial<Record<number, string>> = {}): string[] {
  const row = [
    '12345678', // 0  cnpj_basico
    '0001', // 1  cnpj_ordem
    '95', // 2  cnpj_dv
    '1', // 3  matriz/filial
    'DEMO ARQUITETURA', // 4  nome_fantasia
    '02', // 5  situacao_cadastral
    '20220925', // 6  data_situacao_cadastral
    '00', // 7  motivo
    '', // 8  cidade exterior
    '', // 9  pais
    '20220925', // 10 data_inicio_atividade
    '7111100', // 11 cnae principal
    '7119703,7119799', // 12 cnae secundaria
    'RUA', // 13 tipo_logradouro
    'EXEMPLO', // 14 logradouro
    '100', // 15 numero
    'SALA 2', // 16 complemento
    'CENTRO', // 17 bairro
    '69000000', // 18 cep
    'AM', // 19 uf
    '0255', // 20 municipio
    '92', // 21 ddd_1
    '30000000', // 22 telefone_1
    '', // 23 ddd_2
    '', // 24 telefone_2
    '', // 25 ddd_fax
    '', // 26 fax
    'CONTATO@EXAMPLE.COM.BR', // 27 correio_eletronico
    '', // 28 situacao_especial
    '', // 29 data_situacao_especial
  ];
  for (const [index, value] of Object.entries(over)) row[Number(index)] = value ?? '';
  return row;
}

function company(over: Partial<Record<number, string>> = {}): string[] {
  const row = ['12345678', 'DEMO ARQUITETURA E PROJETOS LTDA', '2062', '49', '180000,00', '03', ''];
  for (const [index, value] of Object.entries(over)) row[Number(index)] = value ?? '';
  return row;
}

const toCsv = (rows: string[][]) => rows.map((r) => r.map((f) => `"${f}"`).join(';')).join('\r\n') + '\r\n';

/** A single-member zip, written by hand so the reader is exercised for real. */
function writeZip(path: string, name: string, contents: Buffer): void {
  const deflated = deflateRawSync(contents);
  const nameBuf = Buffer.from(name, 'utf8');
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4); // version needed
  header.writeUInt16LE(0, 6); // flags — no data descriptor
  header.writeUInt16LE(8, 8); // deflate
  header.writeUInt32LE(0, 14); // crc, unchecked by the reader
  header.writeUInt32LE(deflated.length, 18);
  header.writeUInt32LE(contents.length, 22);
  header.writeUInt16LE(nameBuf.length, 26);
  header.writeUInt16LE(0, 28);
  writeFileSync(path, Buffer.concat([header, nameBuf, deflated]));
}

describe('parseCsvLine', () => {
  it('splits on semicolons and strips the quoting the register uses', () => {
    expect(parseCsvLine('"12345678";"DEMO LTDA";"2062"')).toEqual(['12345678', 'DEMO LTDA', '2062']);
  });

  it('keeps a semicolon that sits inside a quoted field', () => {
    expect(parseCsvLine('"A";"RUA X; SALA 2";"B"')).toEqual(['A', 'RUA X; SALA 2', 'B']);
  });

  it('unescapes a doubled quote', () => {
    expect(parseCsvLine('"CIA ""EXEMPLO""";"X"')).toEqual(['CIA "EXEMPLO"', 'X']);
  });

  it('keeps empty fields, which carry meaning in these files', () => {
    expect(parseCsvLine('"A";;"C"')).toEqual(['A', '', 'C']);
    expect(parseCsvLine(';;')).toEqual(['', '', '']);
  });
});

describe('reading the files', () => {
  it('reads rows out of a deflate zip', async () => {
    const path = join(dir, 'estabelecimentos.zip');
    writeZip(path, 'K3241.K03200Y0.D40911.ESTABELE', Buffer.from(toCsv([establishment()]), 'latin1'));

    const rows: string[][] = [];
    for await (const row of rowsOfFile(path)) rows.push(row);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.[11]).toBe('7111100');
  });

  it('decodes Latin-1, so accented names survive', async () => {
    const path = join(dir, 'acentos.csv');
    // "CONSTRUÇÃO" written as the register writes it: ISO-8859-1, not UTF-8.
    writeFileSync(path, Buffer.from(toCsv([company({ 1: 'CONSTRUÇÃO SÃO JOSÉ LTDA' })]), 'latin1'));

    const rows: string[][] = [];
    for await (const row of rowsOfFile(path)) rows.push(row);

    expect(rows[0]?.[1]).toBe('CONSTRUÇÃO SÃO JOSÉ LTDA');
  });

  it('reads a plain extracted file as readily as a zip', async () => {
    const path = join(dir, 'plain.csv');
    writeFileSync(path, Buffer.from(toCsv([establishment(), establishment({ 1: '0002' })]), 'latin1'));

    const rows: string[][] = [];
    for await (const row of rowsOfFile(path)) rows.push(row);
    expect(rows).toHaveLength(2);
  });
});

describe('the layout guard', () => {
  it('accepts rows in the declared order', () => {
    expect(checkLayout([establishment()], ESTABELECIMENTOS_LAYOUT)).toEqual([]);
    expect(checkLayout([company()], EMPRESAS_LAYOUT)).toEqual([]);
  });

  it('catches a shifted layout rather than importing nonsense', () => {
    // The failure this whole module is built around: one column inserted near
    // the front, so every later field lands in the wrong place. Nothing about
    // the values is malformed in isolation — only their positions are wrong.
    const shifted = ['EXTRA', ...establishment()];
    const problems = checkLayout([shifted], ESTABELECIMENTOS_LAYOUT);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]?.problem).toContain('expected 30 columns, got 31');
  });

  it('catches a swap that keeps the column count', () => {
    const row = establishment();
    // Swap the CNAE with the CEP: same number of columns, both numeric, and
    // exactly the kind of mistake that produces confident rubbish.
    const swapped = [...row];
    swapped[11] = row[18]!;
    swapped[18] = row[11]!;
    const problems = checkLayout([swapped], ESTABELECIMENTOS_LAYOUT);
    expect(problems.map((p) => p.field)).toContain('cnae_fiscal_principal');
  });

  it('rejects a porte outside the register documented domain', () => {
    const problems = checkLayout([company({ 5: '07' })], EMPRESAS_LAYOUT);
    expect(problems).toHaveLength(1);
    expect(problems[0]?.field).toBe('porte_empresa');
    expect(problems[0]?.problem).toContain(PORTE_VALUES.join(', '));
  });

  it('rejects an impossible date instead of storing it', () => {
    const problems = checkLayout([establishment({ 10: '20221345' })], ESTABELECIMENTOS_LAYOUT);
    expect(problems.map((p) => p.field)).toContain('data_inicio_atividade');
  });

  it('accepts the all-zero date the files use for "none"', () => {
    expect(checkLayout([establishment({ 6: '00000000' })], ESTABELECIMENTOS_LAYOUT)).toEqual([]);
  });

  it('reports the row number so a bad row can be found', () => {
    const problems = checkLayout([establishment(), establishment({ 19: 'ZZ' })], ESTABELECIMENTOS_LAYOUT);
    expect(problems[0]?.row).toBe(2);
    expect(problems[0]?.field).toBe('uf');
  });
});

describe('describeRow', () => {
  it('names every column and flags the ones that do not fit', () => {
    const lines = describeRow(establishment({ 19: 'ZZ' }), ESTABELECIMENTOS_LAYOUT);
    expect(lines).toHaveLength(ESTABELECIMENTOS_LAYOUT.length);
    expect(lines.join('\n')).toContain('uf');
    expect(lines.find((l) => l.includes('"ZZ"'))).toContain('<--');
  });
});
