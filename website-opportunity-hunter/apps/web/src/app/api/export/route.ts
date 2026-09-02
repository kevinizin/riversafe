import { LEAD_EXPORT_HEADERS, industryLabel, toCsv, type CsvValue } from '@woh/core';
import { prisma } from '@woh/db';
import { NextResponse, type NextRequest } from 'next/server';
import { audit, getCurrentUser } from '@/lib/auth';
import { LEAD_INCLUDE, leadOrderBy, leadWhere, parseLeadQuery } from '@/lib/leads';

export const dynamic = 'force-dynamic';

const MAX_EXPORT_ROWS = 5000;

/**
 * CSV export of the current lead filter.
 *
 * Authentication is checked here as well as in middleware: an API route that
 * returns company and contact data must never rely on a redirect for its
 * access control.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const query = parseLeadQuery(params);

  const rows = await prisma.company.findMany({
    where: leadWhere(query),
    include: { ...LEAD_INCLUDE, scores: { orderBy: { computedAt: 'desc' }, take: 1 } },
    orderBy: leadOrderBy(query.sort),
    take: MAX_EXPORT_ROWS,
  });

  const body = toCsv(
    LEAD_EXPORT_HEADERS,
    rows.map((company): CsvValue[] => {
      const website = company.websites[0];
      const analysis = website?.analyses[0];
      const social = (platform: string) => company.socials.find((s) => s.platform === platform)?.url ?? '';
      return [
        company.name,
        company.companyNumber ?? '',
        company.industries[0] ? industryLabel(company.industries[0].industryKey) : '',
        company.city ?? '',
        company.region ?? '',
        company.postcode ?? '',
        website ? website.url : '',
        company.websiteStatus,
        analysis?.qualityScore ?? '',
        company.currentScore ?? '',
        company.currentClassification ?? '',
        company.phone ?? '',
        company.email ?? '',
        social('INSTAGRAM'),
        social('FACEBOOK'),
        social('LINKEDIN'),
        company.reviewCount ?? '',
        company.rating ?? '',
        company.incorporationDate,
        company.leadStatus,
        company.scores[0]?.confidence ?? '',
      ];
    }),
  );

  await audit(user.userId, 'leads.exported', 'company', undefined, { rows: rows.length });

  const filename = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}
