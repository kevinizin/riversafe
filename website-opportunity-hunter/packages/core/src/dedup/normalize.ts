/** Normalisation helpers shared by deduplication, matching and verification. */

const DIACRITICS = /[̀-ͯ]/g;

export function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(DIACRITICS, '');
}

/**
 * Canonical company name for matching.
 *
 * "DEMO ROOFING CO LTD" and "Demo Roofing Company Limited" must collapse to the
 * same string, otherwise the same business is presented as two leads.
 */
export function normaliseCompanyName(name: string, legalSuffixes: string[] = DEFAULT_LEGAL_SUFFIXES): string {
  let out = stripDiacritics(name).toLowerCase();
  out = out.replace(/&/g, ' and ');
  out = out.replace(/[^a-z0-9]+/g, ' ').trim();
  out = out.replace(/^the\s+/, '');

  // Expand common abbreviations so "co" and "company" agree before suffixes go.
  out = ` ${out} `
    .replace(/\bco\b/g, 'company')
    .replace(/\bltd\b/g, 'limited')
    .replace(/\bplc\b/g, 'publiclimitedcompany')
    .trim();

  // The abbreviation expansion above rewrites "ltd" to "limited", so the
  // canonical expansions are always in the strip set even when a caller passes
  // only the abbreviated forms.
  const suffixes = new Set([
    ...legalSuffixes.map((s) => s.replace(/[^a-z]/g, '')),
    'limited',
    'company',
    'publiclimitedcompany',
  ]);
  let words = out.split(/\s+/).filter(Boolean);
  while (words.length > 1) {
    const last = words[words.length - 1]!;
    if (suffixes.has(last)) words = words.slice(0, -1);
    else break;
  }
  return words.join(' ');
}

export const DEFAULT_LEGAL_SUFFIXES = [
  'limited', 'ltd', 'company', 'plc', 'publiclimitedcompany', 'llp', 'lp',
  'cic', 'cio', 'holdings', 'group', 'uk',
];

/** Digits-only phone key, with the UK trunk prefix normalised away. */
export function normalisePhone(phone: string | null | undefined, countryCode = 'GB'): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (countryCode === 'GB') {
    if (digits.startsWith('+44')) digits = `0${digits.slice(3)}`;
    else if (digits.startsWith('0044')) digits = `0${digits.slice(4)}`;
    else if (digits.startsWith('44') && digits.length >= 12) digits = `0${digits.slice(2)}`;
  }
  digits = digits.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) return null;
  return digits;
}

/** Lower-cased registrable host without `www.`. Returns null for bad input. */
export function normaliseDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const host = new URL(withScheme).hostname.toLowerCase();
    return host.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

export function normaliseUrl(input: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

/** Address key used as a weak dedup signal: street number + postcode. */
export function addressKey(line1: string | null | undefined, postcodeKey: string | null): string | null {
  if (!postcodeKey) return null;
  const number = line1 ? /\d+[a-z]?/i.exec(line1)?.[0]?.toLowerCase() : undefined;
  return number ? `${number}|${postcodeKey}` : postcodeKey;
}

/**
 * Token-overlap similarity in [0,1]. Cheap and good enough for catching
 * "Demo Roofing" vs "Demo Roofing Services" at the same postcode.
 */
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(a.split(/\s+/).filter(Boolean));
  const tb = new Set(b.split(/\s+/).filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return shared / Math.max(ta.size, tb.size);
}
