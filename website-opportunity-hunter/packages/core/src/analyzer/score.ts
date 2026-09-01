import type { PageFacts } from './extract.js';

export interface QualityCheck {
  key: string;
  label: string;
  /** Relative importance. The final score is passed weight / applicable weight. */
  weight: number;
  /** False when the check does not apply to this business (e.g. online booking
   *  for a law firm). Inapplicable checks are excluded from the denominator so
   *  a business is never marked down for lacking something it does not need. */
  applicable: boolean;
  passed: boolean;
  /** What was observed. Populated for passes and failures alike. */
  evidence: string;
  /** Sentence used in the weaknesses list when the check fails. */
  weakness?: string;
}

export interface WebsiteQuality {
  score: number;
  checks: QualityCheck[];
  weaknesses: string[];
  strengths: string[];
}

export interface QualityContext {
  responseTimeMs?: number;
  /** From the industry profile. Controls whether booking is expected. */
  bookingExpected?: boolean;
  brokenLinkCount?: number;
  checkedLinkCount?: number;
}

const TITLE_MIN = 15;
const TITLE_MAX = 70;
const SLOW_MS = 2_500;

/**
 * Scores a website 0–100 from observed facts.
 *
 * Two deliberate constraints:
 *  1. Every check is mechanical. There is no "the design looks dated" check —
 *     only "the markup contains <font> tags", which a human can verify.
 *  2. Inapplicable checks leave the denominator, so a solicitor without an
 *     online booking widget is not penalised for it.
 */
