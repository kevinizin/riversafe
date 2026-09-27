/**
 * The Receita Federal source, reading from the locally imported snapshot.
 *
 * Unlike every other provider in this directory, this one makes no network
 * calls. There is no free search API for the CNPJ register — the data is
 * published as monthly bulk files — so "searching" means querying what the last
 * import left behind.
 *
 * Two consequences the rest of the system has to live with, and which are
 * surfaced rather than hidden:
 *
 *  1. Results are as fresh as the last import, not as fresh as today. Every
 *     company carries the import tag it came from, and `isConfigured()` returns
 *     false when nothing has been imported at all, so an unloaded deployment
 *     reports UNAVAILABLE instead of silently returning nothing and looking
 *     like a country with no companies in it.
 *  2. Only the imported states exist. The Brazil country profile lists Amazonas
 *     alone for that reason.
 */

import type { Db } from '@woh/db';
import { type Lookup, type SourceCompany, found, notFound, sourced } from '../../../domain/types.js';
import { AppError } from '../../../domain/errors.js';
import { SITUACAO } from './layout.js';
import type {
  CompanySearchFilters,
  CompanySearchOptions,
  CompanySearchPage,
  CompanySourceProvider,
} from '../types.js';

const PROVIDER = 'receita_federal';

/** Registry status to the domain's own vocabulary. */
function mapStatus(situacao: string): SourceCompany['status'] {
  switch (situacao) {
    case SITUACAO.ATIVA:
      return 'ACTIVE';
    case SITUACAO.BAIXADA:
      return 'DISSOLVED';
    case SITUACAO.SUSPENSA:
    case SITUACAO.INAPTA:
      // Neither is dissolved: a suspended or unfit registration can be
      // regularised. OTHER keeps them out of the ACTIVE pool without asserting
      // the company is gone, and the scoring caps them anyway.
      return 'OTHER';
    case SITUACAO.NULA:
      return 'DISSOLVED';
    default:
      return 'UNKNOWN';
  }
}

type Row = Awaited<ReturnType<Db['receitaEstablishment']['findFirst']>>;

function toSourceCompany(row: NonNullable<Row>): SourceCompany {
  return {
    countryCode: 'BR',
    companyNumber: row.cnpj,
    // The trading name when there is one: it is what the business is actually
    // called, and what a website search has any chance of matching. The legal
    // name is kept in `raw` either way.
    name: row.nomeFantasia?.trim() || row.razaoSocial,
    status: mapStatus(row.situacao),
    ...(row.dataInicio ? { incorporationDate: row.dataInicio } : {}),
    // The domain calls these `sicCodes`; for Brazil they are CNAE subclasses.
    sicCodes: [row.cnaePrincipal, ...row.cnaeSecundaria],
    address: {
      ...(row.logradouro ? { line1: [row.logradouro, row.numero].filter(Boolean).join(', ') } : {}),
      ...(row.complemento ? { line2: row.complemento } : {}),
      ...(row.municipioNome ? { city: row.municipioNome } : {}),
      ...(row.uf ? { region: row.uf } : {}),
      ...(row.cep ? { postcode: row.cep } : {}),
      country: 'Brasil',
    },
    ...(row.telefone ? { phone: row.telefone } : {}),
    sizeSignals: {
      ...(row.porte ? { porte: row.porte } : {}),
      ...(row.capitalSocial !== null ? { capitalSocial: Number(row.capitalSocial) } : {}),
    },
    provider: PROVIDER,
    externalId: row.cnpj,
    // No public per-company URL is published for the open data, and the CNPJ
    // consultation page is a POST behind a captcha, so linking to it would send
    // the operator somewhere that cannot answer. Better no link than a bad one.
    raw: {
      razaoSocial: row.razaoSocial,
      nomeFantasia: row.nomeFantasia,
      situacao: row.situacao,
      matrizFilial: row.matrizFilial,
      naturezaJuridica: row.naturezaJuridica,
      porte: row.porte,
      capitalSocial: row.capitalSocial?.toString() ?? null,
      bairro: row.bairro,
      municipioCode: row.municipioCode,
      email: row.email,
      importTag: row.importTag,
      importedAt: row.importedAt,
    },
  };
}

export class ReceitaFederalProvider implements CompanySourceProvider {
  readonly name = PROVIDER;
  readonly countries = ['BR'];

  /**
   * Set by `refresh()`. Starts undefined rather than false so that a provider
   * which has never been asked is distinguishable from one that has been asked
   * and found the table empty.
   */
  private loaded: number | undefined;

