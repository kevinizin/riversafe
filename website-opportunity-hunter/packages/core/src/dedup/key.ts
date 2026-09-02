import { postcodeKey as ukPostcodeKey } from '../geo/uk.js';
import { normaliseCompanyName, normaliseDomain, normalisePhone } from './normalize.js';

export interface DedupeInput {
  countryCode: string;
  companyNumber?: string | null;
  name: string;
  website?: string | null;
  phone?: string | null;
  postcode?: string | null;
  city?: string | null;
  legalSuffixes?: string[];
}

export interface DedupeCandidateKeys {
  /** The stable primary key stored on the company row. */
  primary: string;
  /** Every key this company could also be recognised by, strongest first. */
  alternates: string[];
  normalisedName: string;
  postcodeKey: string | null;
  domain: string | null;
  phoneKey: string | null;
}

/**
 * Identity keys for a company.
 *
 * Priority is registry number > domain > name+postcode > name+city. The registry
 * number is the only truly authoritative identifier; the rest are heuristics and
 * are only ever used to *find* a possible existing row, never to merge blindly.
 */
export function dedupeKeys(input: DedupeInput): DedupeCandidateKeys {
  const country = input.countryCode.toUpperCase();
  const normalisedName = normaliseCompanyName(input.name, input.legalSuffixes);
  const pcKey = country === 'GB' ? ukPostcodeKey(input.postcode) : (input.postcode?.replace(/\s+/g, '').toUpperCase() ?? null);
  const domain = normaliseDomain(input.website);
  const phoneKey = normalisePhone(input.phone, country);

  const alternates: string[] = [];
  if (input.companyNumber) alternates.push(`${country}:reg:${input.companyNumber.trim().toUpperCase()}`);
  if (domain) alternates.push(`${country}:domain:${domain}`);
  if (normalisedName && pcKey) alternates.push(`${country}:name-postcode:${normalisedName}:${pcKey}`);
  if (phoneKey) alternates.push(`${country}:phone:${phoneKey}`);
  if (normalisedName && input.city) {
    alternates.push(`${country}:name-city:${normalisedName}:${input.city.trim().toLowerCase()}`);
  }

  const primary = alternates[0] ?? `${country}:name:${normalisedName || input.name.toLowerCase()}`;
  return { primary, alternates, normalisedName, postcodeKey: pcKey, domain, phoneKey };
}
