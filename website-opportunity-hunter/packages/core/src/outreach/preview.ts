import { getIndustry, industryLabel } from '../industry/taxonomy.js';
import type { OutreachFact } from './facts.js';

export interface BriefingSection {
  key: string;
  title: string;
  goal: string;
  contentNotes: string[];
}

export interface PreviewBriefing {
  generatedAt: string;
  business: {
    name: string;
    industryKey: string | null;
    industry: string;
    location: string | null;
    country: string;
    currency: string;
    language: string;
  };
  /** Facts we hold with a source. Safe to put on the demo page. */
  confirmed: { label: string; value: string; source: string }[];
  /** Things the demo must NOT assert until the operator confirms them. */
  toConfirm: string[];
  suggestedServices: { name: string; status: 'SUGGESTED_FROM_INDUSTRY' | 'OBSERVED_ON_WEBSITE' }[];
  brand: { colourHints: string[]; source: string | null; detected: boolean; note: string };
  sections: BriefingSection[];
  primaryCta: string;
  tone: string;
  constraints: string[];
}

export interface BriefingInput {
  companyName: string;
  industryKey?: string | null;
  city?: string | null;
  region?: string | null;
  countryName: string;
  currency: string;
  language: string;
  facts: OutreachFact[];
  /** Hex colours observed on the existing site, if one was analysed. */
  brandColourHints?: string[];
  brandSourceDomain?: string | null;
  /** Service pages actually seen on the existing site. */
  observedServices?: string[];
  phone?: string | null;
  email?: string | null;
  reviewCount?: number | null;
  rating?: number | null;
  now?: Date;
}

/**
 * Produces the brief for a demonstration homepage.
 *
 * This is a brief, not a website, and certainly not a deployment: the system
 * never publishes to a prospect's domain and never claims services, prices or
 * credentials on their behalf. Anything not backed by a fact lands in
 * `toConfirm` so the operator has to make the call before showing it to anyone.
 */
