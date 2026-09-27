/**
 * Brazilian geography for search filters and normalisation.
 *
 * The municipality list is the IBGE list for Amazonas, fetched from
 * servicodados.ibge.gov.br, with the official IBGE codes. Those codes matter:
 * the Receita Federal CNPJ files identify a municipality by its own code, and
 * the lookup table shipped with the dump is what maps between them.
 *
 * A deliberate omission: there is no CEP-prefix-to-state table here. The ranges
 * are real but I have not verified them, and the registry record already states
 * the UF outright — deriving it from a guessed range could only make the answer
 * worse.
 */

export const UF_LIST = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] as const;

export type Uf = (typeof UF_LIST)[number];

export const UF_NAMES: Record<Uf, string> = {
  AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahia',
  CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MG: 'Minas Gerais', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso',
  PA: 'Pará', PB: 'Paraíba', PE: 'Pernambuco', PI: 'Piauí', PR: 'Paraná',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RO: 'Rondônia', RR: 'Roraima',
  RS: 'Rio Grande do Sul', SC: 'Santa Catarina', SE: 'Sergipe',
  SP: 'São Paulo', TO: 'Tocantins',
};

export interface Municipality {
  name: string;
  /** IBGE municipality code, 7 digits. */
  ibgeCode: string;
}

/** Every municipality in Amazonas, from the IBGE localities API. */
export const AMAZONAS_MUNICIPALITIES: Municipality[] = [
  { name: "Alvarães", ibgeCode: '1300029' },
  { name: "Amaturá", ibgeCode: '1300060' },
  { name: "Anamã", ibgeCode: '1300086' },
  { name: "Anori", ibgeCode: '1300102' },
  { name: "Apuí", ibgeCode: '1300144' },
  { name: "Atalaia do Norte", ibgeCode: '1300201' },
  { name: "Autazes", ibgeCode: '1300300' },
  { name: "Barcelos", ibgeCode: '1300409' },
  { name: "Barreirinha", ibgeCode: '1300508' },
  { name: "Benjamin Constant", ibgeCode: '1300607' },
  { name: "Beruri", ibgeCode: '1300631' },
  { name: "Boa Vista do Ramos", ibgeCode: '1300680' },
  { name: "Boca do Acre", ibgeCode: '1300706' },
  { name: "Borba", ibgeCode: '1300805' },
  { name: "Caapiranga", ibgeCode: '1300839' },
  { name: "Canutama", ibgeCode: '1300904' },
  { name: "Carauari", ibgeCode: '1301001' },
  { name: "Careiro", ibgeCode: '1301100' },
  { name: "Careiro da Várzea", ibgeCode: '1301159' },
  { name: "Coari", ibgeCode: '1301209' },
  { name: "Codajás", ibgeCode: '1301308' },
  { name: "Eirunepé", ibgeCode: '1301407' },
  { name: "Envira", ibgeCode: '1301506' },
  { name: "Fonte Boa", ibgeCode: '1301605' },
  { name: "Guajará", ibgeCode: '1301654' },
  { name: "Humaitá", ibgeCode: '1301704' },
  { name: "Ipixuna", ibgeCode: '1301803' },
  { name: "Iranduba", ibgeCode: '1301852' },
  { name: "Itacoatiara", ibgeCode: '1301902' },
  { name: "Itamarati", ibgeCode: '1301951' },
  { name: "Itapiranga", ibgeCode: '1302009' },
  { name: "Japurá", ibgeCode: '1302108' },
  { name: "Juruá", ibgeCode: '1302207' },
  { name: "Jutaí", ibgeCode: '1302306' },
  { name: "Lábrea", ibgeCode: '1302405' },
  { name: "Manacapuru", ibgeCode: '1302504' },
  { name: "Manaquiri", ibgeCode: '1302553' },
  { name: "Manaus", ibgeCode: '1302603' },
  { name: "Manicoré", ibgeCode: '1302702' },
  { name: "Maraã", ibgeCode: '1302801' },
  { name: "Maués", ibgeCode: '1302900' },
  { name: "Nhamundá", ibgeCode: '1303007' },
  { name: "Nova Olinda do Norte", ibgeCode: '1303106' },
  { name: "Novo Airão", ibgeCode: '1303205' },
  { name: "Novo Aripuanã", ibgeCode: '1303304' },
  { name: "Parintins", ibgeCode: '1303403' },
  { name: "Pauini", ibgeCode: '1303502' },
  { name: "Presidente Figueiredo", ibgeCode: '1303536' },
  { name: "Rio Preto da Eva", ibgeCode: '1303569' },
  { name: "Santa Isabel do Rio Negro", ibgeCode: '1303601' },
  { name: "Santo Antônio do Içá", ibgeCode: '1303700' },
  { name: "Silves", ibgeCode: '1304005' },
  { name: "São Gabriel da Cachoeira", ibgeCode: '1303809' },
  { name: "São Paulo de Olivença", ibgeCode: '1303908' },
  { name: "São Sebastião do Uatumã", ibgeCode: '1303957' },
  { name: "Tabatinga", ibgeCode: '1304062' },
  { name: "Tapauá", ibgeCode: '1304104' },
  { name: "Tefé", ibgeCode: '1304203' },
  { name: "Tonantins", ibgeCode: '1304237' },
  { name: "Uarini", ibgeCode: '1304260' },
  { name: "Urucará", ibgeCode: '1304302' },
  { name: "Urucurituba", ibgeCode: '1304401' },];

/** Where the operator actually works. Shown first in the city picker. */
export const HOME_MUNICIPALITY = 'Manaus';

const CEP_RE = /^(\d{5})-?(\d{3})$/;

/** Canonical CEP as NNNNN-NNN, or null when the input is not one. */
export function normaliseCep(input: string | null | undefined): string | null {
  if (!input) return null;
  const compact = input.replace(/\D/g, '');
  const m = CEP_RE.exec(compact.length === 8 ? compact : input.trim());
  return m ? `${m[1]}-${m[2]}` : null;
}

/** Digits-only CEP, used as an exact-match deduplication key. */
export function cepKey(input: string | null | undefined): string | null {
  const normalised = normaliseCep(input);
  return normalised ? normalised.replace('-', '') : null;
}

/** Canonical 14-digit CNPJ, or null. Accepts the punctuated form. */
export function normaliseCnpj(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, '');
  return digits.length === 14 ? digits : null;
}

/** CNPJ formatted for display: 00.000.000/0001-00. */
export function formatCnpj(input: string | null | undefined): string | null {
  const digits = normaliseCnpj(input);
  if (!digits) return null;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/**
 * Check-digit validation for a CNPJ.
 *
 * Worth doing on input: a mistyped CNPJ that passes into a search silently
 * returns nothing, which reads like "no such company" rather than "typo".
 */
export function isValidCnpj(input: string | null | undefined): boolean {
  const digits = normaliseCnpj(input);
  if (!digits) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const checkDigit = (slice: string, weights: number[]): number => {
    const sum = weights.reduce((total, weight, i) => total + Number(slice[i]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const first = checkDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (first !== Number(digits[12])) return false;
  const second = checkDigit(digits.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return second === Number(digits[13]);
}

export function findMunicipality(name: string | null | undefined): Municipality | undefined {
  if (!name) return undefined;
  const needle = name.trim().toLowerCase();
  return AMAZONAS_MUNICIPALITIES.find((m) => m.name.toLowerCase() === needle);
}
