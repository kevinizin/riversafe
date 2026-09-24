import { deflateRawSync } from 'node:zlib';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { LayoutMismatchError, ingestReceita } from './ingest.js';
import { ReceitaFederalProvider } from './provider.js';

/**
 * The import, end to end, against a real database.
 *
 * The files here are synthetic, written in the layout this codebase declares.
 * That means this suite proves the machinery — streaming, the UF filter, the
 * join, the replacement semantics, the refusal — but it cannot prove the
 * declared layout matches the real files, because the real files could not be
 * reached. See layout.ts. That gap is what `--inspect` exists to close.
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

if (TEST_DATABASE_URL && sameDatabase(TEST_DATABASE_URL, process.env.DATABASE_URL)) {
  throw new Error('TEST_DATABASE_URL points at the same database as DATABASE_URL; this suite writes and deletes rows.');
}

function sameDatabase(a: string, b: string | undefined): boolean {
  if (!b) return false;
  try {
    const one = new URL(a);
    const two = new URL(b);
    return one.host === two.host && one.pathname === two.pathname;
  } catch {
    return a === b;
  }
}

const maybe = TEST_DATABASE_URL ? describe : describe.skip;
const dir = mkdtempSync(join(tmpdir(), 'receita-ingest-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function estabelecimento(over: Record<number, string> = {}): string[] {
  const row = [
    '12345678', '0001', '95', '1', 'DEMO ARQUITETURA', '02', '20220925', '00', '', '',
    '20220925', '7111100', '7119703,7119799', 'RUA', 'EXEMPLO', '100', 'SALA 2', 'CENTRO',
    '69000000', 'AM', '0255', '92', '30000000', '', '', '', '',
    'CONTATO@EXAMPLE.COM.BR', '', '',
  ];
  for (const [i, v] of Object.entries(over)) row[Number(i)] = v;
  return row;
}

function empresa(over: Record<number, string> = {}): string[] {
  const row = ['12345678', 'DEMO ARQUITETURA E PROJETOS LTDA', '2062', '49', '180000,00', '03', ''];
  for (const [i, v] of Object.entries(over)) row[Number(i)] = v;
  return row;
}

const csv = (rows: string[][]) => rows.map((r) => r.map((f) => `"${f}"`).join(';')).join('\r\n') + '\r\n';

function write(name: string, rows: string[][]): string {
  const path = join(dir, name);
  writeFileSync(path, Buffer.from(csv(rows), 'latin1'));
  return path;
}

function writeZip(name: string, rows: string[][]): string {
  const path = join(dir, name);
  const contents = Buffer.from(csv(rows), 'latin1');
  const deflated = deflateRawSync(contents);
  const nameBuf = Buffer.from('MEMBER', 'utf8');
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(8, 8);
  header.writeUInt32LE(deflated.length, 18);
  header.writeUInt32LE(contents.length, 22);
  header.writeUInt16LE(nameBuf.length, 26);
  writeFileSync(path, Buffer.concat([header, nameBuf, deflated]));
  return path;
}

maybe('Receita import (integration)', () => {
  const db = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
  afterAll(() => db.$disconnect());
  beforeEach(() => db.receitaEstablishment.deleteMany());

  const municipios = write('Municipios.csv', [
    ['0255', 'MANAUS'],
    ['0256', 'PARINTINS'],
  ]);

  it('imports, joins the company record, and keeps only the wanted states', async () => {
    const estabs = write('E.csv', [
      estabelecimento(),
      estabelecimento({ 0: '22222222', 1: '0001', 19: 'SP', 20: '7107' }), // wrong state
      estabelecimento({ 0: '33333333', 4: 'DEMO CURSOS', 11: '8599604', 20: '0256' }),
    ]);
    const emps = write('C.csv', [
      empresa(),
      empresa({ 0: '22222222', 1: 'DEMO PAULISTA LTDA' }),
      empresa({ 0: '33333333', 1: 'DEMO CURSOS LTDA', 4: '95000,00', 5: '03' }),
    ]);

    const result = await ingestReceita(db, {
      estabelecimentos: [estabs],
      empresas: [emps],
      municipios,
      ufs: ['AM'],
      importTag: '2026-08',
    });

    expect(result.establishmentsRead).toBe(3);
    expect(result.establishmentsKept).toBe(2);
    expect(result.municipalitiesLoaded).toBe(2);

    const rows = await db.receitaEstablishment.findMany({ orderBy: { cnpj: 'asc' } });
    expect(rows.map((r) => r.uf)).toEqual(['AM', 'AM']);

    const arq = rows[0]!;
    expect(arq.cnpj).toBe('12345678000195');
    // The join filled in what the establishments file does not carry.
    expect(arq.razaoSocial).toBe('DEMO ARQUITETURA E PROJETOS LTDA');
    expect(arq.porte).toBe('03');
    expect(Number(arq.capitalSocial)).toBe(180000);
    expect(arq.municipioNome).toBe('MANAUS');
    expect(arq.cnaePrincipal).toBe('7111100');
    expect(arq.cnaeSecundaria).toEqual(['7119703', '7119799']);
    expect(arq.dataInicio?.toISOString().slice(0, 10)).toBe('2022-09-25');
    expect(arq.telefone).toBe('+559230000000');
    expect(arq.importTag).toBe('2026-08');
  });

  it('reads zipped files as readily as extracted ones', async () => {
    const result = await ingestReceita(db, {
      estabelecimentos: [writeZip('E.zip', [estabelecimento()])],
      empresas: [writeZip('C.zip', [empresa()])],
      ufs: ['AM'],
      importTag: '2026-08',
    });
    expect(result.establishmentsKept).toBe(1);
  });

  it('drops an establishment whose company record is missing rather than storing it nameless', async () => {
    const result = await ingestReceita(db, {
      estabelecimentos: [write('E2.csv', [estabelecimento(), estabelecimento({ 0: '44444444' })])],
      empresas: [write('C2.csv', [empresa()])],
      ufs: ['AM'],
      importTag: '2026-08',
    });
    expect(result.establishmentsKept).toBe(1);
    expect(await db.receitaEstablishment.count()).toBe(1);
  });

  it('replaces the previous snapshot instead of accumulating stale rows', async () => {
    await ingestReceita(db, {
      estabelecimentos: [write('E3.csv', [estabelecimento(), estabelecimento({ 0: '33333333' })])],
      empresas: [write('C3.csv', [empresa(), empresa({ 0: '33333333', 1: 'DEMO CURSOS LTDA' })])],
      ufs: ['AM'],
      importTag: '2026-07',
    });
    expect(await db.receitaEstablishment.count()).toBe(2);

    // The second company has closed and no longer appears in the new snapshot.
    await ingestReceita(db, {
      estabelecimentos: [write('E4.csv', [estabelecimento()])],
      empresas: [write('C4.csv', [empresa()])],
      ufs: ['AM'],
      importTag: '2026-08',
    });

    const rows = await db.receitaEstablishment.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.importTag).toBe('2026-08');
  });

  it('keeps only active companies by default', async () => {
    const result = await ingestReceita(db, {
      estabelecimentos: [
        write('E5.csv', [
          estabelecimento(),
          estabelecimento({ 0: '55555555', 5: '08' }), // baixada
        ]),
      ],
      empresas: [write('C5.csv', [empresa(), empresa({ 0: '55555555', 1: 'DEMO FECHADA LTDA' })])],
      ufs: ['AM'],
      importTag: '2026-08',
    });
    expect(result.establishmentsKept).toBe(1);
  });

  it('refuses the whole import when the layout does not match, writing nothing', async () => {
    await ingestReceita(db, {
      estabelecimentos: [write('E6.csv', [estabelecimento()])],
      empresas: [write('C6.csv', [empresa()])],
      ufs: ['AM'],
      importTag: '2026-08',
    });
    const before = await db.receitaEstablishment.count();
    expect(before).toBe(1);

    // One extra column at the front: every later field lands one place out.
    const shifted = write('E7.csv', [['EXTRA', ...estabelecimento({ 0: '99999999' })]]);

    await expect(
      ingestReceita(db, {
        estabelecimentos: [shifted],
        empresas: [write('C7.csv', [empresa({ 0: '99999999' })])],
        ufs: ['AM'],
        importTag: '2026-09',
      }),
    ).rejects.toThrow(LayoutMismatchError);

    // The previous snapshot is untouched: the refusal happens before any write.
    expect(await db.receitaEstablishment.count()).toBe(before);
  });
});

maybe('ReceitaFederalProvider', () => {
  const db = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
  afterAll(() => db.$disconnect());

  async function loaded(): Promise<ReceitaFederalProvider> {
    await db.receitaEstablishment.deleteMany();
    await ingestReceita(db, {
      estabelecimentos: [
        write('P1.csv', [
          estabelecimento(),
          // Its own secondary codes, so the secondary-CNAE search below is
          // actually discriminating rather than matching the shared default.
          estabelecimento({ 0: '33333333', 4: 'DEMO CURSOS', 11: '8599604', 12: '8593700', 10: '20200110', 20: '0256' }),
        ]),
      ],
      empresas: [
        write('P2.csv', [empresa(), empresa({ 0: '33333333', 1: 'DEMO CURSOS LTDA', 5: '01' })]),
      ],
      municipios: write('P3.csv', [['0255', 'MANAUS'], ['0256', 'PARINTINS']]),
      ufs: ['AM'],
      importTag: '2026-08',
    });
    const provider = new ReceitaFederalProvider(db);
    await provider.refresh();
    return provider;
  }

  it('reports itself unconfigured until something has been imported', async () => {
    await db.receitaEstablishment.deleteMany();
    const provider = new ReceitaFederalProvider(db);
    await provider.refresh();
    expect(provider.isConfigured()).toBe(false);
    // Unconfigured, not empty: the pipeline maps this to UNAVAILABLE rather
    // than reporting a country with no companies in it.
    await expect(provider.searchCompanies({ countryCode: 'BR' })).rejects.toThrow(/No Receita Federal snapshot/);
  });

  it('filters by CNAE, including secondary codes', async () => {
    const provider = await loaded();
    const primary = await provider.searchCompanies({ countryCode: 'BR', registryCodes: ['7111100'] });
    expect(primary.companies.map((c) => c.companyNumber)).toEqual(['12345678000195']);

    const secondary = await provider.searchCompanies({ countryCode: 'BR', registryCodes: ['7119703'] });
    expect(secondary.companies).toHaveLength(1);
  });

  it('filters by municipality and by incorporation window', async () => {
    const provider = await loaded();
    const manaus = await provider.searchCompanies({ countryCode: 'BR', location: 'Manaus' });
    expect(manaus.companies).toHaveLength(1);

    const since2021 = await provider.searchCompanies({
      countryCode: 'BR',
      incorporatedFrom: new Date('2021-01-01T00:00:00Z'),
    });
    expect(since2021.companies).toHaveLength(1);
  });

  it('carries the size signals through, so the estimate has something to read', async () => {
    const provider = await loaded();
    const page = await provider.searchCompanies({ countryCode: 'BR', registryCodes: ['7111100'] });
    expect(page.companies[0]?.sizeSignals).toEqual({ porte: '03', capitalSocial: 180000 });
  });

  it('prefers the trading name, which is what a website search can match', async () => {
    const provider = await loaded();
    const page = await provider.searchCompanies({ countryCode: 'BR', registryCodes: ['7111100'] });
    expect(page.companies[0]?.name).toBe('DEMO ARQUITETURA');
  });

  it('says which snapshot the answers come from', async () => {
    const provider = await loaded();
    const snapshot = await provider.currentImport();
    expect(snapshot?.tag).toBe('2026-08');
    expect(snapshot?.rows).toBe(2);
  });

  it('reports NOT_FOUND for a CNPJ outside the snapshot, and says why', async () => {
    const provider = await loaded();
    const lookup = await provider.getCompanyDetails('00000000000000');
    expect(lookup.kind).toBe('NOT_FOUND');
    if (lookup.kind === 'NOT_FOUND') {
      expect(lookup.note).toContain('imported states');
    }
  });

  it('accepts a formatted CNPJ as readily as a bare one', async () => {
    const provider = await loaded();
    const lookup = await provider.getCompanyDetails('12.345.678/0001-95');
    expect(lookup.kind).toBe('FOUND');
  });
});
