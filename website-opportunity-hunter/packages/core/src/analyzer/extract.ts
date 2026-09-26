import * as cheerio from 'cheerio';
import type { SocialPlatform } from '../domain/types.js';
import { normaliseDomain } from '../dedup/normalize.js';

export interface ExtractedLink {
  href: string;
  absolute: string | null;
  text: string;
  internal: boolean;
}

export interface PageFacts {
  finalUrl: string;
  domain: string | null;
  https: boolean;

  title: string | null;
  metaDescription: string | null;
  h1Texts: string[];
  lang: string | null;
  hasViewportMeta: boolean;

  links: ExtractedLink[];
  socialLinks: { platform: SocialPlatform; url: string }[];
  phones: string[];
  emails: string[];

  hasContactForm: boolean;
  hasBookingSignal: boolean;
  bookingEvidence: string | null;
  hasWhatsApp: boolean;
  hasMap: boolean;
  hasCtaButton: boolean;
  ctaEvidence: string | null;

  servicePages: string[];
  locationPages: string[];
  hasTestimonials: boolean;
  testimonialEvidence: string | null;
  hasTrustSignals: boolean;
  trustEvidence: string | null;
  hasPrivacyPage: boolean;
  hasCookieNotice: boolean;

  totalImages: number;
  imagesMissingAlt: number;

  outdatedHints: string[];
  detectedPlatform: string | null;
  /** Distinctive colours used on the page, most frequent first. */
  brandColourHints: string[];

  /** Plain text of the page, capped. Used for industry hints and AI summaries. */
  text: string;
  textLength: number;
}

const SOCIAL_PATTERNS: { platform: SocialPlatform; test: RegExp }[] = [
  { platform: 'INSTAGRAM', test: /(^|\.)instagram\.com$/i },
  { platform: 'FACEBOOK', test: /(^|\.)(facebook\.com|fb\.com)$/i },
  { platform: 'LINKEDIN', test: /(^|\.)linkedin\.com$/i },
  { platform: 'X', test: /(^|\.)(twitter\.com|x\.com)$/i },
  { platform: 'TIKTOK', test: /(^|\.)tiktok\.com$/i },
  { platform: 'YOUTUBE', test: /(^|\.)(youtube\.com|youtu\.be)$/i },
  { platform: 'GOOGLE_BUSINESS', test: /(^|\.)(g\.page|maps\.app\.goo\.gl)$/i },
];

const BOOKING_PATTERNS = [
  'book online', 'book now', 'book an appointment', 'book appointment', 'make a booking',
  'book a table', 'reserve a table', 'schedule a', 'request an appointment', 'order online',
];
const BOOKING_HOSTS = [
  'calendly.com', 'acuityscheduling.com', 'setmore.com', 'simplybook.me', 'fresha.com',
  'treatwell.co.uk', 'booksy.com', 'opentable', 'resdiary', 'thefork', 'squareup.com/appointments',
  'dentally.co', 'phorest', 'timely', 'cliniko', 'zenoti', 'bookwhen',
];
const CTA_PATTERNS = [
  'get a quote', 'get quote', 'request a quote', 'free quote', 'free consultation',
  'book now', 'book online', 'contact us', 'call us', 'get in touch', 'enquire', 'inquire',
  'request a callback', 'free survey', 'free valuation', 'get started', 'order online',
];
const TESTIMONIAL_PATTERNS = [
  'testimonial', 'what our clients say', 'what our customers say', 'what our patients say',
  'reviews', 'trustpilot', 'google reviews', 'checkatrade', 'feefo',
];
const TRUST_PATTERNS = [
  'gas safe', 'niceic', 'napit', 'fensa', 'checkatrade', 'trustmark', 'which? trusted trader',
  'cqc', 'care quality commission', 'gdc ', 'general dental council', 'sra ', 'solicitors regulation',
  'icaew', 'accs', 'acca', 'rics', 'ofsted', 'guarantee', 'insured', 'accredited', 'iso 9001',
];
const SERVICE_PATH = /\/(services?|treatments?|what-we-do|our-work|practice-areas|specialis[mt]|solutions?)(\/|$)/i;
const LOCATION_PATH = /\/(locations?|areas?-we-cover|areas-covered|branches?|find-us|where-we-work|clinics?)(\/|$)/i;
const PRIVACY_PATH = /\/(privacy|privacy-policy|data-protection|cookie-policy|gdpr)(\/|$)/i;

