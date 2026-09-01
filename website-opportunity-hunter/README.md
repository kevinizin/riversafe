# Website Opportunity Hunter

Finds UK businesses that are in the right moment to buy a website — and explains,
lead by lead, why it thinks so.

This is not a company-list generator. The pipeline is:

```
FIND → ENRICH → ANALYSE → SCORE → PRIORITISE → EXPLAIN → PREPARE OUTREACH
```

The decision to contact anyone stays with you. The system never sends a message,
never publishes a website, and never fills a gap in its knowledge with a guess.

> **Scope.** The MVP is United Kingdom only (GBP, en-GB, Europe/London). The
> architecture is built for more countries — see `ARCHITECTURE.md` — but none
> are enabled, because each needs its own registry provider and its own privacy
> review first.

---

## What it actually does

1. **Finds companies** through the Companies House Public Data API — newly
   incorporated companies, filtered by SIC code, town and incorporation date.
2. **Works out the industry** from the registered SIC codes plus name keywords,
   recording which evidence produced the match.
3. **Looks for a website** using, in cost order: the registry record, a business
   listing, web search by name and town, web search by name, web search by phone,
   and finally probes of likely domains. Each candidate is *verified* against the
   company's own postcode, phone or name before it is accepted.
4. **Analyses the website** when one is found — 22 mechanical checks covering
   HTTPS, mobile, conversion, content, trust and speed — and produces a 0–100
   quality score plus a list of weaknesses, each tied to something observable.
5. **Finds social profiles** from links the company publishes on its own site and
   from public web search. It never logs into a platform or scrapes a feed.
6. **Detects activity signals** — recent incorporation, "now open", "coming soon",
   a placeholder website, recent reviews — always with the text that triggered it.
7. **Identifies the decision maker** from the public officer register — the
   active, non-corporate director most likely to be the founder. Roles and
   appointment dates only, unless you opt into collecting names.
8. **Scores the opportunity** 0–100 across five components, and explains every
   point (`SCORING.md`).
9. **Prepares outreach** from established facts only, and a brief for a demo
   homepage — which it can also render as a self-contained HTML concept page for
   you to download. Everything is a draft for you to review.

## Screens

| Screen | What it is for |
| --- | --- |
| Dashboard | Totals, priority leads, outreach funnel, recent runs |
| New search | Country, industries, location, company age, website status, score |
| Leads | Filterable list of lead cards |
| Lead detail | Overview, digital presence, decision maker, website analysis, score breakdown, evidence, outreach, preview brief and demo page, notes, data handling |
| CRM | The pipeline from NEW to WON/LOST |
| History | Every saved search, with its runs and counts; re-runnable |
| Analytics | Discovery and conversion rates, API and AI cost |
| System | Integration status, jobs, errors, API usage |
| Settings | Search defaults, classification thresholds, retention |

---

## Installation

Requires **Node 20.11+** and **PostgreSQL 16**. Redis is optional (see *Queue*).

```bash
git clone <this repo>
cd website-opportunity-hunter
npm install

cp .env.example .env
# edit .env: DATABASE_URL and AUTH_SECRET are required
#   openssl rand -base64 48   → AUTH_SECRET

npm run db:generate      # Prisma client
npm run db:migrate       # create the schema
npm run db:seed          # fictional demo data + a login

npm run dev              # http://localhost:3000
```

`npm run db:seed` prints the demo credentials it created
(`demo@example.com` / `demo-password-1` unless you set `SEED_EMAIL` /
`SEED_PASSWORD`). **Change them before deploying anywhere.**

A ready-made Postgres and Redis are in `docker-compose.yml`:

```bash
docker compose up -d
```

## Environment variables

