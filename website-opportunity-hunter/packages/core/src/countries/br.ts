import type { CountryProfile } from './types.js';
import { AMAZONAS_MUNICIPALITIES, HOME_MUNICIPALITY, cepKey, normaliseCep } from '../geo/br.js';

/**
 * Brazil.
 *
 * `regions` lists Amazonas alone, and that is not an oversight. The Receita
 * Federal publishes the whole country, but this installation loads only
 * `UF = AM` — offering the other twenty-six states in the search form would
 * promise data that is not in the database.
 *
 * The three differences from the United Kingdom that actually change behaviour:
 *
 *  1. There is no search API. Companies arrive from a monthly bulk load, so
 *     "incorporated in the last 30 days" is as fresh as the last import, not as
 *     fresh as this morning. The UI says which import it is answering from.
 *  2. Company size comes from `porte` and `capital social`, not from a filed
 *     accounts category.
 *  3. The dump carries the full partner list, names included, for every
 *     company. That is a far larger personal-data surface than the UK officer
 *     register, and it is excluded from the load by default.
 */
export const BRAZIL: CountryProfile = {
  code: 'BR',
  name: 'Brasil',
  currency: 'BRL',
  currencySymbol: 'R$',
  language: 'pt-BR',
  timezone: 'America/Manaus',
  companyProviders: ['receita_federal'],
  regions: ['Amazonas'],
  cities: [
    HOME_MUNICIPALITY,
    ...AMAZONAS_MUNICIPALITIES.map((m) => m.name).filter((n) => n !== HOME_MUNICIPALITY),
  ],
  domainSuffixes: ['.com.br', '.com', '.net.br', '.arq.br', '.eng.br', '.adv.br', '.med.br'],
  legalSuffixes: [
    'ltda', 'ltda.', 'me', 'epp', 'eireli', 'mei', 'sa', 's/a', 'sas',
    'cia', 'companhia', 'sociedade', 'simples', 'empresarial', 'eirl',
  ],
  normalisePostcode: normaliseCep,
  postcodeKey: cepKey,
  privacyNotes: [
    'CNPJ registry data is published by the Receita Federal as open data.',
    'The dump includes the full partner list (QSA) with names; it is excluded from the load by default, because a partner is a natural person and the prospecting purpose does not require their identity.',
    'Processing basis for B2B prospecting is legitimate interest (LGPD Art. 7, IX), with the balancing test recorded in PRIVACY.md.',
    'Individual rights under the LGPD — access, correction, deletion, opposition — are served by the same controls as the UK: a full record view, an export, and a real cascading delete.',
    'A microempreendedor individual (MEI) is a natural person trading as a business; treat that record as personal data even though it carries a CNPJ.',
  ],
  enabled: true,
};
