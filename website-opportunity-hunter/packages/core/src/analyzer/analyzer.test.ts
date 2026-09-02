import { describe, expect, it } from 'vitest';
import { extractFacts } from './extract.js';
import { qualityBand, scoreWebsite } from './score.js';

const STRONG = `<!doctype html><html lang="en-GB"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Demo Smile Clinic — Private Dentist in Manchester</title>
<meta name="description" content="Demo Smile Clinic provides general, cosmetic and implant dentistry in Manchester. Book an appointment online today.">
</head><body>
<h1>Private dentistry in Manchester</h1>
<nav><a href="https://demo.example.com/services">Services</a>
<a href="https://demo.example.com/services/implants">Implants</a>
<a href="https://demo.example.com/locations/manchester">Manchester</a>
<a href="https://demo.example.com/privacy">Privacy policy</a></nav>
<a class="btn" href="https://calendly.com/demo">Book an appointment</a>
<p>Call us on 0161 496 0000 — we are GDC registered and fully insured.</p>
<form><input type="email" name="email"><textarea name="message"></textarea></form>
<section><h2>Reviews</h2><p>What our patients say about us.</p></section>
<a href="https://www.instagram.com/demo_smile">Instagram</a>
<iframe src="https://www.google.com/maps/embed?pb=x"></iframe>
<img src="/a.jpg" alt="Reception"><img src="/b.jpg" alt="Surgery">
<div>We use cookies. Accept all or manage preferences.</div>
</body></html>`;

const WEAK = `<html><head><title>Demo</title></head><body bgcolor="#fff">
<center><font size="4">Demo Legal Partners</font></center>
<table><tr><td><table><tr><td>Welcome to our website.</td></tr></table></td></tr></table>
<p>Phone: 0161 496 0000</p>
<p>&copy; Copyright 2011</p>
<img src="/x.jpg">
</body></html>`;

describe('extractFacts', () => {
  const facts = extractFacts(STRONG, 'https://demo.example.com/');

  it('reads the documented head elements', () => {
    expect(facts.title).toContain('Demo Smile Clinic');
    expect(facts.metaDescription).toContain('implant dentistry');
    expect(facts.h1Texts).toHaveLength(1);
    expect(facts.lang).toBe('en-GB');
    expect(facts.hasViewportMeta).toBe(true);
    expect(facts.https).toBe(true);
  });

  it('finds conversion elements with evidence', () => {
    expect(facts.hasCtaButton).toBe(true);
    expect(facts.ctaEvidence).toBeTruthy();
    expect(facts.hasBookingSignal).toBe(true);
    expect(facts.bookingEvidence).toContain('calendly.com');
    expect(facts.hasContactForm).toBe(true);
    expect(facts.phones.length).toBeGreaterThan(0);
    expect(facts.hasMap).toBe(true);
  });

  it('separates internal service and location pages from social links', () => {
    expect(facts.servicePages.length).toBeGreaterThanOrEqual(2);
    expect(facts.locationPages).toContain('/locations/manchester');
    expect(facts.socialLinks.map((s) => s.platform)).toContain('INSTAGRAM');
    expect(facts.hasPrivacyPage).toBe(true);
    expect(facts.hasCookieNotice).toBe(true);
  });

  it('detects obsolete markup and stale copyright on a weak page', () => {
    const weak = extractFacts(WEAK, 'http://weak.example.com/');
    expect(weak.https).toBe(false);
    expect(weak.hasViewportMeta).toBe(false);
    expect(weak.outdatedHints).toEqual(
      expect.arrayContaining(['<font> tags', '<center> tags', 'bgcolor attributes']),
    );
    expect(weak.outdatedHints.some((h) => h.includes('2011'))).toBe(true);
    expect(weak.imagesMissingAlt).toBe(1);
  });

  it('does not treat a search box as a contact form', () => {
    const html = '<html><body><form role="search"><input type="text" name="q"></form></body></html>';
    expect(extractFacts(html, 'https://x.example.com/').hasContactForm).toBe(false);
  });

  it('survives malformed HTML without throwing', () => {
    expect(() => extractFacts('<html><body><p>unclosed', 'https://x.example.com/')).not.toThrow();
  });
});

describe('scoreWebsite', () => {
  it('scores a complete site well above a neglected one', () => {
    const strong = scoreWebsite(extractFacts(STRONG, 'https://demo.example.com/'), {
      responseTimeMs: 400,
      bookingExpected: true,
    });
    const weak = scoreWebsite(extractFacts(WEAK, 'http://weak.example.com/'), {
      responseTimeMs: 3200,
      bookingExpected: true,
    });
    expect(strong.score).toBeGreaterThan(70);
    expect(weak.score).toBeLessThan(35);
    expect(qualityBand(strong.score)).toBe('STRONG');
    expect(qualityBand(weak.score)).toBe('VERY_WEAK');
  });

  it('lists weaknesses that each name an observable fact', () => {
    const weak = scoreWebsite(extractFacts(WEAK, 'http://weak.example.com/'), { bookingExpected: true });
    expect(weak.weaknesses).toEqual(expect.arrayContaining([expect.stringContaining('mobile')]));
    expect(weak.weaknesses.some((w) => w.includes('HTTPS'))).toBe(true);
    // Every weakness must correspond to a failed, applicable check.
    for (const weakness of weak.weaknesses) {
      expect(weak.checks.some((c) => c.weakness === weakness && !c.passed && c.applicable)).toBe(true);
    }
  });

  it('does not penalise a sector that is not expected to take bookings', () => {
    const facts = extractFacts(WEAK, 'http://weak.example.com/');
    const withBooking = scoreWebsite(facts, { bookingExpected: true });
    const withoutBooking = scoreWebsite(facts, { bookingExpected: false });
    expect(withoutBooking.score).toBeGreaterThan(withBooking.score);
    expect(withoutBooking.weaknesses.some((w) => w.includes('online booking'))).toBe(false);
  });

  it('gives every check an evidence string', () => {
    const result = scoreWebsite(extractFacts(STRONG, 'https://demo.example.com/'), {});
    for (const check of result.checks) expect(check.evidence.length).toBeGreaterThan(0);
  });
});
