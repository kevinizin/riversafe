/**
 * UK geography for search filters and light normalisation.
 *
 * Two honest limitations, surfaced in the UI rather than hidden:
 *  1. Postcode areas do not align perfectly with national borders (SY, CH and
 *     LD straddle the England–Wales boundary), so `nationFromPostcode` returns
 *     a confidence alongside its answer.
 *  2. The city list is a convenience shortlist. Any free-text town is accepted —
 *     the search passes it to the provider's own location filter.
 */

export type UkNation = 'England' | 'Scotland' | 'Wales' | 'Northern Ireland';

export const UK_NATIONS: UkNation[] = ['England', 'Scotland', 'Wales', 'Northern Ireland'];

/** Postcode areas wholly within each devolved nation. */
const SCOTLAND_AREAS = new Set([
  'AB', 'DD', 'DG', 'EH', 'FK', 'G', 'HS', 'IV', 'KA', 'KW', 'KY', 'ML', 'PA', 'PH', 'TD', 'ZE',
]);
const NI_AREAS = new Set(['BT']);
const WALES_AREAS = new Set(['CF', 'LL', 'NP', 'SA']);
/** Areas that genuinely span the England–Wales border. */
const BORDER_AREAS = new Set(['CH', 'LD', 'SY', 'HR', 'SR']);

export interface UkCity {
  name: string;
  nation: UkNation;
  /** Postcode areas most associated with the city. Used for display and for
   *  sanity-checking a registered office against a requested city. */
  postcodeAreas: string[];
}

export const UK_CITIES: UkCity[] = [
  { name: 'London', nation: 'England', postcodeAreas: ['E', 'EC', 'N', 'NW', 'SE', 'SW', 'W', 'WC'] },
  { name: 'Manchester', nation: 'England', postcodeAreas: ['M'] },
  { name: 'Birmingham', nation: 'England', postcodeAreas: ['B'] },
  { name: 'Liverpool', nation: 'England', postcodeAreas: ['L'] },
  { name: 'Leeds', nation: 'England', postcodeAreas: ['LS'] },
  { name: 'Sheffield', nation: 'England', postcodeAreas: ['S'] },
  { name: 'Bristol', nation: 'England', postcodeAreas: ['BS'] },
  { name: 'Newcastle upon Tyne', nation: 'England', postcodeAreas: ['NE'] },
  { name: 'Nottingham', nation: 'England', postcodeAreas: ['NG'] },
  { name: 'Leicester', nation: 'England', postcodeAreas: ['LE'] },
  { name: 'Southampton', nation: 'England', postcodeAreas: ['SO'] },
  { name: 'Brighton', nation: 'England', postcodeAreas: ['BN'] },
  { name: 'Coventry', nation: 'England', postcodeAreas: ['CV'] },
  { name: 'Reading', nation: 'England', postcodeAreas: ['RG'] },
  { name: 'Milton Keynes', nation: 'England', postcodeAreas: ['MK'] },
  { name: 'Norwich', nation: 'England', postcodeAreas: ['NR'] },
  { name: 'Plymouth', nation: 'England', postcodeAreas: ['PL'] },
  { name: 'Oxford', nation: 'England', postcodeAreas: ['OX'] },
  { name: 'Cambridge', nation: 'England', postcodeAreas: ['CB'] },
  { name: 'York', nation: 'England', postcodeAreas: ['YO'] },
  { name: 'Glasgow', nation: 'Scotland', postcodeAreas: ['G'] },
  { name: 'Edinburgh', nation: 'Scotland', postcodeAreas: ['EH'] },
  { name: 'Aberdeen', nation: 'Scotland', postcodeAreas: ['AB'] },
  { name: 'Dundee', nation: 'Scotland', postcodeAreas: ['DD'] },
  { name: 'Cardiff', nation: 'Wales', postcodeAreas: ['CF'] },
  { name: 'Swansea', nation: 'Wales', postcodeAreas: ['SA'] },
  { name: 'Newport', nation: 'Wales', postcodeAreas: ['NP'] },
  { name: 'Belfast', nation: 'Northern Ireland', postcodeAreas: ['BT'] },
];

const UK_POSTCODE_RE =
  /^([A-Z]{1,2})([0-9][A-Z0-9]?)\s*([0-9][A-Z]{2})$/i;

/** Uppercased, single-spaced. Returns null when the input is not a UK postcode. */
export function normalisePostcode(input: string | null | undefined): string | null {
  if (!input) return null;
  const compact = input.replace(/\s+/g, '').toUpperCase();
  const m = UK_POSTCODE_RE.exec(compact);
  if (!m) return null;
  return `${m[1]}${m[2]} ${m[3]}`;
}

/** Space-free key used for exact-match deduplication. */
export function postcodeKey(input: string | null | undefined): string | null {
  const normalised = normalisePostcode(input);
  return normalised ? normalised.replace(' ', '') : null;
}

/** The letter prefix, e.g. "M1 4AA" -> "M". */
export function postcodeArea(input: string | null | undefined): string | null {
  const normalised = normalisePostcode(input);
  if (!normalised) return null;
  return /^[A-Z]{1,2}/.exec(normalised)?.[0] ?? null;
}

export function nationFromPostcode(
  input: string | null | undefined,
): { nation: UkNation; confidence: 'HIGH' | 'MEDIUM' } | null {
  const area = postcodeArea(input);
  if (!area) return null;
  if (NI_AREAS.has(area)) return { nation: 'Northern Ireland', confidence: 'HIGH' };
  if (SCOTLAND_AREAS.has(area)) return { nation: 'Scotland', confidence: 'HIGH' };
  if (WALES_AREAS.has(area)) return { nation: 'Wales', confidence: 'HIGH' };
  if (BORDER_AREAS.has(area)) return { nation: 'England', confidence: 'MEDIUM' };
  return { nation: 'England', confidence: 'HIGH' };
}

export function findCity(name: string | null | undefined): UkCity | undefined {
  if (!name) return undefined;
  const needle = name.trim().toLowerCase();
  return UK_CITIES.find((c) => c.name.toLowerCase() === needle);
}

/** Region label for display: the known city's nation, else the postcode's. */
export function deriveRegion(city: string | null | undefined, postcode: string | null | undefined): string | null {
  return findCity(city)?.nation ?? nationFromPostcode(postcode)?.nation ?? null;
}
