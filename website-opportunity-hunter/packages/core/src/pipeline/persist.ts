import type { Company, Db, Prisma } from '@woh/db';
import type { SourceCompany } from '../domain/types.js';
import { requireCountry } from '../countries/registry.js';
import { dedupeKeys } from '../dedup/key.js';
import { findDuplicate, type MatchCandidate } from '../dedup/match.js';
import { deriveRegion } from '../geo/uk.js';
import { normalisePhone } from '../dedup/normalize.js';

export interface UpsertResult {
  company: Company;
  isNew: boolean;
  /** Why an existing row was reused, for the audit trail. */
  duplicateReason?: string;
}

/**
 * Inserts a company, or recognises one we already hold.
 *
 * Existing rows are enriched, never overwritten: a field is only filled in when
 * it is currently empty. That keeps a later, thinner source from erasing better
 * data obtained earlier.
 */
export async function upsertCompany(
  db: Db,
  source: SourceCompany,
  dataSource: string,
): Promise<UpsertResult> {
  const country = requireCountry(source.countryCode);
  const keys = dedupeKeys({
    countryCode: source.countryCode,
    ...(source.companyNumber ? { companyNumber: source.companyNumber } : {}),
    name: source.name,
    ...(source.website ? { website: source.website } : {}),
    ...(source.phone ? { phone: source.phone } : {}),
    ...(source.address.postcode ? { postcode: source.address.postcode } : {}),
    ...(source.address.city ? { city: source.address.city } : {}),
    legalSuffixes: country.legalSuffixes,
  });

  const or: Prisma.CompanyWhereInput[] = [{ dedupeKey: { in: keys.alternates } }];
  if (source.companyNumber) or.push({ companyNumber: source.companyNumber });
  if (keys.domain) or.push({ websites: { some: { domain: keys.domain } } });
  if (keys.postcodeKey && keys.normalisedName) {
    or.push({ AND: [{ postcodeKey: keys.postcodeKey }, { normalizedName: keys.normalisedName }] });
  }
  if (keys.phoneKey) or.push({ phone: source.phone ?? undefined });

  const existing = await db.company.findMany({
    where: { countryCode: source.countryCode.toUpperCase(), OR: or },
    include: { websites: { where: { isPrimary: true }, take: 1 } },
    take: 25,
  });

  const candidates: MatchCandidate[] = existing.map((c) => ({
    id: c.id,
    companyNumber: c.companyNumber,
    normalisedName: c.normalizedName,
    postcodeKey: c.postcodeKey,
    domain: c.websites[0]?.domain ?? null,
    phoneKey: normalisePhone(c.phone, c.countryCode),
  }));

  const match = findDuplicate(
    {
      ...(source.companyNumber ? { companyNumber: source.companyNumber } : {}),
      normalisedName: keys.normalisedName,
      postcodeKey: keys.postcodeKey,
      domain: keys.domain,
      phoneKey: keys.phoneKey,
    },
    candidates,
  );

  const region = deriveRegion(source.address.city, source.address.postcode) ?? source.address.region ?? null;

  if (match) {
    const current = existing.find((c) => c.id === match.candidate.id)!;
    const fillIn: Prisma.CompanyUpdateInput = {};
    if (!current.companyNumber && source.companyNumber) fillIn.companyNumber = source.companyNumber;
    if (!current.incorporationDate && source.incorporationDate) fillIn.incorporationDate = source.incorporationDate;
    if (current.sicCodes.length === 0 && source.sicCodes.length) fillIn.sicCodes = source.sicCodes;
    if (!current.city && source.address.city) fillIn.city = source.address.city;
    if (!current.postcode && source.address.postcode) {
      fillIn.postcode = source.address.postcode;
      fillIn.postcodeKey = keys.postcodeKey;
    }
    if (!current.region && region) fillIn.region = region;
    if (!current.phone && source.phone) fillIn.phone = source.phone;
    if (current.status === 'UNKNOWN' && source.status !== 'UNKNOWN') fillIn.status = source.status;

    const company =
      Object.keys(fillIn).length > 0
        ? await db.company.update({ where: { id: current.id }, data: fillIn })
        : current;

    await recordSource(db, company.id, source);
    return { company, isNew: false, duplicateReason: match.reason };
  }

  const company = await db.company.create({
    data: {
      countryCode: source.countryCode.toUpperCase(),
      companyNumber: source.companyNumber ?? null,
      name: source.name,
      normalizedName: keys.normalisedName,
      dedupeKey: keys.primary,
      status: source.status,
      incorporationDate: source.incorporationDate ?? null,
      sicCodes: source.sicCodes,
      addressLine1: source.address.line1 ?? null,
      addressLine2: source.address.line2 ?? null,
      city: source.address.city ?? null,
      region,
      postcode: source.address.postcode ?? null,
      postcodeKey: keys.postcodeKey,
      country: source.address.country ?? null,
      phone: source.phone ?? null,
      dataSource,
    },
  });

  await recordSource(db, company.id, source);
  return { company, isNew: true };
}

async function recordSource(db: Db, companyId: string, source: SourceCompany): Promise<void> {
  await db.companySource.upsert({
    where: { provider_externalId: { provider: source.provider, externalId: source.externalId } },
    create: {
      companyId,
      provider: source.provider,
      externalId: source.externalId,
      sourceUrl: source.sourceUrl ?? null,
      payload: source.raw as Prisma.InputJsonValue,
    },
    update: { fetchedAt: new Date(), payload: source.raw as Prisma.InputJsonValue },
  });
}

/**
 * A dedupeKey collision can still happen when two source records resolve to the
 * same key in the same run. The caller retries through this helper, which finds
 * the row that won the race instead of failing the lead.
 */
export async function findByDedupeKey(db: Db, dedupeKey: string): Promise<Company | null> {
  return db.company.findUnique({ where: { dedupeKey } });
}