Every variable is validated at startup by `packages/config`; a bad value fails
fast with a readable message rather than at the first request. None is prefixed
`NEXT_PUBLIC_`, so no key ever reaches the browser.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `AUTH_SECRET` | yes | Session signing key, 32+ characters |
| `APP_URL` | no | Used to decide whether the session cookie is `Secure` |
| `QUEUE_DRIVER` | no | `inline` (default, dev) or `redis` |
| `REDIS_URL` | with redis | BullMQ connection |
| `COMPANIES_HOUSE_API_KEY` | for real data | Free key; without it searches use the fictional demo dataset |
| `COMPANIES_HOUSE_RATE_LIMIT` / `_WINDOW_MS` | no | Client-side throttle (default 600 per 5 minutes) |
| `SEARCH_PROVIDER` | no | `none`, `brave`, `google_cse` |
| `BRAVE_SEARCH_API_KEY` / `GOOGLE_CSE_API_KEY` + `GOOGLE_CSE_CX` | with provider | Web search credentials |
| `PLACES_PROVIDER` | no | `none` or `google_places` — reviews, rating, opening hours |
| `GOOGLE_PLACES_API_KEY` | with provider | Places API (New) key |
| `WEBSITE_FETCH_TIMEOUT_MS`, `WEBSITE_MAX_BYTES` | no | Analyzer limits |
| `WEBSITE_ANALYSIS_TTL_HOURS` | no | Do not re-analyse a site more often than this (default 168h) |
| `WEBSITE_USER_AGENT` | no | Identify yourself honestly, with a contact address |
| `RESPECT_ROBOTS_TXT` | no | Default `true`. Leave it true |
| `COLLECT_OFFICER_NAMES` | no | Default `false`. When true, officer names are stored — personal data, so it is an explicit choice |
| `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `AI_MODEL` | no | Optional outreach personalisation |
| `AI_MONTHLY_BUDGET_GBP` | no | Hard monthly cap; calls stop when it is reached |
| `DATA_RETENTION_DAYS` | no | Default retention period for company records |

Which integrations a deployment actually has is shown on **Settings** and
**System**, so "not found" is never confused with "not configured".

### Costs

| Service | Cost |
| --- | --- |
| Companies House Public Data API | Free, key required |
| Brave Search API | Free tier, then paid per query |
| Google Programmable Search (CSE) | 100 queries/day free, then paid |
| Google Places API (New) | Paid per request, priced by field mask |
| Anthropic API | Paid per token; capped by `AI_MONTHLY_BUDGET_GBP` |

The system caches website analyses, records every external call in `api_usage`,
and shows spend on **Analytics**. Rules cover industry classification and
outreach drafting without any model call at all — AI is an enhancement, never a
dependency.

## Development

```bash
npm run dev            # web app (runs jobs inline)
npm run dev:worker     # background worker (only needed with QUEUE_DRIVER=redis)
npm run typecheck      # every package
npm test               # unit tests
npm run verify         # typecheck + tests
```

Integration tests need a database with the migrations applied:

```bash
createdb woh_test
DATABASE_URL=postgresql://woh:woh@localhost:5432/woh_test npm run -w @woh/db deploy
TEST_DATABASE_URL=postgresql://woh:woh@localhost:5432/woh_test npm test
```

Without `TEST_DATABASE_URL` the integration suite skips rather than passing
silently.

## Production

```bash
npm run build
npm start              # web
npm run start:worker   # worker, with QUEUE_DRIVER=redis
```

Checklist before going live:

- `AUTH_SECRET` is a fresh 48-byte random value, not the placeholder.
- `QUEUE_DRIVER=redis` and the worker process is running, so a long search is
  not tied to an HTTP request and survives a restart.
- `APP_URL` is `https://…`, which is what makes the session cookie `Secure`.
- `npm run db:deploy` (not `migrate dev`) applies migrations.
- The seeded demo user is deleted or its password changed.
- `WEBSITE_USER_AGENT` names you and a real contact address.
- `/api/health` is wired to your load balancer.

## Deployment

The web app is a standard Next.js server (any Node host: Fly, Railway, Render,
a container, a VM). The worker is a plain Node process. Both need
`DATABASE_URL`, `AUTH_SECRET` and the same provider keys. Postgres and Redis are
whatever your platform offers.

## Documentation

- `ARCHITECTURE.md` — modules, data flow, how to add a country or a provider
- `SCORING.md` — the opportunity score and website quality score in full
- `DATA_SOURCES.md` — every source, its endpoints, limits and terms
- `PRIVACY.md` — UK GDPR position, lawful basis, retention, erasure

## Limitations

Stated plainly, because a prospecting tool that overstates itself wastes your time:

- **"Website not found" is not "has no website."** It means several permitted
  discovery methods came back empty. Confidence is capped at MEDIUM and the
  reason is recorded on every lead.
- **Website analysis reads one page** — the homepage, plus up to three sampled
  links. It is a triage signal, not an audit.
- **Review counts and ratings need a places provider.** Without one they stay
  UNKNOWN and the score records the gap rather than assuming zero.
- **Social discovery finds profiles, not engagement.** Follower counts and
  posting frequency are only stored if a permitted source states them, which in
  practice means they are usually absent.
- **SIC codes are self-declared** at incorporation and are often generic, so
  industry classification carries a confidence and its evidence.
- **Companies House location filtering** matches the registered office, which is
  frequently an accountant's address rather than where the business trades.
- **No blocks are worked around.** A 403, a CAPTCHA or a robots.txt disallow ends
  the attempt and is recorded. There is no proxy rotation and no bypass.
- **The decision maker is inferred from role and appointment date**, not
  confirmed. A director appointed at incorporation is usually the founder; it is
  a strong heuristic, not a fact, and the reasoning is shown on the lead.
- **The demo homepage is a concept, not a website.** It carries a banner naming
  who prepared it and stating it was not commissioned, it is `noindex`, and
  anything unconfirmed is visibly marked as a placeholder. The system never
  publishes it anywhere.
- **UK only**, for now.

## What this system deliberately does not do

No voice calling. No WhatsApp automation. No mass email. No CAPTCHA or anti-bot
bypass. No fake accounts, reviews or identities. No publishing a generated site
to anyone's domain. No message goes out without you sending it.