  constructor(private readonly db: Db) {}

  /** Counts what has been imported. Call once at startup. */
  async refresh(): Promise<void> {
    this.loaded = await this.db.receitaEstablishment.count();
  }

  isConfigured(): boolean {
    return (this.loaded ?? 0) > 0;
  }

  /** The monthly snapshot the answers come from, for the UI to display. */
  async currentImport(): Promise<{ tag: string; importedAt: Date; rows: number } | null> {
    const row = await this.db.receitaEstablishment.findFirst({
      orderBy: { importedAt: 'desc' },
      select: { importTag: true, importedAt: true },
    });
    if (!row) return null;
    const rows = await this.db.receitaEstablishment.count({ where: { importTag: row.importTag } });
    return { tag: row.importTag, importedAt: row.importedAt, rows };
  }

  async searchCompanies(
    filters: CompanySearchFilters,
    options: CompanySearchOptions = {},
  ): Promise<CompanySearchPage> {
    if (!this.isConfigured()) {
      throw new AppError(
        'PROVIDER_NOT_CONFIGURED',
        'No Receita Federal snapshot has been imported yet, so there are no Brazilian companies to search. Run the importer first.',
        { retryable: false },
      );
    }

    const pageSize = Math.min(options.pageSize ?? 100, 500);
    const startIndex = options.startIndex ?? 0;

    const where: Record<string, unknown> = {};

    if (filters.registryCodes?.length) {
      // Secondary CNAEs count: a practice registered under one code and
      // trading under another is still the sector the operator asked for.
      where.OR = [
        { cnaePrincipal: { in: filters.registryCodes } },
        { cnaeSecundaria: { hasSome: filters.registryCodes } },
      ];
    }

    if (filters.location) {
      where.municipioNome = { contains: filters.location, mode: 'insensitive' };
    }

    if (filters.incorporatedFrom || filters.incorporatedTo) {
      where.dataInicio = {
        ...(filters.incorporatedFrom ? { gte: filters.incorporatedFrom } : {}),
        ...(filters.incorporatedTo ? { lte: filters.incorporatedTo } : {}),
      };
    }

    // The provider-native status values. `statuses` arrives in the pipeline's
    // vocabulary ("active"), so it is translated rather than passed through.
    const wanted = filters.statuses?.length ? filters.statuses : ['active'];
    const situacoes = wanted
      .map((s): string | undefined => {
        switch (s.toLowerCase()) {
          case 'active':
            return SITUACAO.ATIVA;
          case 'dissolved':
            return SITUACAO.BAIXADA;
          case 'inactive':
            return SITUACAO.SUSPENSA;
          default:
            return undefined;
        }
      })
      .filter((s): s is string => s !== undefined);
    if (situacoes.length) where.situacao = { in: situacoes };

    if (filters.nameIncludes) {
      where.razaoSocial = { contains: filters.nameIncludes, mode: 'insensitive' };
    }

    const [rows, total] = await Promise.all([
      this.db.receitaEstablishment.findMany({
        where,
        orderBy: [{ dataInicio: 'desc' }, { cnpj: 'asc' }],
        skip: startIndex,
        take: pageSize,
      }),
      this.db.receitaEstablishment.count({ where }),
    ]);

    const consumed = startIndex + rows.length;
    return {
      companies: rows.map(toSourceCompany),
      total,
      ...(consumed < total ? { nextStartIndex: consumed } : {}),
    };
  }

  async getCompanyDetails(companyId: string): Promise<Lookup<SourceCompany>> {
    const cnpj = companyId.replace(/\D/g, '');
    const row = await this.db.receitaEstablishment.findUnique({ where: { cnpj } });
    if (!row) {
      return notFound(
        [`CNPJ ${cnpj} in the imported snapshot`],
        'The snapshot covers only the imported states, and only as of its import date.',
      );
    }
    return found(
      sourced(toSourceCompany(row), 'HIGH', {
        source: PROVIDER,
        detectedAt: row.importedAt,
        excerpt: `Receita Federal open data, snapshot ${row.importTag}`,
      }),
    );
  }

  // getOfficers is deliberately not implemented. The bulk data does publish a
  // partner list (QSA) with names, but a partner is a natural person and the
  // prospecting purpose does not require their identity, so that table is not
  // imported at all. The pipeline records the stage as SKIPPED. See PRIVACY.md.
}
