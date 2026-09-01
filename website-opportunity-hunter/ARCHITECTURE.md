# Architecture

## Shape

An npm workspace monorepo. Domain logic lives in `@woh/core` and is imported by
both the web app and the worker; neither owns business rules.

```
website-opportunity-hunter/
├── packages/
│   ├── config/        Environment schema and validation (zod). No secrets leave here.
│   ├── db/            Prisma schema, migrations, client singleton
│   └── core/          All domain logic
│       ├── domain/        Sourced<T>, Lookup<T>, Confidence, Evidence, AppError
│       ├── logging/       Structured logger with a pluggable database sink
│       ├── net/           HTTP client, rate limiter, circuit breaker, robots.txt
│       ├── countries/     CountryProfile registry (GB implemented)
│       ├── geo/           UK nations, cities, postcode normalisation
│       ├── industry/      Industry catalogue (SIC 2007) and rule-based classifier
│       ├── providers/
│       │   ├── companies/   CompanySourceProvider: Companies House, fixtures
│       │   ├── search/      WebSearchProvider: Brave, Google CSE, disabled
│       │   └── places/      PlaceProvider: Google Places (New), disabled
│       ├── discovery/     Website discovery with verification and confidence
│       ├── analyzer/      Page fetch, fact extraction, quality scoring
│       ├── social/        Social profile discovery
│       ├── signals/       Business activity signal detection
│       ├── scoring/       Opportunity score
│       ├── dedup/         Normalisation, identity keys, duplicate matching
│       ├── search/        Search filter schema
│       ├── outreach/      Fact model, message generator, preview briefing
│       ├── ai/            AI provider abstraction with a monthly budget
│       ├── export/        CSV writer
│       ├── auth/          Password hashing
│       ├── pipeline/      Context, persistence, stages, run orchestration
│       └── queue/         Job queue abstraction (inline / BullMQ)
└── apps/
    ├── web/           Next.js 15 App Router — UI, server actions, two API routes
    └── worker/        BullMQ worker process and the development seed
```

## Data flow

```
        ┌───────────── apps/web ─────────────┐
User → │ Search form → server action        │
        └──────────────┬─────────────────────┘
                       │ enqueue('search.run')
                       ▼
              @woh/core/queue  ──inline──►  same process
                       │
                    redis
                       ▼
        ┌──────────── apps/worker ───────────┐
        │  BullMQ Worker → job handler       │
        └──────────────┬─────────────────────┘
                       ▼
              pipeline/runSearch
                       │
   ┌───────────────────┼───────────────────────────────┐
   ▼                   ▼                               ▼
CompanySourceProvider  dedup/upsertCompany     searchRunResult
(paginated)            (registry no. → domain
                        → name+postcode)
                                     │
                                     ▼  per company, concurrency 4
                            pipeline/enrichCompany
                                     │
   ┌──────────┬──────────┬───────────┼───────────┬──────────┬─────────┐
   ▼          ▼          ▼           ▼           ▼          ▼         ▼
industry   places    website     website      social    signals    scoring
classify   lookup    discovery   analysis     discovery detection
   │          │          │           │           │          │         │
   └──────────┴──────────┴───────────┴───────────┴──────────┴─────────┘
                    each stage records its own StageStatus;
                    a failure never removes the lead
```

## The rules the structure enforces

**Nothing is a bare value.** Anything from outside travels as `Sourced<T>`: a
value plus source, timestamp, confidence and whether it was inferred. This is
what makes "never invent anything" mechanical rather than aspirational.

**Not found ≠ unavailable.** `Lookup<T>` has three cases: `FOUND`, `NOT_FOUND`
(with the list of methods that ran) and `UNAVAILABLE` (with a reason). Website
discovery returns `NO_WEBSITE_FOUND` only when at least two *active* methods ran
and came back empty — a registry record with no website field does not count,
because that is not a search.

**Stages are independent.** `enrichCompany` runs each stage inside a wrapper
that catches, records `DONE` / `FAILED` / `UNAVAILABLE` / `SKIPPED` on the
company row, and continues. An unconfigured provider is `UNAVAILABLE`, not a
failure, so a fresh install does not report every run as degraded.

**One outbound path.** Every external call goes through `net/httpClient`:
timeout, capped body, exponential backoff with full jitter, a shared per-provider
rate limiter, and a circuit breaker. Query strings are stripped before logging,
because some providers put the API key there.

**Costs are visible.** Every call is written to `api_usage`, every AI call to
`ai_usage` with an estimated cost, and both appear on Analytics. Website
analyses are cached for `WEBSITE_ANALYSIS_TTL_HOURS`.

## Technology, and why

| Choice | Reason |
| --- | --- |
| TypeScript everywhere | One language across UI, jobs and domain; the `Sourced`/`Lookup` types do real work |
| Next.js 15 App Router | Server components read the database directly and server actions replace a hand-written REST layer, with CSRF handled by same-site cookies plus Next's origin check |
| PostgreSQL + Prisma | Relational data with real constraints; migrations are reviewable SQL |
| BullMQ + Redis, with an inline driver | Production gets durable retries; a laptop with only Postgres still runs the whole product |
| Own session auth (jose + bcryptjs) | One signed httpOnly cookie. Adding an identity provider would be more moving parts than this needs |
| Tailwind | Utility CSS with no component library to fight |
| Vitest | Fast, native ESM and TypeScript |
| cheerio | Parses the HTML the analyzer already fetched; no browser needed |

No headless browser: it would multiply cost and runtime for signals that server
HTML already carries. If JavaScript-rendered analysis is ever needed, it belongs
behind the existing `analyzer` interface.

## Adding a country

1. Write a `CountryProfile` (`core/countries/`) with currency, language,
   timezone, regions, ccTLDs, legal suffixes, postcode normaliser and privacy
   notes; register it in `countries/registry.ts`.
2. Add `registryCodes` for that country to the industries in
   `industry/taxonomy.ts` (Germany: WZ 2008, France: NAF, and so on).
3. Implement a `CompanySourceProvider` for its registry and add it to
   `providers/registry.ts`.
4. Review the jurisdiction's data-protection position and add it to
   `PRIVACY.md`.

Nothing in scoring, the pipeline or the UI changes: they read the profile.

## Adding a provider

Implement `CompanySourceProvider`, `WebSearchProvider` or `PlaceProvider` and
register it in `providers/registry.ts`. The interfaces are deliberately small.
A provider that is not configured must report `isConfigured() === false` and
throw `PROVIDER_NOT_CONFIGURED` if called, so the pipeline can tell "nothing
found" from "nobody looked".

## Security

- Sessions are signed JWTs in an httpOnly, SameSite=Lax cookie; `Secure` when
  `APP_URL` is https.
- Passwords use bcrypt at cost 12. Login gives one message for both unknown
  email and wrong password, and runs a dummy comparison so timing does not leak
  account existence either.
- Every input crossing a boundary is parsed with zod. Prisma parameterises all
  SQL. React escapes all output.
- Security headers and a CSP are set in `next.config.mjs`.
- `audit_logs` records logins, status changes, exports and deletions.
- No secret is exposed to the client; there is no `NEXT_PUBLIC_` variable.

## Testing

136 tests: scoring bands and caps, deduplication, HTML extraction and quality
scoring, industry classification, rate limiter, circuit breaker, backoff,
robots.txt parsing and precedence, the Companies House client against its
documented schema (including 404, non-JSON, timeout and persistent 500),
website discovery honesty rules, signal evidence, outreach fact discipline, CSV
injection, filter validation, and a six-case pipeline integration suite against
a real database.