export function scoreWebsite(facts: PageFacts, ctx: QualityContext = {}): WebsiteQuality {
  const bookingExpected = ctx.bookingExpected ?? false;
  const titleLength = facts.title?.length ?? 0;
  const hasContactRoute = facts.hasContactForm || facts.emails.length > 0 || facts.phones.length > 0;

  const checks: QualityCheck[] = [
    {
      key: 'https',
      label: 'Served over HTTPS',
      weight: 8,
      applicable: true,
      passed: facts.https,
      evidence: facts.https ? 'final URL uses https://' : 'final URL uses http://',
      weakness: 'No HTTPS — browsers show the site as "Not secure"',
    },
    {
      key: 'responsive',
      label: 'Mobile viewport declared',
      weight: 10,
      applicable: true,
      passed: facts.hasViewportMeta,
      evidence: facts.hasViewportMeta
        ? '<meta name="viewport"> is present'
        : 'no <meta name="viewport"> tag, so the page will not adapt to phones',
      weakness: 'Not built for mobile — no viewport tag, so phones render the desktop layout',
    },
    {
      key: 'title',
      label: 'Useful page title',
      weight: 6,
      applicable: true,
      passed: titleLength >= TITLE_MIN && titleLength <= TITLE_MAX,
      evidence: facts.title
        ? `<title> is ${titleLength} characters: "${facts.title.slice(0, 80)}"`
        : 'no <title> tag',
      weakness: facts.title
        ? `Page title is ${titleLength} characters — outside the ${TITLE_MIN}–${TITLE_MAX} range search results display well`
        : 'No page title',
    },
    {
      key: 'meta_description',
      label: 'Meta description',
      weight: 5,
      applicable: true,
      passed: !!facts.metaDescription && facts.metaDescription.length >= 50,
      evidence: facts.metaDescription
        ? `meta description is ${facts.metaDescription.length} characters`
        : 'no meta description',
      weakness: 'No meta description — Google writes its own snippet for the listing',
    },
    {
      key: 'h1',
      label: 'Exactly one H1',
      weight: 4,
      applicable: true,
      passed: facts.h1Texts.length === 1,
      evidence: `${facts.h1Texts.length} <h1> element(s)`,
      weakness:
        facts.h1Texts.length === 0
          ? 'No H1 heading, so the page has no stated subject'
          : `${facts.h1Texts.length} H1 headings competing as the page subject`,
    },
    {
      key: 'cta',
      label: 'Clear call to action',
      weight: 10,
      applicable: true,
      passed: facts.hasCtaButton,
      evidence: facts.ctaEvidence ?? 'no recognised call-to-action wording found',
      weakness: 'No clear call to action — nothing tells a visitor what to do next',
    },
    {
      key: 'phone',
      label: 'Phone number on the page',
      weight: 6,
      applicable: true,
      passed: facts.phones.length > 0,
      evidence: facts.phones.length ? `${facts.phones.length} phone number(s) found` : 'no phone number found',
      weakness: 'No phone number on the homepage',
    },
    {
      key: 'contact_route',
      label: 'A way to make contact',
      weight: 6,
      applicable: true,
      passed: hasContactRoute,
      evidence: [
        facts.hasContactForm ? 'contact form' : null,
        facts.emails.length ? 'email address' : null,
        facts.phones.length ? 'phone number' : null,
      ]
        .filter(Boolean)
        .join(', ') || 'no form, email address or phone number found',
      weakness: 'No contact form, email address or phone number on the homepage',
    },
    {
      key: 'booking',
      label: 'Online booking',
      weight: 8,
      applicable: bookingExpected,
      passed: facts.hasBookingSignal,
      evidence: facts.bookingEvidence ?? 'no booking link or booking wording found',
      weakness: 'No online booking, which customers in this sector expect',
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp contact',
      weight: 2,
      applicable: true,
      passed: facts.hasWhatsApp,
      evidence: facts.hasWhatsApp ? 'wa.me or WhatsApp link found' : 'no WhatsApp link',
      weakness: 'No WhatsApp option for quick enquiries',
    },
    {
      key: 'map',
      label: 'Map or location embed',
      weight: 4,
      applicable: true,
      passed: facts.hasMap,
      evidence: facts.hasMap ? 'map embed or maps link found' : 'no map or maps link',
      weakness: 'No map, so customers cannot see where the business is',
    },
    {
      key: 'service_pages',
      label: 'Service pages',
      weight: 8,
      applicable: true,
      passed: facts.servicePages.length >= 2,
      evidence: facts.servicePages.length
        ? `${facts.servicePages.length} service page link(s): ${facts.servicePages.slice(0, 3).join(', ')}`
        : 'no service or treatment pages linked from the homepage',
      weakness: 'No service-specific pages — one page has to rank for everything',
    },
    {
      key: 'location_pages',
      label: 'Location pages',
      weight: 4,
      applicable: true,
      passed: facts.locationPages.length >= 1,
      evidence: facts.locationPages.length
        ? `${facts.locationPages.length} location page link(s)`
        : 'no location or areas-covered pages',
      weakness: 'No location pages, which local search rewards',
    },
    {
      key: 'testimonials',
      label: 'Reviews or testimonials',
      weight: 5,
      applicable: true,
      passed: facts.hasTestimonials,
      evidence: facts.testimonialEvidence ?? 'no testimonial or review section found',
      weakness: 'No reviews or testimonials shown',
    },
    {
      key: 'trust',
      label: 'Accreditations or guarantees',
      weight: 4,
      applicable: true,
      passed: facts.hasTrustSignals,
      evidence: facts.trustEvidence ?? 'no accreditation or guarantee wording found',
      weakness: 'No accreditations, guarantees or regulator references',
    },
    {
      key: 'privacy',
      label: 'Privacy policy',
      weight: 4,
      applicable: true,
      passed: facts.hasPrivacyPage,
      evidence: facts.hasPrivacyPage ? 'privacy policy link found' : 'no privacy policy link',
      weakness: 'No privacy policy link — a UK GDPR requirement for a site that collects enquiries',
    },
    {
      key: 'cookies',
      label: 'Cookie notice',
      weight: 2,
      applicable: true,
      passed: facts.hasCookieNotice,
      evidence: facts.hasCookieNotice ? 'cookie consent wording found' : 'no cookie consent wording',
      weakness: 'No cookie notice',
    },
    {
      key: 'speed',
      label: 'Responded quickly',
      weight: 6,
      applicable: ctx.responseTimeMs !== undefined,
      passed: (ctx.responseTimeMs ?? 0) < SLOW_MS,
      evidence:
        ctx.responseTimeMs !== undefined
          ? `homepage responded in ${ctx.responseTimeMs}ms`
          : 'response time not measured',
      weakness: `Slow to respond (${ctx.responseTimeMs}ms for the homepage)`,
    },
    {
      key: 'modern_markup',
      label: 'No obsolete markup',
      weight: 4,
      applicable: true,
      passed: facts.outdatedHints.length === 0,
      evidence: facts.outdatedHints.length
        ? `obsolete markup found: ${facts.outdatedHints.join(', ')}`
        : 'no obsolete markup found',
      weakness: `Dated build — ${facts.outdatedHints.join(', ')}`,
    },
    {
      key: 'image_alt',
      label: 'Images have alt text',
      weight: 4,
      applicable: facts.totalImages > 0,
      passed: facts.totalImages > 0 && facts.imagesMissingAlt / facts.totalImages <= 0.25,
      evidence: `${facts.imagesMissingAlt} of ${facts.totalImages} images have no alt text`,
      weakness: `${facts.imagesMissingAlt} of ${facts.totalImages} images have no alt text (accessibility)`,
    },
    {
      key: 'lang',
      label: 'Language declared',
      weight: 2,
      applicable: true,
      passed: !!facts.lang,
      evidence: facts.lang ? `<html lang="${facts.lang}">` : 'no lang attribute on <html>',
      weakness: 'No language attribute on <html> (accessibility)',
    },
    {
      key: 'social',
      label: 'Links to social profiles',
      weight: 3,
      applicable: true,
      passed: facts.socialLinks.length > 0,
      evidence: facts.socialLinks.length
        ? `links to ${facts.socialLinks.map((s) => s.platform).join(', ')}`
        : 'no social profile links',
      weakness: 'No links to social profiles',
    },
    {
      key: 'links_work',
      label: 'Sampled links resolve',
      weight: 3,
      applicable: (ctx.checkedLinkCount ?? 0) > 0,
      passed: (ctx.brokenLinkCount ?? 0) === 0,
      evidence:
        (ctx.checkedLinkCount ?? 0) > 0
          ? `${ctx.brokenLinkCount ?? 0} of ${ctx.checkedLinkCount} sampled links failed`
          : 'no links sampled',
      weakness: `${ctx.brokenLinkCount} of ${ctx.checkedLinkCount} sampled links are broken`,
    },
  ];

  const applicable = checks.filter((c) => c.applicable);
  const totalWeight = applicable.reduce((sum, c) => sum + c.weight, 0);
  const earned = applicable.filter((c) => c.passed).reduce((sum, c) => sum + c.weight, 0);
  const score = totalWeight === 0 ? 0 : Math.round((earned / totalWeight) * 100);

  const weaknesses = applicable
    .filter((c) => !c.passed && c.weakness)
    .sort((a, b) => b.weight - a.weight)
    .map((c) => c.weakness!);

  const strengths = applicable
    .filter((c) => c.passed)
    .sort((a, b) => b.weight - a.weight)
    .map((c) => c.label);

  return { score, checks, weaknesses, strengths };
}

/** Bands used by the search filters and the lead card. */
export type WebsiteQualityBand = 'STRONG' | 'ADEQUATE' | 'WEAK' | 'VERY_WEAK';

export function qualityBand(score: number): WebsiteQualityBand {
  if (score >= 75) return 'STRONG';
  if (score >= 55) return 'ADEQUATE';
  if (score >= 35) return 'WEAK';
  return 'VERY_WEAK';
}
