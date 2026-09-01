# Data sources

Every source is an official API or a public page fetched under its own rules.
There is no scraping of a service that offers an API, no bypassing of any block,
and no source used against its terms.

---

## Companies House Public Data API — primary

**Provider:** Companies House (UK government)
**Base URL:** `https://api.company-information.service.gov.uk`
**Register:** https://developer.company-information.service.gov.uk/
**Cost:** free, API key required
**Licence:** Companies House data is published under the Open Government Licence

**Authentication.** HTTP Basic, the API key as the username, the password empty
— exactly as the Companies House authentication guide specifies.

**Endpoints used**

| Endpoint | Use |
| --- | --- |
| `GET /advanced-search/companies` | Find companies by SIC code, location and incorporation date |
| `GET /company/{companyNumber}` | Full profile for one company |

**Query parameters used**, from the published specification:
`company_name_includes`, `company_name_excludes`, `company_status`,
`incorporated_from`, `incorporated_to`, `location`, `sic_codes`, `size`,
`start_index`.

**Response fields consumed**, from the "A list of companies" resource:
`hits`, `items[].company_name`, `.company_number`, `.company_status`,
`.company_type`, `.date_of_creation`, `.sic_codes`,
`.registered_office_address.{address_line_1, address_line_2, locality, region, postal_code, country}`.

**Rate limiting.** Applied client-side from configuration
(`COMPANIES_HOUSE_RATE_LIMIT` / `_WINDOW_MS`, default 600 requests per 5
minutes) using a sliding window that *waits* rather than failing. This default
is deliberately conservative: confirm the current published limit in the
Companies House developer guidelines before raising it. A `429` is retried with
exponential backoff and jitter, and repeated failures open a circuit breaker.

**Known limitations.** SIC codes are self-declared at incorporation and are
often generic. The `location` filter matches the registered office, which for
small companies is frequently an accountant's address rather than where the
business trades. Both are surfaced in the UI rather than papered over.

**Not used:** the Streaming API, and officer personal data beyond role titles
(see `PRIVACY.md`).

---

## Fixture dataset — fallback and tests

When no Companies House key is configured, searches run against a fictional
dataset in `packages/core/src/providers/companies/fixtures.ts`. Every company is
invented, named `DEMO …`, and uses RFC 2606 reserved `example.com` domains. No
real business, person, address, phone number or domain appears. The dashboard
shows a banner whenever this dataset is in use, so demo rows can never be
mistaken for real leads.

---

## Web search — optional

Used to find candidate websites and public social profiles. A search hit is only
ever a *candidate*: the page is then fetched and must repeat the company's own
name, postcode or phone number before it is accepted.

### Brave Search API

**Endpoint:** `GET https://api.search.brave.com/res/v1/web/search`
**Auth:** `X-Subscription-Token` header
**Parameters:** `q`, `count` (max 20), `country`
**Cost:** free tier, then paid per query

### Google Programmable Search (Custom Search JSON API)

**Endpoint:** `GET https://www.googleapis.com/customsearch/v1`
**Parameters:** `key`, `cx`, `q`, `num` (max 10), `gl`
**Cost:** 100 queries/day free, then paid

With `SEARCH_PROVIDER=none` the discovery step reports those methods as
*skipped*, not as *searched and found nothing* — the difference decides whether
a lead can be marked "website not found" at all.

---

## Places — optional

### Google Places API (New), Text Search

**Endpoint:** `POST https://places.googleapis.com/v1/places:searchText`
**Auth:** `X-Goog-Api-Key` header
**Field mask** (`X-Goog-FieldMask`), kept deliberately narrow because Places is
billed by field set: `places.id`, `places.displayName`,
`places.formattedAddress`, `places.websiteUri`, `places.nationalPhoneNumber`,
`places.rating`, `places.userRatingCount`,
`places.regularOpeningHours.weekdayDescriptions`, `places.googleMapsUri`.
**Cost:** paid per request

Without it, review count, rating and opening hours stay UNKNOWN and the
opportunity score records that as a gap rather than assuming zero.

---

## Prospect websites — direct fetch

When a candidate website is found, the analyzer fetches the homepage and up to
three sampled internal links.

**Rules applied to every request**

- `robots.txt` is fetched and honoured first. A disallow ends the attempt and is
  recorded as `ROBOTS_DISALLOWED`. If `robots.txt` cannot be read, or the host
  returns 401/403 for it, the host is treated as **disallowed**. Being wrongly
  cautious costs one lead; being wrongly permissive costs your reputation.
- A `Crawl-delay` directive is read and respected.
- The user agent identifies the tool and a contact address
  (`WEBSITE_USER_AGENT`). It never impersonates a browser.
- Timeout `WEBSITE_FETCH_TIMEOUT_MS` (default 12s); body capped at
  `WEBSITE_MAX_BYTES` (default 2.5 MB) and truncated past it.
- At most four requests per site, once per `WEBSITE_ANALYSIS_TTL_HOURS`
  (default one week) — repeat searches reuse the stored analysis.
- A `401`, `403` or CAPTCHA page is a final answer, recorded as
  `WEBSITE_UNAVAILABLE`. There is no retry with different headers, no proxy
  rotation, no CAPTCHA solving.

---

## Social platforms — never accessed directly

The system does **not** log into, scrape, or call the private APIs of Instagram,
Facebook, LinkedIn, TikTok or X. Social profiles reach the database by two routes
only:

1. Links the company publishes on its own website.
2. Public web-search results whose title and URL contain the company's
   distinctive name words.

Follower counts, post frequency and engagement are only stored if a permitted
source states them outright — which in practice means they are usually absent,
and the score records that gap rather than estimating.

---

## Directories excluded from website discovery

A company's name ranks well on directories, marketplaces and social networks.
Accepting one as "the company's website" would both overstate its digital
presence and produce a meaningless analysis, so around sixty hosts are excluded:
Companies House itself, company-data aggregators (OpenCorporates, Endole),
social networks, directories (Yell, Thomson Local, Checkatrade, Trustpilot,
Yelp, TripAdvisor), sector marketplaces (Just Eat, Deliveroo, Treatwell, Booksy,
Rightmove, Zoopla) and job boards. The full list is
`packages/core/src/discovery/excluded.ts`.

Social networks are still captured — as social profiles, which is what they are.

---

## AI — optional, and never a source of facts

**Provider:** Anthropic API, model configurable (`AI_MODEL`).

Used only where rules genuinely cannot do the job:

- rephrasing an outreach draft, constrained to a supplied fact list
- classifying an industry when SIC codes and keywords produced nothing usable
- summarising website text

Never used for filtering, sorting, database queries or validation — those are
deterministic and free.

An AI rewrite is validated before it is stored: if it introduces a URL, an email
address or a number that no fact supports, it is rejected and the deterministic
draft is kept. Spend is capped by `AI_MONTHLY_BUDGET_GBP` and every call is
recorded in `ai_usage`.

---

## SIC code reference

The industry catalogue uses SIC 2007 codes from the Companies House condensed
list (https://resources.companieshouse.gov.uk/sic/). Examples in use: `86230`
dental practice activities, `43910` roofing activities, `43220` plumbing, heat
and air-conditioning installation, `69102` solicitors, `56103` take-away food
shops. Codes shared by several sectors — `43220` covers both plumbing and
heating — are recorded at MEDIUM confidence unless the company name disambiguates.
