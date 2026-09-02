import 'server-only';
import { prisma, type Prisma } from '@woh/db';

export interface LeadQuery {
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
  return {
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
    where.currentClassification = query.classification as Prisma.CompanyWhereInput['currentClassification'];
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
  if (query.minScore !== undefined) where.currentScore = { gte: query.minScore };
  if (query.minReviews !== undefined) where.reviewCount = { gte: query.minReviews };
  if (query.minRating !== undefined) where.rating = { gte: query.minRating };
  if (query.social === 'yes') and.push({ socials: { some: {} } });
  if (query.social === 'no') and.push({ socials: { none: {} } });
  if (query.ageDays !== undefined) {
    and.push({ incorporationDate: { gte: new Date(Date.now() - query.ageDays * 86_400_000) } });
  }

  if (query.status) where.leadStatus = query.status as Prisma.CompanyWhereInput['leadStatus'];
  else where.leadStatus = { not: 'DISCARDED' };

  if (and.length) where.AND = and;
  return where;
}

export function leadOrderBy(sort: string | undefined): Prisma.CompanyOrderByWithRelationInput[] {
  switch (sort) {
    case 'newest':
      return [{ incorporationDate: 'desc' }, { name: 'asc' }];
    case 'reviews':
      return [{ reviewCount: 'desc' }, { currentScore: 'desc' }];
    case 'name':
      return [{ name: 'asc' }];
    case 'added':
      return [{ createdAt: 'desc' }];
    default:
      return [{ currentScore: 'desc' }, { incorporationDate: 'desc' }];
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
      orderBy: leadOrderBy(query.sort),
      skip: ((query.page ?? 1) - 1) * perPage,
      take: perPage,
    }),
    prisma.company.count({ where }),
  ]);
  return { rows, total };
}
