import type { SourceCompany } from '../../domain/types.js';

/**
 * Fictional companies used for development, demos and tests.
 *
 * Everything here is invented on purpose and named so it cannot be mistaken for
 * a real business: no real company, person, address, phone number or domain
 * appears. Domains use the reserved `example.com` family from RFC 2606.
 */

export interface FixtureCompany extends Omit<SourceCompany, 'provider' | 'externalId' | 'raw'> {
  externalId: string;
  /** Only the fixture website discovery provider sees these. */
  fixture: {
    /** Domain the discovery step is allowed to "find", if any. */
    website?: string;
    /** Canned HTML served by the fixture website fetcher. */
    html?: string;
    socials?: { platform: string; url: string }[];
    reviewCount?: number;
    rating?: number;
    /** Date of the most recent review, when the listing source reports one. */
    latestReviewAt?: Date;
    /** Fictional officers, so the decision-maker stage has something to read. */
    officers?: { name: string; role: string; appointedDaysAgo: number; occupation?: string; corporate?: boolean }[];
  };
}

/** Days before "today" that the fixture company was incorporated. */
const daysAgo = (n: number): Date => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};

const strongHtml = (name: string, city: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name} — Private Dental Care in ${city}</title>
<meta name="description" content="${name} offers general, cosmetic and implant dentistry in ${city}. Book an appointment online.">
</head><body>
<h1>${name}</h1>
<nav><a href="/services">Services</a><a href="/implants">Implants</a><a href="/contact">Contact</a>
<a href="/locations/${city.toLowerCase()}">${city}</a><a href="/privacy">Privacy policy</a></nav>
<a class="btn" href="/book">Book an appointment</a>
<p>Call us on 01000 000000 or email hello@example.com</p>
<form action="/contact"><input name="email"><button>Send</button></form>
<section><h2>What our patients say</h2><blockquote>Testimonial placeholder.</blockquote></section>
<a href="https://www.instagram.com/example">Instagram</a>
<iframe src="https://www.google.com/maps/embed?pb=demo"></iframe>
<img src="/team.jpg" alt="The team">
<div id="cookie-banner">We use cookies</div>
</body></html>`;

const weakHtml = (name: string) => `<html><head><title>${name}</title></head>
<body bgcolor="#ffffff"><center><font size="4">${name}</font></center>
<table><tr><td>Welcome to our website. We are currently updating this page.</td></tr></table>
<p>Phone: 01000 000000</p>
</body></html>`;

export const FIXTURE_COMPANIES: FixtureCompany[] = [
  {
    countryCode: 'GB',
    companyNumber: 'DEMO0001',
    externalId: 'DEMO0001',
    name: 'DEMO DENTAL STUDIO LTD',
    status: 'ACTIVE',
    incorporationDate: daysAgo(4),
    sicCodes: ['86230'],
    address: { line1: '1 Example Street', city: 'Manchester', postcode: 'M1 1AA', country: 'England' },
    sourceUrl: undefined,
    fixture: {
      socials: [
        { platform: 'INSTAGRAM', url: 'https://www.instagram.com/demo_dental_studio' },
        { platform: 'FACEBOOK', url: 'https://www.facebook.com/demodentalstudio' },
        { platform: 'GOOGLE_BUSINESS', url: 'https://maps.app.goo.gl/demo-dental-studio' },
      ],
      reviewCount: 127,
      rating: 4.9,
      latestReviewAt: daysAgo(6),
      officers: [
        { name: 'DEMO, Alex', role: 'director', appointedDaysAgo: 4, occupation: 'Dentist' },
        { name: 'DEMO, Sam', role: 'secretary', appointedDaysAgo: 4 },
      ],
    },
  },
  {
    countryCode: 'GB',
    companyNumber: 'DEMO0002',
    externalId: 'DEMO0002',
    name: 'DEMO HEATING SERVICES LIMITED',
    status: 'ACTIVE',
    incorporationDate: daysAgo(11),
    sicCodes: ['43220'],
    address: { line1: '2 Example Road', city: 'Leeds', postcode: 'LS1 1AA', country: 'England' },
    fixture: {
      officers: [
        { name: 'DEMO, Jordan', role: 'director', appointedDaysAgo: 11, occupation: 'Heating Engineer' },
      ],
    },
  },
  {
    countryCode: 'GB',
    companyNumber: 'DEMO0003',
    externalId: 'DEMO0003',
    name: 'DEMO LEGAL PARTNERS LLP',
    status: 'ACTIVE',
    incorporationDate: daysAgo(45),
    sicCodes: ['69102'],
    address: { line1: '3 Example Square', city: 'London', postcode: 'EC1A 1AA', country: 'England' },
    website: 'https://demo-legal.example.com',
    fixture: {
      website: 'https://demo-legal.example.com',
      html: weakHtml('Demo Legal Partners'),
      reviewCount: 3,
      rating: 4.2,
    },
  },
  {
    countryCode: 'GB',
    companyNumber: 'DEMO0004',
    externalId: 'DEMO0004',
    name: 'DEMO SMILE CLINIC LTD',
    status: 'ACTIVE',
    incorporationDate: daysAgo(900),
    sicCodes: ['86230'],
    address: { line1: '4 Example Lane', city: 'Manchester', postcode: 'M2 2BB', country: 'England' },
    website: 'https://demo-smile.example.com',
    fixture: {
      website: 'https://demo-smile.example.com',
      html: strongHtml('Demo Smile Clinic', 'Manchester'),
      socials: [{ platform: 'INSTAGRAM', url: 'https://www.instagram.com/demo_smile' }],
      reviewCount: 240,
      rating: 4.8,
    },
  },
  {
    countryCode: 'GB',
    companyNumber: 'DEMO0005',
    externalId: 'DEMO0005',
    name: 'DEMO ROOFING CO LTD',
    status: 'ACTIVE',
    incorporationDate: daysAgo(2),
    sicCodes: ['43910'],
    address: { line1: '5 Example Way', city: 'Birmingham', postcode: 'B1 1AA', country: 'England' },
    fixture: { reviewCount: 0 },
  },
  {
    // Same trading identity as DEMO0005 under a slightly different legal name:
    // exercises the deduplication rules.
    countryCode: 'GB',
    companyNumber: 'DEMO0006',
    externalId: 'DEMO0006',
    name: 'DEMO ROOFING COMPANY LIMITED',
    status: 'ACTIVE',
    incorporationDate: daysAgo(2),
    sicCodes: ['43910'],
    address: { line1: '5 Example Way', city: 'Birmingham', postcode: 'B1 1AA', country: 'England' },
    fixture: {},
  },
  {
    countryCode: 'GB',
    companyNumber: 'DEMO0007',
    externalId: 'DEMO0007',
    name: 'DEMO AESTHETICS CLINIC LTD',
    status: 'ACTIVE',
    incorporationDate: daysAgo(19),
    sicCodes: ['86900'],
    address: { line1: '7 Example Parade', city: 'Bristol', postcode: 'BS1 1AA', country: 'England' },
    fixture: {
      officers: [
        { name: 'DEMO HOLDINGS LTD', role: 'corporate-director', appointedDaysAgo: 19, corporate: true },
        { name: 'DEMO, Riley', role: 'director', appointedDaysAgo: 19, occupation: 'Director' },
      ],
      socials: [
        { platform: 'INSTAGRAM', url: 'https://www.instagram.com/demo_aesthetics' },
        { platform: 'FACEBOOK', url: 'https://www.facebook.com/demoaesthetics' },
      ],
      reviewCount: 31,
      rating: 5,
    },
  },
  {
    countryCode: 'GB',
    companyNumber: 'DEMO0008',
    externalId: 'DEMO0008',
    name: 'DEMO DORMANT HOLDINGS LTD',
    status: 'ACTIVE',
    incorporationDate: daysAgo(6),
    sicCodes: ['99999'],
    address: { city: 'London', postcode: 'W1A 1AA', country: 'England' },
    fixture: {},
  },
  {
    // Deliberately incomplete: no incorporation date, no address, no SIC.
    countryCode: 'GB',
    companyNumber: 'DEMO0009',
    externalId: 'DEMO0009',
    name: 'DEMO INCOMPLETE RECORD LTD',
    status: 'UNKNOWN',
    sicCodes: [],
    address: {},
    fixture: {},
  },
  {
    countryCode: 'GB',
    companyNumber: 'DEMO0010',
    externalId: 'DEMO0010',
    name: 'DEMO BARBERS LTD',
    status: 'ACTIVE',
    incorporationDate: daysAgo(27),
    sicCodes: ['96020'],
    address: { line1: '10 Example Street', city: 'Glasgow', postcode: 'G1 1AA', country: 'Scotland' },
    fixture: { reviewCount: 58, rating: 4.6 },
  },
];

export function fixtureByDomain(domain: string): FixtureCompany | undefined {
  return FIXTURE_COMPANIES.find((c) => c.fixture.website?.includes(domain));
}