export function buildPreviewBriefing(input: BriefingInput): PreviewBriefing {
  const now = input.now ?? new Date();
  const profile = input.industryKey ? getIndustry(input.industryKey) : undefined;
  const location = input.city ?? input.region ?? null;

  const confirmed = input.facts
    .filter((f) => f.confidence !== 'LOW')
    .map((f) => ({
      label: f.key.replace(/_/g, ' '),
      value: f.statement.replace(/^you /, `${input.companyName} `),
      source: f.sourceUrl ? `${f.source} (${f.sourceUrl})` : f.source,
    }));

  const observed = (input.observedServices ?? []).map((name) => ({
    name,
    status: 'OBSERVED_ON_WEBSITE' as const,
  }));
  const suggested = (profile?.typicalServices ?? []).map((name) => ({
    name,
    status: 'SUGGESTED_FROM_INDUSTRY' as const,
  }));
  const suggestedServices = [...observed, ...suggested.filter((s) => !observed.some((o) => o.name === s.name))];

  const toConfirm: string[] = [
    'Which services the business actually offers, and how it words them',
    'Opening hours',
    'Whether the business wants online booking',
  ];
  if (!input.phone) toConfirm.push('A phone number to display');
  if (!input.email) toConfirm.push('An email address or enquiry destination');
  if (!location) toConfirm.push('The trading address to show on the page');
  if (suggested.length > 0) {
    toConfirm.push(
      `The suggested service list is taken from what ${industryLabel(input.industryKey ?? '')} businesses typically offer, not from this business — confirm before showing it`,
    );
  }

  const sections: BriefingSection[] = [
    {
      key: 'hero',
      title: 'Hero',
      goal: 'Say what the business does, where, and what to do next, above the fold.',
      contentNotes: [
        `Headline naming the service and the town, e.g. "${profile?.label ?? 'Service'} in ${location ?? '[town]'}"`,
        'One supporting sentence. No superlatives that cannot be substantiated.',
        `Primary button: ${primaryCtaFor(input.industryKey)}`,
      ],
    },
    {
      key: 'services',
      title: 'Services',
      goal: 'Give each service its own block so it can become its own page later.',
      contentNotes: suggestedServices.slice(0, 6).map((s) =>
        s.status === 'OBSERVED_ON_WEBSITE'
          ? `${s.name} (seen on the current site)`
          : `${s.name} (suggested for the sector — confirm)`,
      ),
    },
    {
      key: 'trust',
      title: 'Trust',
      goal: 'Show the proof the business already has, and nothing it does not.',
      contentNotes: trustNotes(input),
    },
    {
      key: 'cta',
      title: 'Call to action',
      goal: 'Repeat the single action you want a visitor to take.',
      contentNotes: [primaryCtaFor(input.industryKey), 'Phone number as a tap-to-call link on mobile'],
    },
    {
      key: 'contact',
      title: 'Contact',
      goal: 'Make it trivial to get in touch by the route the customer prefers.',
      contentNotes: [
        input.phone ? `Phone: ${input.phone}` : 'Phone: to be supplied by the business',
        input.email ? `Email: ${input.email}` : 'Enquiry form posting to an address the business supplies',
        'Short form: name, contact detail, message. Nothing else.',
      ],
    },
    {
      key: 'location',
      title: 'Location',
      goal: 'Answer "where are you and can you cover me?".',
      contentNotes: [
        location ? `Map and address for ${location}` : 'Map once the trading address is confirmed',
        'Areas covered list, which doubles as local SEO content',
      ],
    },
  ];

  return {
    generatedAt: now.toISOString(),
    business: {
      name: input.companyName,
      industryKey: input.industryKey ?? null,
      industry: input.industryKey ? industryLabel(input.industryKey) : 'Unclassified',
      location,
      country: input.countryName,
      currency: input.currency,
      language: input.language,
    },
    confirmed,
    toConfirm,
    suggestedServices,
    brand: {
      colourHints: input.brandColourHints ?? [],
      source: input.brandSourceDomain ?? null,
      detected: (input.brandColourHints ?? []).length > 0,
      note: (input.brandColourHints ?? []).length
        ? `Colours sampled from the existing site at ${input.brandSourceDomain}. Treat as a starting point, not a brand guide.`
        : 'No existing brand colours were detected. Pick a neutral palette and confirm with the business.',
    },
    sections,
    primaryCta: primaryCtaFor(input.industryKey),
    tone: profile?.highTicket
      ? 'Considered and reassuring: this is a high-value decision for the customer.'
      : 'Direct and practical: the visitor wants a price, a time, or a phone number.',
    constraints: [
      'This is an internal demonstration only.',
      'Never publish it on the prospect’s domain or imply the business commissioned it.',
      'Do not state prices, qualifications, accreditations, guarantees or staff names that are not in the confirmed list.',
      'Use placeholder imagery; do not take photographs from the prospect’s site or social profiles.',
    ],
  };
}

function primaryCtaFor(industryKey: string | null | undefined): string {
  const profile = industryKey ? getIndustry(industryKey) : undefined;
  if (!profile) return 'Get in touch';
  if (profile.bookingExpected) return 'Book an appointment';
  if (profile.highTicket) return 'Request a free quote';
  return 'Call us today';
}

function trustNotes(input: BriefingInput): string[] {
  const notes: string[] = [];
  if (typeof input.reviewCount === 'number' && input.reviewCount > 0) {
    const rating = typeof input.rating === 'number' ? ` averaging ${input.rating.toFixed(1)} stars` : '';
    notes.push(`Review count: ${input.reviewCount}${rating} — cite the source and link to it`);
  } else {
    notes.push('No review data held. Leave a space for reviews rather than inventing any.');
  }
  notes.push('Accreditations: leave blank until the business supplies them');
  notes.push('Photographs: placeholders only until the business provides its own');
  return notes;
}