const PLATFORM_HINTS: { name: string; test: RegExp }[] = [
  { name: 'WordPress', test: /wp-content|wp-includes|wp-json/i },
  { name: 'Wix', test: /static\.wixstatic\.com|wix\.com/i },
  { name: 'Squarespace', test: /squarespace\.com|static1\.squarespace/i },
  { name: 'Shopify', test: /cdn\.shopify\.com/i },
  { name: 'GoDaddy Website Builder', test: /img1\.wsimg\.com|godaddysites/i },
  { name: 'Weebly', test: /weebly\.com/i },
  { name: 'Webflow', test: /assets(-global)?\.website-files\.com|webflow/i },
  { name: 'Duda', test: /irp\.cdn-website\.com|dudaone/i },
];

const UK_PHONE_RE = /(?:(?:\+44\s?|0)(?:\d\s?){9,10})/g;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

/**
 * Pulls verifiable facts out of one HTML page.
 *
 * Every field here answers "what is literally present in the markup?". Nothing
 * is an opinion about the design — judgements happen later, in `score.ts`, and
 * only on top of these observations.
 */
export function extractFacts(html: string, finalUrl: string): PageFacts {
  const $ = cheerio.load(html);
  const lower = html.toLowerCase();

  let base: URL | null = null;
  try {
    base = new URL(finalUrl);
  } catch {
    base = null;
  }
  const domain = normaliseDomain(finalUrl);

  const $body = $('body').clone();
  $body.find('script, style, noscript, svg, template').remove();
  const text = $body.text().replace(/\s+/g, ' ').trim().slice(0, 20_000);
  const textLower = text.toLowerCase();

  const links: ExtractedLink[] = [];
  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') ?? '').trim();
    if (!href || href.startsWith('#')) return;
    let absolute: string | null = null;
    try {
      absolute = base ? new URL(href, base).toString() : null;
    } catch {
      absolute = null;
    }
    const linkDomain = normaliseDomain(absolute ?? href);
    links.push({
      href,
      absolute,
      text: $(el).text().replace(/\s+/g, ' ').trim().slice(0, 120),
      internal: !!absolute && !!domain && linkDomain === domain,
    });
  });

  const socialLinks: { platform: SocialPlatform; url: string }[] = [];
  const seenSocial = new Set<string>();
  for (const link of links) {
    if (!link.absolute) continue;
    const host = normaliseDomain(link.absolute);
    if (!host) continue;
    const match = SOCIAL_PATTERNS.find((p) => p.test.test(host));
    if (!match) continue;
    const key = `${match.platform}:${link.absolute}`;
    if (seenSocial.has(key)) continue;
    seenSocial.add(key);
    socialLinks.push({ platform: match.platform, url: link.absolute });
  }

  const telLinks = links.filter((l) => l.href.toLowerCase().startsWith('tel:')).map((l) => l.href.slice(4));
  const phones = [...new Set([...telLinks, ...(text.match(UK_PHONE_RE) ?? [])].map((p) => p.trim()))].slice(0, 5);

  const mailtoLinks = links.filter((l) => l.href.toLowerCase().startsWith('mailto:')).map((l) => l.href.slice(7).split('?')[0]!);
  const emails = [...new Set([...mailtoLinks, ...(text.match(EMAIL_RE) ?? [])].map((e) => e.toLowerCase()))]
    .filter((e) => !/\.(png|jpe?g|gif|svg|webp)$/i.test(e))
    .slice(0, 5);

  // A search box is a form too; only forms that collect a message or an address
  // count as a way to contact the business.
  const hasContactForm = $('form').toArray().some((form) => {
    const $form = $(form);
    const html = ($form.html() ?? '').toLowerCase();
    const isSearch = /type=["']?search|role=["']?search/.test(html) || /search/.test($form.attr('class') ?? '');
    if (isSearch) return false;
    return $form.find('textarea, input[type="email"], input[name*="email" i], input[name*="message" i]').length > 0;
  });

  const bookingHostHit = links.find((l) => l.absolute && BOOKING_HOSTS.some((h) => l.absolute!.toLowerCase().includes(h)));
  const bookingTextHit = BOOKING_PATTERNS.find((p) => textLower.includes(p));
  const hasBookingSignal = !!bookingHostHit || !!bookingTextHit;
  const bookingEvidence = bookingHostHit
    ? `links to booking system ${normaliseDomain(bookingHostHit.absolute!)}`
    : bookingTextHit
      ? `page text contains "${bookingTextHit}"`
      : null;

  const ctaHit = CTA_PATTERNS.find((p) => textLower.includes(p));
  const ctaButton = $('a.btn, a.button, button, [role="button"], .cta, .btn').toArray().some((el) => {
    const label = $(el).text().toLowerCase();
    return CTA_PATTERNS.some((p) => label.includes(p));
  });
  const hasCtaButton = ctaButton || !!ctaHit;
  const ctaEvidence = ctaButton
    ? 'call-to-action element with an action label'
    : ctaHit
      ? `page text contains "${ctaHit}"`
      : null;

  const hasWhatsApp = links.some((l) => /wa\.me|whatsapp/i.test(l.absolute ?? l.href));
  const hasMap =
    /google\.com\/maps|maps\.google|openstreetmap|mapbox/i.test(lower) ||
    $('iframe[src*="maps"]').length > 0;

  const internalPaths = links
    .filter((l) => l.internal && l.absolute)
    .map((l) => {
      try {
        return new URL(l.absolute!).pathname;
      } catch {
        return '';
      }
    })
    .filter(Boolean);

  const servicePages = [...new Set(internalPaths.filter((p) => SERVICE_PATH.test(p)))];
  const locationPages = [...new Set(internalPaths.filter((p) => LOCATION_PATH.test(p)))];
  const hasPrivacyPage = internalPaths.some((p) => PRIVACY_PATH.test(p));

  const testimonialHit = TESTIMONIAL_PATTERNS.find((p) => textLower.includes(p));
  const trustHit = TRUST_PATTERNS.find((p) => textLower.includes(p));

  const hasCookieNotice = /cookie/i.test(lower) && /(accept|consent|manage|preferences)/i.test(lower);

  const images = $('img').toArray();
  const imagesMissingAlt = images.filter((img) => {
    const alt = $(img).attr('alt');
    return alt === undefined || alt.trim() === '';
  }).length;

  const outdatedHints: string[] = [];
  if (/<font\b/i.test(lower)) outdatedHints.push('<font> tags');
  if (/<center\b/i.test(lower)) outdatedHints.push('<center> tags');
  if (/<marquee\b/i.test(lower)) outdatedHints.push('<marquee> tags');
  if (/bgcolor=/i.test(lower)) outdatedHints.push('bgcolor attributes');
  if (/<frameset|<frame\b/i.test(lower)) outdatedHints.push('frameset layout');
  if (/\.swf\b|application\/x-shockwave-flash/i.test(lower)) outdatedHints.push('Flash content');
  const tableCount = $('table').length;
  if (tableCount >= 3 && $('table table').length > 0) outdatedHints.push('nested table layout');
  const jqueryMatch = /jquery[/-](\d+)\.(\d+)/i.exec(lower);
  if (jqueryMatch && Number(jqueryMatch[1]) < 3) outdatedHints.push(`jQuery ${jqueryMatch[1]}.${jqueryMatch[2]}`);
  const yearMatch = [...text.matchAll(/©\s*(?:copyright\s*)?(\d{4})/gi)].map((m) => Number(m[1]));
  const latestYear = yearMatch.length ? Math.max(...yearMatch) : null;
  if (latestYear && latestYear < new Date().getFullYear() - 2) {
    outdatedHints.push(`copyright notice dated ${latestYear}`);
  }

  const detectedPlatform = PLATFORM_HINTS.find((p) => p.test.test(html))?.name ?? null;
  const brandColourHints = extractBrandColours(html);

  return {
    finalUrl,
    domain,
    https: finalUrl.toLowerCase().startsWith('https://'),
    title: $('title').first().text().trim() || null,
    metaDescription: $('meta[name="description"]').attr('content')?.trim() ?? null,
    h1Texts: $('h1').toArray().map((el) => $(el).text().replace(/\s+/g, ' ').trim()).filter(Boolean),
    lang: $('html').attr('lang')?.trim() ?? null,
    hasViewportMeta: $('meta[name="viewport"]').length > 0,
    links,
    socialLinks,
    phones,
    emails,
    hasContactForm,
    hasBookingSignal,
    bookingEvidence,
    hasWhatsApp,
    hasMap,
    hasCtaButton,
    ctaEvidence,
    servicePages,
    locationPages,
    hasTestimonials: !!testimonialHit,
    testimonialEvidence: testimonialHit ? `page text contains "${testimonialHit}"` : null,
    hasTrustSignals: !!trustHit,
    trustEvidence: trustHit ? `page text contains "${trustHit.trim()}"` : null,
    hasPrivacyPage,
    hasCookieNotice,
    totalImages: images.length,
    imagesMissingAlt,
    outdatedHints,
    detectedPlatform,
    brandColourHints,
    text,
    textLength: text.length,
  };
}

/**
 * Samples the page's most-used distinctive colours.
 *
 * Greys, blacks and whites are dropped because every page uses them; what is
 * left is a starting point for the demo design, explicitly labelled as a hint
 * rather than the business's brand palette.
 */
export function extractBrandColours(html: string, limit = 4): string[] {
  const counts = new Map<string, number>();
  for (const match of html.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    const hex = expandHex(match[1]!.toLowerCase());
    if (isNeutral(hex)) continue;
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([hex]) => `#${hex}`);
}

function expandHex(value: string): string {
  return value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
}

function isNeutral(hex: string): boolean {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  // Low saturation, or very close to black or white.
  return max - min < 24 || max < 32 || min > 232;
}
