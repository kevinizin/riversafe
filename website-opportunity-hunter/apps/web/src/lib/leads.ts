import 'server-only';
import { prisma, type Prisma } from '@woh/db';

/**
 * Which question the list is answering. Everything score-shaped in a lead query
 * — the classification filter, the minimum score, the default sort — reads from
 * the columns of whichever axis is selected, so the operator switches the whole
 * board with one control instead of learning a second set of filters.
 */
export type LeadAxis = 'WEBSITE' | 'SYSTEM';

export interface LeadQuery {
  axis: LeadAxis;
  q?: string;
  classification?: string;
  website?: string;
  industry?: string;
  city?: string;
  region?: string;
  minScore?: number;
  minReviews?: number;
  minRating?: number;
  social?: string;
  status?: string;
  ageDays?: number;
  /** Minimum company age in days. The system axis wants the opposite of new. */
  minAgeDays?: number;
  /** Estimated size band, e.g. SMALL. Always an estimate — see enrichment/size. */
  sizeBand?: string;
  /** How the size estimate lines up with the target headcount. */
  sizeFit?: string;
  sort?: string;
  page?: number;
  perPage?: number;
}

export const LEAD_PAGE_SIZE = 20;

/** Parses the query string into a validated lead query. */
export function parseLeadQuery(params: Record<string, string | string[] | undefined>): LeadQuery {
  const one = (key: string): string | undefined => {
    const value = params[key];
    const text = Array.isArray(value) ? value[0] : value;
    return text && text.length ? text : undefined;
  };
  const num = (key: string): number | undefined => {
    const raw = one(key);
    if (raw === undefined) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const axis: LeadAxis = one('axis') === 'SYSTEM' ? 'SYSTEM' : 'WEBSITE';
  return {
    axis,
    q: one('q'),
    classification: one('classification'),
    website: one('website'),
    industry: one('industry'),
    city: one('city'),
    region: one('region'),
    minScore: num('minScore'),
    minReviews: num('minReviews'),
    minRating: num('minRating'),
    social: one('social'),
    status: one('status'),
    ageDays: num('ageDays'),
    minAgeDays: num('minAgeDays'),
    sizeBand: one('sizeBand'),
    sizeFit: one('sizeFit'),
    sort: one('sort') ?? 'score',
    page: Math.max(1, num('page') ?? 1),
    perPage: LEAD_PAGE_SIZE,
  };
}

/**
 * Translates a lead query into a Prisma filter.
 *
 * Discarded leads are hidden unless explicitly asked for: the operator has
 * already said no to those, and re-showing them wastes the only scarce resource
 * in prospecting, which is attention.
 */
export function leadWhere(query: LeadQuery): Prisma.CompanyWhereInput {
  const where: Prisma.CompanyWhereInput = { retentionStatus: 'ACTIVE' };
  const and: Prisma.CompanyWhereInput[] = [];

  if (query.q) {
    and.push({
      OR: [
        { name: { contains: query.q, mode: 'insensitive' } },
        { companyNumber: { contains: query.q, mode: 'insensitive' } },
        { city: { contains: query.q, mode: 'insensitive' } },
        { postcode: { contains: query.q, mode: 'insensitive' } },
      ],
    });
  }

  if (query.classification) {
    const value = query.classification as Prisma.CompanyWhereInput['currentClassification'];
    if (query.axis === 'SYSTEM') where.systemClassification = value;
    else where.currentClassification = value;
  }

  switch (query.website) {
    case 'NO_WEBSITE':
      where.websiteStatus = 'NO_WEBSITE_FOUND';
      break;
    case 'HAS_WEBSITE':
      where.websiteStatus = 'WEBSITE_FOUND';
      break;
    case 'WEAK_WEBSITE':
      and.push({ websites: { some: { analyses: { some: { qualityScore: { lt: 55 } } } } } });
      break;
    case 'NO_OR_WEAK':
      and.push({
        OR: [
          { websiteStatus: 'NO_WEBSITE_FOUND' },
          { websites: { some: { analyses: { some: { qualityScore: { lt: 55 } } } } } },
        ],
      });
      break;
    case 'UNCERTAIN':
      where.websiteStatus = 'WEBSITE_UNCERTAIN';
      break;
    default:
      break;
  }

  if (query.industry) and.push({ industries: { some: { industryKey: query.industry } } });
  if (query.city) where.city = { contains: query.city, mode: 'insensitive' };
  if (query.region) where.region = { contains: query.region, mode: 'insensitive' };
  if (query.minScore !== undefined) {
    if (query.axis === 'SYSTEM') where.systemScore = { gte: query.minScore };
    else where.currentScore = { gte: query.minScore };
  }
  if (query.minReviews !== undefined) where.reviewCount = { gte: query.minReviews };
  if (query.minRating !== undefined) where.rating = { gte: query.minRating };
  if (query.social === 'yes') and.push({ socials: { some: {} } });
  if (query.social === 'no') and.push({ socials: { none: {} } });
  if (query.ageDays !== undefined) {
    and.push({ incorporationDate: { gte: new Date(Date.now() - query.ageDays * 86_400_000) } });
  }
  if (query.minAgeDays !== undefined) {
    // "Older than", the filter the system axis needs and the website axis never
    // wanted. A company with no incorporation date is excluded rather than
    // assumed old: we do not know, and this filter is a claim about age.
    and.push({ incorporationDate: { lte: new Date(Date.now() - query.minAgeDays * 86_400_000) } });
  }
  if (query.sizeBand) where.sizeBand = query.sizeBand as Prisma.CompanyWhereInput['sizeBand'];
  if (query.sizeFit) where.sizeFit = query.sizeFit as Prisma.CompanyWhereInput['sizeFit'];

  if (query.status) where.leadStatus = query.status as Prisma.CompanyWhereInput['leadStatus'];
  else where.leadStatus = { not: 'DISCARDED' };

  if (and.length) where.AND = and;
  return where;
}

export function leadOrderBy(
  sort: string | undefined,
  axis: LeadAxis = 'WEBSITE',
): Prisma.CompanyOrderByWithRelationInput[] {
  // Nulls last on both axes: a company that has never been scored is not a
  // zero, and floating it to the top of a "best first" list would say it is.
  const score: Prisma.CompanyOrderByWithRelationInput =
    axis === 'SYSTEM' ? { systemScore: { sort: 'desc', nulls: 'last' } } : { currentScore: { sort: 'desc', nulls: 'last' } };
  switch (sort) {
    case 'newest':
      return [{ incorporationDate: 'desc' }, { name: 'asc' }];
    case 'oldest':
      return [{ incorporationDate: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }];
    case 'reviews':
      return [{ reviewCount: 'desc' }, score];
    case 'name':
      return [{ name: 'asc' }];
    case 'added':
      return [{ createdAt: 'desc' }];
    default:
      return [score, { incorporationDate: 'desc' }];
  }
}

export const LEAD_INCLUDE = {
  industries: { where: { isPrimary: true }, take: 1 },
  socials: true,
  signals: { orderBy: { detectedAt: 'desc' as const }, take: 5 },
  websites: {
    where: { isPrimary: true },
    take: 1,
    include: { analyses: { orderBy: { fetchedAt: 'desc' as const }, take: 1 } },
  },
} satisfies Prisma.CompanyInclude;

export type LeadRow = Prisma.CompanyGetPayload<{ include: typeof LEAD_INCLUDE }>;

export async function findLeads(query: LeadQuery): Promise<{ rows: LeadRow[]; total: number }> {
  const where = leadWhere(query);
  const perPage = query.perPage ?? LEAD_PAGE_SIZE;
  const [rows, total] = await Promise.all([
    prisma.company.findMany({
      where,
      include: LEAD_INCLUDE,
      orderBy: leadOrderBy(query.sort, query.axis),
      skip: ((query.page ?? 1) - 1) * perPage,
      take: perPage,
    }),
    prisma.company.count({ where }),
  ]);
  return { rows, total };
}
