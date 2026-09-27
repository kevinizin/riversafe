import {
  buildOutreachFacts,
  buildPreviewBriefing,
  renderPreviewHtml,
  requireCountry,
  type PreviewBriefing,
} from '@woh/core';
import { prisma } from '@woh/db';
import { NextResponse, type NextRequest } from 'next/server';
import { audit, getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Serves the demonstration homepage for one lead.
 *
 * The page is generated on request from the stored briefing and returned to the
 * signed-in operator. It is never pushed anywhere: there is no publish step, no
 * hosting, and no URL that a prospect could be sent without the operator
 * deciding to send it.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      industries: { where: { isPrimary: true }, take: 1 },
      socials: true,
      outreach: {
        where: { channel: 'website_preview' },
        orderBy: { generatedAt: 'desc' },
        take: 1,
      },
      websites: {
        where: { isPrimary: true },
        take: 1,
        include: { analyses: { orderBy: { fetchedAt: 'desc' }, take: 1 } },
      },
    },
  });
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const stored = company.outreach[0]?.previewBriefing as PreviewBriefing | undefined;
  const briefing = stored ?? buildBriefing(company);

  const html = renderPreviewHtml(briefing, {
    preparedBy: user.name,
    ...(request.nextUrl.searchParams.get('as')
      ? { preparedByBusiness: request.nextUrl.searchParams.get('as')! }
      : {}),
  });

  await audit(user.userId, 'preview.viewed', 'company', company.id);

  const download = request.nextUrl.searchParams.get('download') === '1';
  const filename = `${slug(company.name)}-concept.html`;

  return new NextResponse(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      // A generated page must never be framed by anything but this app.
      'x-frame-options': 'SAMEORIGIN',
      ...(download ? { 'content-disposition': `attachment; filename="${filename}"` } : {}),
    },
  });
}

type CompanyForBriefing = Awaited<ReturnType<typeof prisma.company.findUnique>> & {
  industries: { industryKey: string }[];
  websites: { domain: string; analyses: { brandColourHints: string[]; qualityScore: number | null; weaknesses: string[] }[] }[];
};

/** Falls back to building a briefing when none has been generated yet. */
function buildBriefing(company: NonNullable<CompanyForBriefing>): PreviewBriefing {
  const country = requireCountry(company.countryCode);
  const analysis = company.websites[0]?.analyses[0];
  return buildPreviewBriefing({
    companyName: company.name,
    industryKey: company.industries[0]?.industryKey,
    city: company.city,
    region: company.region,
    countryName: country.name,
    currency: country.currency,
    language: country.language,
    facts: buildOutreachFacts({
      companyName: company.name,
      city: company.city,
      incorporationDate: company.incorporationDate,
      industryKey: company.industries[0]?.industryKey,
      websiteStatus: company.websiteStatus,
      websiteStatusNote: company.websiteStatusNote,
      websiteDomain: company.websites[0]?.domain,
      websiteQualityScore: analysis?.qualityScore,
      websiteWeaknesses: analysis?.weaknesses ?? [],
      reviewCount: company.reviewCount,
      rating: company.rating,
    }),
    brandColourHints: analysis?.brandColourHints ?? [],
    brandSourceDomain: company.websites[0]?.domain ?? null,
    phone: company.phone,
    email: company.email,
    reviewCount: company.reviewCount,
    rating: company.rating,
  });
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'company'
  );
}
