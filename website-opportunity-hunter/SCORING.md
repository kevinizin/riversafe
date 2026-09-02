# Scoring

Two independent scores.

- **Website Quality Score (0–100)** — how good an existing website is.
- **Website Opportunity Score (0–100)** — how good a moment this is for the
  business to buy a website. This is the one the dashboard ranks by.

Both are explainable by construction: every point traces to a named check or
component with a sentence you could read out on a call.

---

## Website Opportunity Score

`calculateOpportunityScore(input)` returns:

```ts
{
  score: 91,
  classification: 'HOT',
  confidence: 'HIGH',
  reasons: ['+30 Incorporated 4 day(s) ago — incorporated within the last week', …],
  components: [{ component: 'RECENCY', points: 30, max: 30, reason: '…' }, …],
  gaps: [],          // facts we could not establish
  signals: ['RECENT_REVIEWS']
}
```

### Components

| Component | Max | What it measures |
| --- | --- | --- |
| `RECENCY` | 30 | How recently the company was incorporated |
| `WEBSITE` | 30 | Whether a website was found and how good it is |
| `DIGITAL_PRESENCE` | 15 | Social profiles, a business listing, review volume |
| `COMMERCIAL_POTENTIAL` | 15 | Sector value, ticket size, proven demand |
| `BUSINESS_ACTIVITY` | 10 | Recent activity signals |
| **Total** | **100** | |

### A. Recency — up to 30

| Incorporated within | Points |
| --- | --- |
| 7 days | 30 |
| 14 days | 28 |
| 30 days | 24 |
| 60 days | 18 |
| 90 days | 12 |
| 180 days | 6 |
| 365 days | 3 |
| older | 0 |

An unknown incorporation date scores 0 **and records a gap**, which lowers the
score's confidence. Zero-because-unknown and zero-because-old are different
things, and the lead detail page shows which one applies.

### B. Website — up to 30

| Situation | Points |
| --- | --- |
| No website found | 30 |
| Website is a placeholder or under construction | 26 |
| Website found but it did not load | 18 |
| Quality below 35 | 20 |
| Quality 35–54 | 14 |
| Quality 55–74 | 7 |
| Quality 75+ | 0 |
| Status uncertain (a possible site, unconfirmed) | 15 |
| Not checked yet | 0, plus a gap |

"No website found" scores the full 30 regardless of discovery confidence.
Discovery deliberately caps that finding at MEDIUM confidence — absence of
evidence is not evidence of absence — and that uncertainty is carried by the
score's own `confidence` field. Shaving points for it instead would put the top
band out of reach for exactly the leads the product exists to surface.

### C. Digital presence — up to 15

- First social platform: 5 (HIGH confidence) or 3 (MEDIUM)
- Each additional platform: +2, capped at 7 for social in total
- Google Business listing: +4
- Reviews: 100+ → 4, 25+ → 3, 5+ → 2, 1+ → 1

An unknown review count records a gap rather than scoring zero, because with no
places provider configured nobody looked.

The logic: a business already spending effort on Instagram has proven it cares
about being found — it is simply doing it in the one channel it owns least.

### D. Commercial potential — up to 15

- Sector weight × 9, from `commercialWeight` in the industry catalogue
  (dental, legal, real estate, heating: 1.0; cafés: 0.55)
- High-ticket sector: +2
- 50+ reviews: +2
- Rating 4.5+ with 10+ reviews: +2

### E. Business activity — up to 10

Each signal contributes its base points × a confidence factor
(HIGH 1.0, MEDIUM 0.7, LOW 0.4), summed and capped at 10.

| Signal | Points |
| --- | --- |
| `NOW_OPEN`, `GRAND_OPENING` | 4 |
| `OPENING_SOON`, `COMING_SOON`, `NEW_LOCATION`, `RECENT_REVIEWS`, `RECENT_SOCIAL_ACTIVITY`, `UNDER_CONSTRUCTION_WEBSITE` | 3 |
| `NEW_BUSINESS`, `RECENTLY_REGISTERED_DOMAIN`, `HIRING` | 2 |
| `RECENT_INCORPORATION` | 0 — already counted in RECENCY |

### Overrides

A company whose registry status is not `ACTIVE` or `UNKNOWN` — dissolved, in
liquidation, in administration — is capped at 20 and classified `IGNORE`,
whatever the rest of the profile looks like.

### Confidence

| Confidence | When |
| --- | --- |
| `HIGH` | No gaps |
| `MEDIUM` | One or two gaps |
| `LOW` | Three or more gaps, or the website was never checked |

