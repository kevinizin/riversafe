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
| `GET /company/{companyNumber}/officers` | Identify the decision maker |

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

**Officer fields consumed**, from the "officerList" resource:
`active_count`, `items[].name` (only when `COLLECT_OFFICER_NAMES=true`),
`.officer_role`, `.appointed_on`, `.resigned_on`, `.occupation`,
`.identification.identification_type` (to detect corporate officers).

**Officer fields deliberately not read:** `address`, `date_of_birth`,
`nationality`, `country_of_residence`, `former_names`, `person_number`,
`principal_office_address`, `identity_verification_details`. The
`OfficerRecord` type has no field for any of them, so the code cannot pick them
up even by accident.

**Not used:** the Streaming API, and the officer appointments endpoint (which
would build a profile of an individual across companies — outside the purpose).

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

## Receita Federal CNPJ open data — Brazil

**Status: built. The declared column layout still needs one human check — see
"What is NOT verified" below, and run `--inspect` before the first import.**

The Receita Federal publishes the whole CNPJ register as open data. Two facts
shape everything about how it has to be used:

1. **There is no free search API.** The data ships as monthly bulk CSV files
   inside zip archives. "Incorporated in the last 30 days" is therefore as fresh
   as the last import, not as fresh as this morning, and the UI has to say which
   import it is answering from.
2. **The files are large.** The whole country is tens of millions of rows, which
   is why the plan is to load only `UF = AM` and keep the local database small.

### What is verified

- The dataset exists as monthly bulk files, licensed as open data, with
  `Empresas`, `Estabelecimentos`, `Socios` and the small lookup tables (CNAE,
  municípios, naturezas jurídicas, qualificações, motivos, países).
- The CNAE subclasses used in the industry catalogue were taken from the IBGE
  API (`servicodados.ibge.gov.br/api/v2/cnae/subclasses`), which returns all
  1,332 subclasses. Those are verified, code by code.
- `porte_empresa` uses `00` not stated, `01` microempresa, `03` empresa de
  pequeno porte, `05` demais. This is what the size estimate reads.

### How it works

`npm run ingest:br` reads the monthly files — zipped or extracted — streaming
and discarding as it goes, keeping only the requested UFs. It writes to its own
staging table (`receita_establishments`) rather than into `companies`, so
re-importing a newer snapshot replaces the registry data without touching the
enrichment, CRM state and notes accumulated against a lead. `ReceitaFederalProvider`
then serves searches from that table behind the same `CompanySourceProvider`
interface as every other source, and reports itself unconfigured — so the demo
data takes over — until a snapshot exists.

`npm run download:br` fetches an extraction: it reads the directory listing to
find the newest monthly folder, confirms the file names the folder actually
offers rather than trusting the ten-parts convention, and downloads one file at
a time because the host rate-limits. Every file resumes from what is on disk
with a Range request, and a transfer that ends shorter than the length the
server declared is an error rather than a warning — the importer downstream
cannot tell a truncated archive from a small one.

That code is covered by tests against a real socket rather than a mocked fetch,
including a connection that drops mid-file: the behaviour worth proving is the
protocol, and a mock only proves the mock. What the tests cannot cover is the
Receita's own server, which refuses connections from outside Brazil, so the
first real run is the operator's.

Each table is split into ten numbered parts and the split is arbitrary, not by
state, so a company in Amazonas can be in any of them. Importing a subset gives
a database that reports a healthy row count and is silently missing most of the
state — nothing downstream can detect it, so `missingParts` checks the supplied
file names and the importer warns. That only works on the published zip naming;
an extracted file (`K3241.K03200Y0.D60314.ESTABELE`) carries an extraction date
and no part number, and an early version of the check read that date as a part
index. It now recognises the documented convention only, and says nothing
rather than guessing.

### What is NOT verified, and must be before any loader is trusted

**The exact column order of `Empresas` and `Estabelecimentos` has not been
confirmed against the official layout.** The metadata document is published as
a PDF at `https://www.gov.br/receitafederal/dados/cnpj-metadados.pdf`, and that
PDF carries no ToUnicode mapping, so its text cannot be extracted — it needs a
human to open it, or OCR. The file host itself
(`arquivos.receitafederal.gov.br`) was unreachable at the time of writing, so
the layout could not be checked against a real file either.

Writing a CSV parser from memory against an unverified column order is exactly
the failure this project forbids: it would not error, it would silently file a
`capital social` as a `porte` and produce confident nonsense.

Both guards the loader was built with exist for this reason:

- the column order lives in **one** declared table, `layout.ts`, not scattered
  through the parser, so a correction is a one-line edit;
- the importer **validates sampled rows against their own domains** — CNPJ
  shapes, `porte` in `{00,01,03,05}`, dates as `YYYYMMDD`, valid UFs, the
  documented `situacao_cadastral` values — and refuses the whole import, writing
  nothing, if they do not hold. A wrong column order fails loudly on the first
  rows instead of silently poisoning the database. This is covered by tests for
  both the obvious case (an extra column shifting everything) and the subtle one
  (two numeric columns swapped, same column count).

Confirm the order against the metadata PDF with `--inspect` anyway. The guard
turns a wrong layout into a refusal; only the comparison turns it into a fix.

### Partners (QSA) are excluded by default

The dump carries the full partner list with names for every company. That is a
far larger personal-data surface than the UK officer register, and a partner is
a natural person. The prospecting purpose does not require their identity, so
the `Socios` table is not loaded. See `PRIVACY.md`.

## SIC and CNAE code reference

The industry catalogue carries codes per country: SIC 2007 for the United
Kingdom, CNAE 2.3 subclasses for Brazil. Three sectors (`roofing`,
`landscaping`, `driving_school`) have no clean CNAE and are deliberately left
unmapped for Brazil rather than given an approximate code; three more
(`architecture`, `engineering`, `training_courses`) exist only with CNAE codes,
because they were never mapped to SIC here.

The UK codes come from the Companies House condensed
list (https://resources.companieshouse.gov.uk/sic/). Examples in use: `86230`
dental practice activities, `43910` roofing activities, `43220` plumbing, heat
and air-conditioning installation, `69102` solicitors, `56103` take-away food
shops. Codes shared by several sectors — `43220` covers both plumbing and
heating — are recorded at MEDIUM confidence unless the company name disambiguates.
