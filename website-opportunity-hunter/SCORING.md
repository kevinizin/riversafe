# Scoring

Three independent scores.

- **Website Quality Score (0–100)** — how good an existing website is.
- **Website Opportunity Score (0–100)** — how good a moment this is for the
  business to buy a **website**.
- **System Opportunity Score (0–100)** — how good a moment this is for the
  business to buy a **management system**.

All three are explainable by construction: every point traces to a named check
or component with a sentence you could read out on a call.

## Why two opportunity axes, and why they are never averaged

The two questions have close to opposite answers.

A company incorporated two weeks ago is an excellent website lead: it has no
site, it knows it has no site, and it has not chosen a supplier. It is a poor
system lead for exactly the same reason — it has no orders to track, no staff
to schedule and no process pain, because it has barely started trading.

A four-year-old practice with twelve people and a brochure website is the
mirror image: a mediocre website lead, and the best system lead there is.

Averaging the two would land both of those companies in the middle and hide the
thing worth knowing. Instead each is scored on its own axis with its own
components, and the dashboard shows both on every card. The disagreement is the
output: it tells you which conversation to open.

| | Website axis | System axis |
| --- | --- | --- |
| Wants companies that are | new | established |
| Best age | days to weeks | 2 to 5 years |
| Key signal | no website found | sector, size and age together |
| Rewards | absence of digital presence | operational complexity |

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

## System Opportunity Score

`calculateSystemScore(input)` returns the same shape as the website axis, plus
`sizeFit` and the sector's `useCases`.

### Components

| Component | Max | What it measures |
| --- | --- | --- |
| `SECTOR_FIT` | 30 | How much of the sector's work is jobs, deadlines and records |
| `SIZE_FIT` | 25 | Whether the estimated size could be the headcount you want |
| `MATURITY` | 20 | Long enough trading to have process pain, not so long it has already bought |
| `SYSTEM_GAP` | 15 | Whether anything is observably running on the public website |
| `OPERATIONAL_COMPLEXITY` | 10 | High ticket, multiple sites, hiring |
| **Total** | **100** | |

### A. Sector fit — up to 30

`round(systemWeight × 30)`, where `systemWeight` is a per-sector 0–1 figure in
the industry catalogue. It ranks very differently from the website axis's
`commercialWeight`: architecture and engineering are 1.00, construction 0.95,
a café 0.35.

An unidentified sector scores **0** and is recorded as a gap, rather than being
given an average weight — that number would be one we made up.

### B. Size fit — up to 25

| Fit | Points | Meaning |
| --- | --- | --- |
| `LIKELY` | 25 | The whole plausible range sits inside your target |
| `POSSIBLE` | 20 | The range overlaps your target |
| `UNKNOWN` | 8 | Never sized — worth a call |
| `UNLIKELY` | 0 | The whole range sits clear of your target |

Two deliberate choices here.

`UNKNOWN` outranks `UNLIKELY`. A company we have not sized is worth a look; one
we have sized outside the window is not. Ranking ignorance below a known
mismatch would be backwards.

`POSSIBLE` gets 20 of 25, not 12. Brazilian registry data can never confirm a
headcount, so an overlapping band is the best evidence available — and a top
band the best available evidence can never reach is a band that does not exist.
The doubt is carried by the score's `confidence`, which this axis caps at
`MEDIUM` for that reason. (Same reasoning as `NO_WEBSITE_FOUND` on the website
axis.)

### C. Maturity — up to 20

| Age | Points |
| --- | --- |
| under 1 year | 0 |
| 1–2 years | 14 |
| 2–5 years | 20 |
| 5–10 years | 18 |
| over 10 years | 14 |

Under a year scores zero on purpose: those companies are the website axis's
business, not this one's. Over ten years drops back because they are more
likely to have bought something already, and replacing an entrenched tool is a
longer sale.

### D. System gap — up to 15

**This is the component that could most easily have lied, so read this part.**

Whether a company already runs a system internally is published nowhere. No
registry, directory or search result will tell you. So this component reasons
only about the **public website**, says so in its own reason text, and pushes a
gap on *every* path — including the one that awards full marks:

> No public source says whether the company already runs a system internally —
> confirm on the call

| Observation | Points |
| --- | --- |
| No website found at all | 15 |
| Brochure site, no client area or booking | 12 |
| Website not analysed | 0 |
| Online booking present | 3 |

### E. Operational complexity — up to 10

High-ticket sector (3), more than one trading address (3), hiring (4), a new
site (3), recent customer or social activity (1 each). Capped at 10.

### Confidence

Capped at `MEDIUM`, always. The size component is the second-heaviest and it is
built on a revenue band; claiming `HIGH` would be claiming to know a headcount.
Drops to `LOW` when the sector, the size or the incorporation date is missing.

---

## Estimated company size

Wanting "companies with ten to fifteen people" is reasonable. Answering it is
not possible from public data, and this section explains what is done instead.

**Neither registry publishes a headcount.**

- The **Receita Federal** publishes `porte`, which is a *revenue*
  classification from LC 123/2006 — ME up to R$ 360k a year, EPP up to R$ 4.8M.
  It says nothing directly about how many people work there.
- **Companies House** publishes the *accounts category* a company filed under.
  The UK thresholds do include an employee test, but a company qualifies on any
  two of three criteria, so a three-person consultancy with high turnover can
  file small-company accounts.

So what is produced is a band, a plausible range, the evidence behind it, and a
confidence that never reaches `HIGH`.

| `porte` | Band | Range shown | Confidence |
| --- | --- | --- | --- |
| 01 — ME | `MICRO` | 1–9 people | MEDIUM |
| 03 — EPP | `SMALL` | 10–49 people | MEDIUM |
| 05 — Demais | `MEDIUM` | 20+ people | LOW |
| 00 — not stated | *(nothing written)* | — | — |

The employee ranges come from the SEBRAE convention used in Brazilian
statistics. That convention is a population-level description, not a fact about
any one company, and the wide ranges say so rather than pretending to precision
the source cannot support.

`capital social` can narrow the range inside a band and move the confidence, but
never sets the band. A missing or zero capital is treated as *no evidence*, not
as evidence of smallness — a great many Brazilian companies declare a round
R$ 1.000 and never update it.

Every estimate is marked `inferred`, carries the line *"No public register
states a headcount — this is an estimate"* in its own basis list, and is
rendered in the UI as `est. 10–49 people`, never as a bare number.

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
