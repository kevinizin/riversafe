# Privacy and data protection

This system processes information about UK businesses for B2B prospecting. It is
designed to sit inside UK GDPR and PECR rather than to be retro-fitted to them.

**This document is not legal advice.** It records the design decisions and the
reasoning behind them so that you, as the controller, can review them against
your own circumstances and take advice where you need it.

---

## Who is who

You — the operator running this deployment — are the **controller**. You decide
which searches to run and who to contact. The software is a tool you operate; it
makes no contact decisions on your behalf and sends nothing.

## What is processed

### Company information (mostly not personal data)

Name, registered number, incorporation date, registered office, SIC codes,
status, website, social profile URLs, review counts, activity signals, scores.

Most of this is not personal data. Some is: a sole trader's registered office is
often a home address, and a company name can contain a person's name. It is
treated with the same care throughout.

### Contact information (personal data)

Stored in a separate `contacts` table, deliberately, so it can be found,
reviewed and erased on its own. Each row carries `source`, `sourceUrl`,
`confidence`, `evidence`, `collectedAt`, `purpose` and `retentionStatus`, plus
an explicit `isPersonal` flag.

The system prefers, in order:

1. a business email (`info@`, `enquiries@`) published by the business
2. a business phone number
3. an enquiry form URL
4. an officer's **role title** from the public register (Director, Managing
   Director) — used to address a message, not to identify an individual

It deliberately does **not** collect personal mobile numbers or personal email
addresses, does not enrich individuals against third-party people-data brokers,
and does not build profiles of individuals.

## Lawful basis

**Legitimate interests**, UK GDPR Article 6(1)(f): identifying businesses that
may want a website, and contacting them about it.

The three-part test, documented here so it can be challenged:

**Purpose.** Offering a professional service to a business that appears to need
it. A legitimate commercial interest, and one the recipient often benefits from.

**Necessity.** Contacting a business about its website requires knowing which
business, what its digital presence looks like, and how to reach it. The system
collects the minimum for that and no more: no personal profiles, no home
contacts, no data unrelated to the purpose.

**Balance.** The data is overwhelmingly business information published by the
business or by the public register. Volumes are low and targeted rather than
bulk. Business contact points are preferred over personal ones. A recipient
would reasonably expect a supplier to approach them this way. Every record can be
erased in one click. On balance, the interest is not overridden — but this is
your assessment to make and to revisit, especially if you increase volume.

**PECR.** Electronic marketing to *individual subscribers* (sole traders and
some partnerships) is restricted beyond GDPR. This system therefore prepares
outreach but never sends it: each message is a draft you read, edit and send
yourself through your own mail client, where your own suppression lists and
opt-out handling apply. Check the TPS/CTPS before calling, and honour any
objection immediately.

## Data minimisation in practice

- Only fields the product actually uses are stored. The raw provider payload is
  kept in `company_sources` for auditability and can be pruned.
- Website analysis stores *results* — booleans, counts, a score, a weakness list
  — not page content. No HTML, no screenshots, no images.
- Social discovery stores the profile URL and handle. It does not fetch feeds,
  posts or follower graphs.
- Personal data is confined to `contacts`, with its own retention state.
- Nothing is inferred and stored as fact. Where a value is unknown it stays
  UNKNOWN and the score records the gap.

## Transparency

Prepared messages say plainly where the observation came from — "I came across
your company while looking at recently established dental businesses in
Manchester" — because that is what happened. Include your privacy notice and an
objection route in the messages you send; the draft leaves room for both.

If someone asks how you found them, the lead's **Evidence** section is a
complete, timestamped answer.

## Individual rights

| Right | How it is served |
| --- | --- |
| Access | Every field, source and timestamp is on the lead detail page; CSV export produces a copy |
| Rectification | Fields are editable; re-running enrichment refreshes from source |
| Erasure | "Delete this company and all its data" — a real cascading delete, not a hidden flag |
| Objection | Erase the record, or set the lead to DISCARDED so it never resurfaces in results |
| Portability | CSV export |

Erasure removes the company and every related row: sources, industries,
websites, analyses, social profiles, signals, contacts, scores, notes, outreach
drafts and run results. The `audit_logs` entry records that a deletion happened
and by whom, with no personal data in it.

**Handle a request within one month.** Erase rather than suppress unless you have
a specific reason to keep the record.

## Retention

`DATA_RETENTION_DAYS` (default 365) sets the review period; per-record state
lives in `retentionStatus` and `retentionUntil`.

Suggested practice:

- Leads with no engagement: review at 12 months, then erase.
- Leads that said no: erase the personal data, keep only what is needed for
  suppression.
- Customers: retention becomes a matter for your contract and accounting
  obligations, outside this system.

## Security

- Passwords bcrypt-hashed at cost 12; sessions are signed httpOnly SameSite
  cookies, `Secure` over https.
- Every input validated with zod; all SQL parameterised by Prisma; output
  escaped by React; CSP and security headers set at the edge.
- Secrets live only in environment variables and are never sent to the browser;
  query strings are stripped from logs, and anything key-shaped is redacted.
- `audit_logs` records logins, lead status changes, exports and deletions.
- Export is server-side and authenticated; the CSV is guarded against
  spreadsheet formula injection.

## Collection conduct

- `robots.txt` is honoured, and an unreadable one is treated as a disallow.
- The user agent identifies the tool and a contact address.
- Rate limits, timeouts and body caps on every request; a circuit breaker stops
  us hammering a failing host.
- Blocks are respected. A 401, 403 or CAPTCHA ends the attempt and is recorded.
  There is no proxy rotation, no header spoofing, no CAPTCHA solving, and none
  will be added.
- Social platforms are never accessed directly.

## Breach

If personal data is exposed, assess the risk to individuals and — where the risk
is more than unlikely — report to the ICO within 72 hours of becoming aware.
`audit_logs`, `system_logs` and `api_usage` together provide the access trail.

## Adding another country

Each new jurisdiction needs its own review before it is enabled: the registry's
licence terms, whether officer data may be processed, the local ePrivacy rules
on unsolicited B2B contact, and any registry-specific restriction on reuse. That
review is why Germany, the Netherlands, France, Spain, Ireland, Portugal and
Italy are architecturally supported but not switched on.