Gaps are recorded, not hidden: "Incorporation date unknown", "Review count
unknown (no places provider configured)", "Industry not identified".

### Classification

| Score | Band |
| --- | --- |
| 90–100 | 🔥 HOT |
| 75–89 | 🟠 HIGH OPPORTUNITY |
| 60–74 | 🟡 WARM |
| 40–59 | 🔵 LOW PRIORITY |
| 0–39 | ⚪ IGNORE |

Thresholds are editable on **Settings** and validated as a descending ladder.

### Worked example

A dental practice incorporated four days ago, with no website found, active on
Instagram and Facebook, a Google listing, 127 reviews at 4.9, and a review from
six days ago:

```
+30  Incorporated 4 day(s) ago — incorporated within the last week
+30  No website found after the permitted discovery methods
+13  Digital presence: active on Instagram and Facebook, has a Google Business
     listing, 127 reviews
+15  Commercial potential: Dental clinics is a high-value sector for a website,
     high-ticket services, proven demand (127 reviews), 4.9★ average rating
 +3  Recent activity signals: recent reviews
────
 91  🔥 HOT   (confidence: HIGH)
```

And the opposite case — an established practice with a strong site:

```
 +0  Established business (incorporated 8 year(s) ago)
 +0  Website scores 88/100 — already strong
 +9  Digital presence: active on Instagram, 500 reviews
+13  Commercial potential: …
 +0  No recent activity signals detected
────
 22  ⚪ IGNORE
```

---

## Website Quality Score

`scoreWebsite(facts, context)` runs 22 checks. The score is
`passed weight ÷ applicable weight × 100`.

| Check | Weight | Passes when |
| --- | --- | --- |
| HTTPS | 8 | Final URL is https |
| Mobile viewport | 10 | `<meta name="viewport">` present |
| Page title | 6 | 15–70 characters |
| Meta description | 5 | Present, 50+ characters |
| Single H1 | 4 | Exactly one |
| Clear call to action | 10 | Recognised CTA wording or element |
| Phone on the page | 6 | A phone number or `tel:` link |
| A way to make contact | 6 | Form, email or phone |
| Online booking | 8 | Booking system link or wording — *only for sectors where booking is expected* |
| WhatsApp | 2 | `wa.me` or WhatsApp link |
| Map | 4 | Map embed or maps link |
| Service pages | 8 | 2+ internal service/treatment pages |
| Location pages | 4 | 1+ location or areas-covered page |
| Reviews or testimonials | 5 | Testimonial or review wording |
| Accreditations | 4 | Gas Safe, NICEIC, CQC, GDC, SRA, guarantees … |
| Privacy policy | 4 | Privacy or data-protection link |
| Cookie notice | 2 | Cookie consent wording |
| Speed | 6 | Homepage responded in under 2,500 ms |
| No obsolete markup | 4 | No `<font>`, `<center>`, framesets, Flash, nested table layout, jQuery 1.x/2.x, or a copyright 3+ years stale |
| Image alt text | 4 | 75%+ of images have alt text |
| Language declared | 2 | `<html lang>` present |
| Social links | 3 | Links to at least one profile |
| Sampled links resolve | 3 | No broken links among those sampled |

Two deliberate design choices:

**Inapplicable checks leave the denominator.** A solicitor is not marked down
for having no booking widget; booking only counts for sectors where
`bookingExpected` is true. A page with no images is not judged on alt text.

**Every check is mechanical.** There is no "the design looks dated" check —
only "the markup contains `<font>` tags", which you can verify in one click.
Weaknesses are phrased from what was observed:

```
Not built for mobile — no viewport tag, so phones render the desktop layout
No clear call to action — nothing tells a visitor what to do next
No service-specific pages — one page has to rank for everything
Dated build — <font> tags, bgcolor attributes, copyright notice dated 2011
```

### Bands

| Score | Band |
| --- | --- |
| 75–100 | STRONG |
| 55–74 | ADEQUATE |
| 35–54 | WEAK |
| 0–34 | VERY WEAK |

"Weak website" in search filters means below 55.

---

## Changing the scoring

Weights and bands live in `packages/core/src/scoring/config.ts`;
website check weights in `packages/core/src/analyzer/score.ts`. Both are covered
by tests that assert the component maxima still sum to 100 and that no component
can exceed its cap. Bump `SCORE_VERSION` in `packages/config` when the algorithm
changes — every `scores` row stores the version that produced it, so old and new
scores stay distinguishable.
