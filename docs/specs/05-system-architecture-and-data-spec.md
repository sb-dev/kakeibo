# Kakeibo — System Architecture and Data Spec

**Version:** 1.2  
**Date:** 2026-09-01  
**Status:** Canonical implementation spec

## 1. Purpose and authority

This spec defines Kakeibo's runtime architecture, canonical persistence, financial-data flow, import architecture, Kei integration, first-party analytics, security and privacy boundaries.

Canonical product layering:

```text
Source financial data
→ General financial core
→ Kakeibo planning + optional goals
→ Weekly review / user confirmation
→ Trusted financial history
→ Kei explanations
```

Analytics is a parallel supporting capability rather than another financial layer:

```text
Marketing web events ─┐
Mobile product events ├→ First-party analytics in Neon
Backend product events┘
```

The internal financial model may be richer than the mobile vocabulary. Analytics may describe how the product is used, but it must not become a duplicate financial model.

This spec owns architecture, persistence and analytics boundaries. `01` owns product behaviour, `02` financial meaning, `03` Kei behaviour, `04` mobile presentation and `06` testing/delivery/operations.

The implementation must realise `02-financial-domain-model-spec.md` without redefining it.

---

## 2. Core rules

```text
Neon application schema  → canonical financial/application state
Neon analytics schema    → first-party product + marketing events
Hono API                 → application and analytics boundary
Workflows                → durable multi-step work
R2                       → uploaded/generated blobs
Durable Objects          → live workflow coordination only
AI Gateway / LLM         → bounded explanation layer
Better Stack / Cloudflare→ operational telemetry boundary
```

Rules:

1. Mobile never connects directly to Neon.
2. All private application reads and writes go through the authenticated API.
3. Neon is the single Postgres platform for canonical application state and first-party analytics, with explicit logical/schema separation between them.
4. Analytics events are not canonical financial truth.
5. Product analytics are not the financial audit trail.
6. Analytics are not operational observability.
7. Product analytics never flow to Meta or another advertising platform.
8. R2, Durable Objects and LLMs never own canonical financial truth.
9. Store enough financial meaning for one coherent financial model; expose only what the current UX needs.
10. Prefer the simplest runtime that safely satisfies the use case.

The critical distinction is:

```text
financial domain state
≠ financial audit history
≠ product / marketing analytics
≠ operational telemetry
```

---

## 3. Adopted platform

| Concern | Technology |
|---|---|
| Monorepo | pnpm + Turborepo |
| Language | TypeScript |
| Mobile | React Native + Expo + Expo Router |
| Mobile UI | React Native Reusables + NativeWind |
| Marketing | Astro |
| API | Hono on Cloudflare Workers |
| Durable work | Cloudflare Workflows |
| Live workflow status | Durable Objects + WebSockets when useful |
| Database | Neon Postgres |
| DB access | Cloudflare Hyperdrive |
| Blob storage | Cloudflare R2 |
| LLM boundary | Cloudflare AI Gateway |
| Infrastructure | Terraform + Wrangler |
| First-party product analytics | Neon Postgres |
| First-party marketing analytics | Neon Postgres |
| Analytics time-series support | TimescaleDB |
| Analytics retention jobs | pg_cron |
| Baseline web analytics | Cloudflare Web Analytics |
| Consent-gated ad conversion tracking | Meta CAPI |
| Marketing bot protection/filtering | Cloudflare SBFM / Bot Management |

Cloudflare Web Analytics remains the lightweight website dashboard. Neon is the queryable first-party event store for richer web and app questions.

TimescaleDB and pg_cron apply to the analytics subsystem, not the canonical financial domain tables.

Do not add a third-party product-analytics platform or overlapping infrastructure without a demonstrated capability gap.

---

## 4. Runtime topology

```text
Kakeibo Mobile
      │
      ├── authenticated application commands/queries
      │          ▼
      │      Hono Worker
      │          ├── application/domain services → Hyperdrive → Neon app data
      │          ├── Workflows
      │          ├── R2
      │          ├── Durable Object status
      │          └── AI Gateway → LLM
      │
      └── client-only product events
                 ▼
          product analytics endpoint
                 ▼
          Neon analytics schema

Application services
      │
      └── confirmed product outcomes
                 ▼
          analytics writer
                 ▼
          Neon analytics schema

trykakeibo.com
Astro / Cloudflare
      │
      ├── Cloudflare Web Analytics
      └── consented marketing events
                 ▼
          marketing analytics endpoint
                 ├── Neon analytics schema
                 └── allowlisted conversion events → Meta CAPI
```

The marketing site does not own authenticated financial state.

Backend-generated product events should be preferred for outcomes the server can authoritatively observe. Client analytics are reserved for exposures and interactions the server cannot see.

---

## 5. Monorepo boundaries

Recommended structure:

```text
apps/
  mobile/
  web/
  api/

packages/
  domain/
  application/
  database/
  financial-ingestion/
  api-contracts/
  api-client/
  validation/
  kei/
  analytics/
  design-tokens/
  observability/
  mocks/
  config/

infra/
  terraform/
  environments/
```

`domain` owns financial semantics and invariants and must not depend on UI, Hono, Neon, Cloudflare bindings, analytics or provider SDKs.

`application` owns use cases, authorisation-aware orchestration and transaction boundaries.

`database` owns canonical Postgres repositories, mappings and migrations.

`financial-ingestion` owns ingestion-source adapters, parsing/synchronisation, source identity and normalisation contracts.

`kei` owns provider-neutral grounding and model contracts.

`analytics` owns the event taxonomy, product/marketing event contracts, event writers, Meta allowlisting/relay helpers, TimescaleDB analytics migrations and aggregate/query helpers. It must not own financial-domain semantics.

`observability` owns technical telemetry helpers; it is deliberately separate from `analytics`.

Share domain/contracts, not Astro and React Native view components.

---

## 6. Application layering

```text
UI / HTTP
→ API command/query
→ application service
→ domain behaviour
→ repository / external adapter
→ infrastructure
```

Hono routes parse transport, establish identity and delegate.

Application services enforce authorisation and coordinate transactions/workflows.

Domain code owns financial meaning.

Infrastructure code owns Postgres, R2, Workflows and AI providers.

Consequential financial rules must not live in route handlers or screens.

---

## 7. API architecture

Use one Hono application API unless a demonstrated operational requirement justifies splitting it.

Application capabilities:

```text
accounts / sources
imports
reviews
plans
goals
history / Explore
rules
Kei
workflow status
authentication callbacks
billing integration when selected
```

Analytics capabilities:

```text
product analytics ingestion
marketing analytics ingestion
selected server-side product outcome emission
selected Meta CAPI relay for allowlisted marketing conversions only
```

The product and marketing analytics endpoints may share transport infrastructure but use distinct validation and routing policies.

Use logical command/query separation without separate application databases or CQRS infrastructure.

Consequential application mutations follow:

```text
authenticate
→ validate
→ application service
→ domain transition
→ database transaction
→ optional server-side product outcome event
→ response
```

Analytics writes must never be inside the canonical financial transaction in a way that can make a product action fail solely because analytics storage is unavailable. Where necessary, treat analytics emission as best-effort or use a durable follow-up mechanism.

---

## 8. Canonical logical data model

These canonical application concepts must remain distinguishable:

```text
User
Financial Source
Provider Connection
Source Account
Ingestion Run
Source Record
Financial Entry
Classification
Merchant / Counterparty
Category
Rule
Review
Split
Duplicate Decision
Monthly Plan
Fixed Commitment
Envelope Allocation
Financial Goal
Goal Allocation
Goal Contribution
Reflection
Kei Observation
Audit Event
```

Do not reduce the financial model to one overloaded `transactions` table.

Canonical ID, source ID and import fingerprint are different identities.

Analytics records are deliberately **not** part of this canonical financial model. They live in a separate analytics schema and may reference application identifiers only when explicitly allowed by the analytics privacy model.

---

## 9. Financial sources, accounts and adapters

The architecture separates **where data comes from** from the canonical financial account and entry models.

```text
FinancialSource
      │
      ├── file
      └── connected_provider
              │
              ▼
        SourceAccount(s)
              │
              ▼
        SourceRecord(s)
              │
              ▼
        FinancialEntry
```

### Financial Source

A `FinancialSource` identifies an ingestion mechanism owned by the user.

Minimum logical data:

```text
id
owner
source kind
provider key
display name
status
created / updated timestamps
```

Initial source kind:

```text
file
```

Planned extension:

```text
connected_provider
```

The canonical schema and application contracts must not use `csv` as the meaning of a financial source.

### Source Account

A source exposes one or more accounts.

Store:

```text
id
owner
financial source
external/source account ID when available
display name
account nature
currency
status
provider metadata where required
```

Account nature may include:

```text
current/checking
debit card
credit card
savings
investment
loan
mortgage
e-wallet
```

Account nature provides context but does not determine financial classification.

### Ingestion adapter boundary

All ingestion mechanisms converge on the same interface conceptually:

```text
source-specific data
→ IngestionAdapter
→ NormalisedSourceRecord
→ financial normalisation
→ FinancialEntry
```

The adapter owns source-specific concerns such as:

```text
field/column mapping
date parsing
amount sign convention
source transaction types
counterparty/reference extraction
stable source IDs
source lifecycle state
provider-specific metadata
```

For files, the adapter parses an uploaded document.

For a connected provider, the adapter fetches or receives provider data and maps it into the same normalised record contract.

Bank/provider-specific behaviour must not leak into the financial domain.

### Connected-provider extension point

A connected provider may additionally require a `ProviderConnection` associated with a `FinancialSource`.

Logical information:

```text
provider
external connection ID
connection status
consent / reconnect state
automatic refresh capability
last successful synchronisation
next refresh eligibility when supplied
provider-specific opaque metadata
```

Do not implement Salt Edge-specific fields in core domain entities. Keep external identifiers and raw provider states behind the ingestion/provider boundary.

The initial CSV product does not need to instantiate provider connections, but the persistence model must allow a Financial Source to gain this relationship without changing `FinancialEntry` semantics.
---

## 10. Ingestion runs and provenance

Every ingestion operation creates an `IngestionRun`.

```text
file source
→ file import run

connected provider
→ synchronisation run
```

An ingestion run tracks at least:

```text
owner
financial source
source account(s)
mode
adapter version
status
timestamps
record counts
validation/synchronisation result
workflow reference
source cursor/watermark when applicable
```

A file-import run additionally references its R2 object and file metadata.

A connected-provider run may reference an external attempt/refresh identifier and an opaque incremental cursor.

Each accepted source record retains enough provenance to answer:

```text
which source?
which account?
which ingestion run?
which file or provider record?
which source row / external ID?
what raw value?
how was it normalised?
which adapter/version produced the result?
```

Raw files live in R2 according to retention policy.

Canonical parsed state lives in Neon.

Source-file deletion must not invalidate canonical history.

---

## 11. Financial Entry

`FinancialEntry` is the internal representation of normalised financial activity.

Minimum logical data:

```text
id
owner
source account / provenance
effective date
raw amount
normalised amount / direction
currency
raw + display description
merchant / counterparty
movement
scope
review state
timestamps
```

Canonical movements:

```text
inflow
outflow
transfer
adjustment
```

Do not infer movement globally from amount sign. Source adapters resolve source-specific conventions first.

A provider may expose lifecycle state such as `pending` and `posted`. Preserve that source state separately from Kakeibo review state.

```text
provider/source lifecycle
≠
Kakeibo review truth
```

The ingestion layer must support reconciliation when an upstream provider changes a transaction from pending to posted, changes supplied metadata, or replaces one provider record with its posted equivalent. Such updates must preserve source lineage and must not silently erase a user-reviewed interpretation.

---

## 12. Classification

Keep classification dimensions separate:

```text
movement
plan treatment
category
optional tags
optional goal
scope
```

Plan treatments:

```text
Fixed
Needs
Wants
Culture
Unexpected
Goal
Outside plan
Unclassified
```

Use relational fields/tables for core dimensions that require constraints or aggregation.

Use JSONB only for auxiliary/source-specific metadata.

Categories are user-extensible and use stable IDs.

Merchants and tags support evidence, grouping, search and insights; neither proves financial purpose.

A connected provider may supply its own transaction category, merchant enrichment, mode/type or duplicate flag. Preserve useful provider enrichment as source evidence, but do not map it directly to reviewed Kakeibo classification.

```text
provider category
→ optional preparation evidence

Kakeibo rule/history + user confirmation
→ canonical reviewed classification
```

Kakeibo should not depend on Salt Edge categorisation to function.

---

## 13. Rules

Preserve the deterministic rule engine:

```text
equals
starts_with
ends_with
contains
regex
```

Rule data includes owner, match type, pattern, prepared classification, optional merchant, priority, active state and optional migration metadata/tags.

Evaluation:

```text
active rules ordered by priority
→ first match wins
→ prepared classification
→ preparation state
→ user confirmation
→ reviewed truth
```

Rules never create reviewed truth.

Rule edits affect future preparation unless the user explicitly corrects history.

---

## 14. Review and history

Review truth:

```text
unreviewed
reviewed
```

Preparation:

```text
needs decision
worth checking
looks safe
```

Do not store these as one ambiguous status.

A weekly Review records period, included entries, workflow/completion state, user-confirmed actions and summary/reflection references.

Closing a review never converts unresolved entries to reviewed.

Consequential changes must remain auditable:

```text
classification confirmed/changed
split confirmed
duplicate decision
plan change
goal change
rule change
```

Audit history answers what changed, when, by whom and from/to what.

---

## 15. Splits, duplicates and idempotency

### Splits

```text
Financial Entry
  ├── Split Part
  └── Split Part
```

Invariant:

```text
sum(split parts) = original amount
```

The original remains provenance; confirmed parts drive aggregates and the original is not counted again.

### Import idempotency

Re-importing the same source record creates no second canonical entry.

Prefer a stable source/provider ID. Fallback identity includes source-account provenance and stable source fields.

The legacy `description + amount + date` hash may be retained as migration metadata but not as the sole canonical identity.

Connected providers should use stable provider transaction IDs as the primary source identity when available, scoped by provider connection/account. Provider pagination cursors, `from_id`-style watermarks or equivalent synchronisation tokens are ingestion metadata, never Financial Entry identity.

### Financial duplicates

Distinct source records may be duplicate candidates:

```text
candidate
→ keep both OR confirm duplicate
```

Only confirmed duplicates are excluded from aggregates.

---

## 16. Transfers, credit cards and business scope

Transfers remain financial activity without becoming ordinary spending.

Where possible, link both sides of a transfer, but do not require full double-entry accounting.

Credit-card treatment:

```text
tracked card purchases
→ spending

bank payment settling those purchases
→ transfer / Outside plan
```

If underlying card activity cannot be established, preserve uncertainty rather than silently excluding the payment.

Business activity remains representable with:

```text
scope = business
```

It may be reviewed, searched and exported without consuming personal Kakeibo envelopes.

This does not imply a business-accounting or tax product.

---

## 17. Monthly plans and fixed commitments

A monthly plan is versioned user intent.

Persist:

```text
period
planning income
fixed commitments
plan-funded goal allocations
Needs / Wants / Culture / Unexpected
monthly intention
status/version
```

Plan changes do not rewrite financial history.

Historical plans remain retrievable.

Fixed commitments are planned entities distinct from observed entries:

```text
planned obligation ≠ reviewed payment
```

A commitment may carry expected amount/range, category, recurrence and source hints. Matching an import to it may prepare review context but cannot create reviewed truth.

---

## 18. Financial goals

Goals are first-class canonical entities even when not yet prominently surfaced.

Persist:

```text
goal type
user-visible name
user-selected target
funding mode
optional time target
status
timestamps
```

Funding modes:

```text
plan-funded
tracking-only
```

Goal types may include:

```text
cash buffer
general savings
sinking fund
mortgage overpayment
debt reduction
investment contribution
pension contribution
custom
```

Store user selections, not research-derived recommendations.

### Goal intent versus progress

```text
Goal
  ├── target
  ├── monthly allocations
  └── reviewed contributions
```

Allocation and contribution are different facts.

A Financial Entry or Split Part may contribute to a goal.

Goal changes do not rewrite historical contributions.

---

## 19. Derived views and transaction boundaries

Today, Review, Plan, Goals and Explore use deterministic derived views such as:

```text
review workload
reviewed / unreviewed spending
remaining envelopes
pace / projected remainder
goal progress
merchant history
```

Derived caches are replaceable, not canonical truth.

Consequential actions should commit atomically when one invariant spans multiple records.

Examples:

```text
confirm classification
→ classification + review state + audit

confirm split
→ validate conservation + parts + review + audit

confirm duplicate
→ duplicate decision + aggregate eligibility + audit

update plan
→ validate equation + persist new version
```

---

## 20. Durable ingestion workflows

Use normal Worker requests for bounded work.

Use Cloudflare Workflows for multi-step work requiring retries, resumability, waits or progress.

Initial durable workflow:

```text
mobile selects CSV
→ authenticate + validate metadata
→ store file in R2
→ create Ingestion Run
→ Workflow
→ file adapter parses
→ validate
→ normalise source records
→ source identity / idempotency
→ create/reconcile Financial Entries
→ duplicate candidates
→ deterministic rules + reviewed history
→ preparation states + groups
→ bounded Kei context when useful
→ persist to Neon
→ publish completion
→ open Review Brief
```

Future connected-provider workflow reuses the same downstream stages:

```text
provider callback / authorised refresh
→ verify provider request
→ create or resume Ingestion Run
→ fetch incremental account/transaction changes
→ provider adapter
→ NormalisedSourceRecords
→ source identity / reconciliation
→ same canonical financial pipeline
→ prepare affected review state
→ persist to Neon
```

The canonical financial pipeline must not care whether a normalised source record originated from CSV or Salt Edge.

Preparation never auto-reviews financial activity.

Do not put normal CRUD into Workflows or add a queue merely because work is asynchronous.

---

## 21. Planned Salt Edge Account Information extension

Salt Edge Account Information is the planned first connected-banking provider after the CSV-based system has been implemented and proven.

It is a **future ingestion adapter**, not part of the initial product runtime.

### 21.1 Scope

Planned scope:

```text
bank connection
account discovery
balances where useful
transaction synchronisation
connection health / reconnect
```

Not implied:

```text
payment initiation
bank transfers initiated by Kakeibo
Salt Edge as canonical categorisation
Salt Edge-specific financial semantics
```

Payment initiation requires a separate product and security decision.

### 21.2 Connection flow

The mobile application must be able to start an external provider-authorisation journey and receive a safe return into Kakeibo.

Keep this capability abstract:

```text
mobile
→ API creates provider connection session
→ provider-hosted authorisation
→ return/deep link
→ backend confirms connection state
→ background ingestion
```

Do not build the current CSV UI around an assumption that all future sources can be configured entirely inside a native form.

Provider credentials and provider secrets remain server-side/provider-side and must never be stored by the mobile application.

### 21.3 Synchronisation model

Connected banking is incremental and recurring, unlike a one-shot CSV upload.

The ingestion architecture must support:

```text
initial sync
incremental sync
provider callback
manual refresh
automatic/background refresh
reconnect
connection removal
```

Use provider callbacks where available to trigger or resume synchronisation rather than building continuous polling into the mobile app.

Callbacks are infrastructure signals, not canonical financial events.

Callback handlers must:

```text
verify provider authenticity/signature
be idempotent
persist minimal provider state
start/resume bounded ingestion work
return quickly
```

Longer fetching and reconciliation belongs in a Workflow.

### 21.4 Provider transaction lifecycle

Connected-provider records may be:

```text
pending
posted
changed
marked duplicate upstream
removed/replaced upstream
```

Preserve provider lifecycle separately from Kakeibo review state.

A later provider refresh may refine source data, but must not silently destroy a reviewed Kakeibo decision.

Reconciliation must preserve:

```text
provider record lineage
previous source representation where materially relevant
canonical Financial Entry identity
user-reviewed classification
auditability
```

### 21.5 Provider categorisation

Salt Edge may supply personal/business categorisation and merchant enrichment.

Treat these as optional ingestion evidence.

Default architectural preference:

```text
Kakeibo deterministic rules
+ Kakeibo reviewed history
+ user confirmation
→ canonical Kakeibo classification
```

Provider enrichment may improve preparation only when it proves useful.

Do not couple Kakeibo category IDs or goal semantics to Salt Edge's category taxonomy.

### 21.6 Seamless-extension criterion

Adding Salt Edge should require:

```text
provider adapter
provider connection persistence
authorisation/reconnect UI
callback endpoints
sync Workflow
provider-specific tests
```

It should **not** require changing:

```text
FinancialEntry meaning
Kakeibo classifications
review truth
monthly-plan semantics
goal semantics
Kei financial authority
analytics architecture
```

That is the architectural test that CSV was correctly treated as one ingestion source rather than the financial model itself.

---

## 22. Durable Object status

A Durable Object may coordinate live status:

```text
upload accepted
processing
preparing review
complete
failed
```

It may support WebSocket subscribers.

It never owns Financial Entries, plans, goals, classifications or review truth.

Mobile must recover status through the API if the live connection disappears.

---

## 23. Kei architecture

```text
mobile / workflow
→ Hono
→ application service
→ bounded canonical query
→ grounding object
→ Kakeibo Kei adapter
→ AI Gateway
→ LLM
→ structured output
→ validation
→ persist when useful
```

Provider-specific response types remain behind the Kakeibo adapter.

Use deterministic application logic for:

```text
totals
budget status
pace
goal progress
duplicates
history counts
review state
rule results
```

Use the LLM for explanation, summarisation, phrasing and bounded suggestions.

Kei receives bounded task-specific grounding, not unrestricted database access.

Examples:

```text
DecisionExplanationGrounding
WeeklySummaryGrounding
GoalProgressGrounding
```

Do not automatically send raw CSV files, complete account history, unrelated goals, authentication data, secrets or raw logs.

Kei cannot directly persist reviewed classifications, plan changes, goal targets, rule mutations or duplicate decisions.

Core workflows continue when Kei is unavailable.

---

## 24. First-party analytics architecture

### 23.1 One first-party analytics subsystem

Use Neon Postgres as Kakeibo's first-party analytics store for:

```text
marketing web events
mobile product events
selected backend product events
```

This creates one queryable analytics platform without introducing a third-party product-analytics SDK or a second analytics datastore.

The analytics subsystem remains logically separated from canonical financial data.

Recommended database separation:

```text
app.*
→ canonical application + financial state

analytics.product_events
→ app/product behaviour

analytics.marketing_events
→ website/acquisition behaviour

analytics.*_daily
→ derived rollups / continuous aggregates
```

Use separate product and marketing event tables rather than forcing native-app and browser-specific context into one schema. Cross-surface analysis should use deliberate views/queries.

### 23.2 Product analytics event envelope

A product event should support:

```text
event_id
event_name
occurred_at
received_at
user_id?            # authenticated product events only
anonymous_id?       # where explicitly supported
session_id?
event_source        # mobile_app | backend
surface?             # Today | Review | Plan | Goals | Explore
screen?
platform?            # ios | android | backend
os_version?
app_version?
build_number?
properties JSONB
```

Product-event inserts must be idempotent. `event_id` plus the event time/partition key should support safe retries without producing duplicate analytics rows.

`properties` contains low-sensitivity event-specific context. It must not become a copy of financial-domain records.

### 23.3 Marketing analytics event envelope

Marketing events preserve the updated Astro design's browser/acquisition context, including:

```text
event_id
event_name
occurred_at / received_at
source_url
referrer
device / browser / OS context
country where collected
UTM attribution
bot metadata where available
custom_data JSONB
```

Web events are consent-gated according to the marketing tracking policy before they are written to first-party analytics or relayed to Meta. They also retain the updated marketing design's bot-filtering boundary so verified/automated traffic does not contaminate first-party acquisition analysis. Mobile product analytics must not inherit browser bot-scoring rules.

The updated Astro design's existing `analytics_events` table is the marketing-event precursor. When product analytics is introduced, migrate or map it into `analytics.marketing_events` rather than forcing native app fields into the web-shaped schema.

Cloudflare Web Analytics remains the baseline cookieless website dashboard. Neon provides raw queryable events for funnels, cohorts, attribution and cross-surface analysis.

### 23.4 Semantic event taxonomy

Track meaningful product transitions rather than every tap.

Preferred examples:

```text
import_started
import_completed
review_available
review_started
review_completed
classification_changed
rule_created
plan_created
plan_updated
goal_capability_shown
goal_capability_dismissed
goal_setup_started
goal_created
goal_archived
reflection_completed
```

Avoid broad instrumentation such as `button_clicked`, `card_expanded` or `screen_scrolled` by default. Add interaction-level events only to answer a defined UX question.

Event names and required/allowed properties are version-controlled contracts in `packages/analytics`.

### 23.5 Client versus server events

Prefer server-side product events for outcomes the application can authoritatively observe:

```text
import_completed
review_completed
goal_created
plan_updated
rule_created
```

Use client events for states the server cannot observe reliably:

```text
goal_capability_shown
goal_capability_dismissed
specific screen exposure
```

This avoids treating a UI intention as proof that a domain action succeeded.

### 23.6 Financial-data minimisation

Product analytics must not copy sensitive canonical financial values merely because they are available.

Do not include by default:

```text
income / salary
account balances
mortgage values
debt balances
goal target amounts
goal current amounts
individual spending amounts
merchant-level financial history
raw descriptions
```

Prefer event metadata such as:

```text
review_completed
  decision_count = 6
  group_count = 4
  duration_bucket = "5-10m"

goal_created
  goal_type = "cash_buffer"
  funding_mode = "plan_funded"
  has_target_date = false
```

If analysis genuinely requires a financially derived dimension, define it explicitly, minimise precision, document the purpose and review its privacy impact before collection.

### 23.7 Analytics identity

Marketing visitors may begin anonymous while the app uses authenticated Kakeibo users.

The architecture may support:

```text
anonymous marketing identity
→ conversion / signup
→ authenticated product identity
```

Do not automatically persist a cross-surface identity link simply because it is technically possible.

Identity linking requires an explicit product/privacy policy defining:
- purpose;
- consent or other applicable basis;
- retention;
- deletion behaviour;
- which marketing identifiers may be associated with an authenticated user.

Cross-surface acquisition analysis should use the minimum identity linkage necessary for the question being answered.

### 23.8 TimescaleDB, aggregates and retention

Use TimescaleDB for analytics event tables where supported by the deployed Neon configuration.

Use:

```text
time partitioning
compression for older raw events
continuous aggregates for common daily rollups
pg_cron for retention / maintenance
```

The updated marketing design uses seven-day chunks, compression of older analytics data and continuous daily aggregates. Product and marketing tables may use different retention or aggregation policies even though they share the same analytics subsystem.

Do not apply TimescaleDB requirements to canonical financial tables merely because analytics uses it.

Raw-event retention and aggregate retention are policy decisions. Marketing analytics may follow the updated site's one-year raw-event baseline; product analytics retention must be explicitly set rather than inherited accidentally.

### 23.9 Analytics availability

Analytics is non-critical to the financial workflow.

A failure to record a product event must not prevent:

```text
import
review confirmation
plan update
goal update
rule creation
```

Analytics ingestion may batch and retry, but it must not create a second domain event-processing architecture.

### 23.10 Hard boundaries

```text
Product analytics
≠ canonical financial state

Product analytics
≠ financial audit history

Analytics
≠ operational observability

Marketing analytics
≠ permission to export product analytics to Meta
```

Only explicitly allowlisted marketing/conversion events may be sent to Meta CAPI.

Mobile product events and authenticated product-behaviour events are Neon-only unless a separate future policy explicitly changes that boundary.

---

## 25. Marketing site and Meta conversion boundary

`trykakeibo.com` uses Astro on Cloudflare and owns landing pages, pricing, product explanation, public help/content, campaigns, consent and marketing acquisition analytics.

It does not own authenticated financial state.

Use Astro Content Collections/Markdown and prefer static generation.

Marketing analytics flow:

```text
Cloudflare Web Analytics
→ baseline cookieless website visibility

consented browser events
→ `/api/track` marketing analytics endpoint
→ consent + bot validation
→ analytics.marketing_events in Neon
→ allowlisted conversion events only → Meta CAPI
```

The first-party Neon write is the complete marketing event record for Kakeibo analytics. Meta receives only the deliberately selected standard conversion subset. Analytics-only events such as scroll depth or page exit remain Neon-only.

Never send to Meta or another advertising platform:

```text
mobile product analytics
financial entries
spending history
review results
goal amounts
account balances
financial classifications
Kei financial observations
```

Marketing identifiers such as UTM parameters, `_fbp`, `_fbc`, hashed contact identifiers and bot metadata belong to the marketing analytics/conversion boundary and must not leak into the canonical financial domain.

---

## 26. Authentication, authorisation and security

The authentication provider remains open.

Fixed requirements:
- secure native authentication flow;
- API resolves provider identity to a Kakeibo user;
- provider identity stays separate from canonical user ID;
- every private resource is owner-scoped;
- clients cannot authorise access by supplying arbitrary user IDs;
- provider-specific identity types do not leak into domain code.

Initially assume one user owns one financial workspace unless sharing is explicitly designed later.

Treat imported and derived financial data as sensitive.

Minimum rules:

```text
TLS everywhere
no database credentials on clients
least-privilege bindings
environment-separated secrets
authenticated + authorised access
no raw CSV contents in logs
explicit source-file retention
auditable consequential mutations
```

Analytics permissions are separate from financial access permissions. An analytics writer may record an approved product event; it must not gain broad authority to read unrelated financial data.

Product-event property allowlists should enforce data minimisation at the server boundary.

Production financial data must not be copied into normal development or untrusted preview environments.

---

## 27. Logs, retention and recovery

Technical logs, financial audit history and analytics events are separate data classes.

Technical logs may use correlation IDs such as:

```text
request_id
user_id
import_id
review_id
workflow_id
release
```

Do not log raw CSV rows, secrets, access tokens or unnecessary financial descriptions.

Retention policy must distinguish:

```text
raw uploaded files
canonical financial history
financial audit history
Kei content
product analytics raw events
product analytics aggregates
marketing analytics raw events
marketing analytics aggregates
operational logs
backups
```

The updated marketing analytics design provides a one-year raw-event retention baseline with longer-lived aggregate reporting. Product analytics may require a different policy and must be configured explicitly rather than silently inheriting the marketing value.

`pg_cron` may implement analytics retention jobs inside Neon. Canonical financial retention is governed independently and must never be driven by analytics cleanup jobs.

User export/deletion must be possible through application capabilities rather than manual database edits. Where analytics contains a linkable authenticated `user_id`, deletion policy must define how corresponding raw events are deleted, anonymised or retained.

Backup/restore policy and recovery objectives remain open, but Neon is the recoverable canonical store, R2 recovery is separate, and restore procedures must preserve ownership and financial audit relationships.

Analytics can generally tolerate bounded loss or regeneration of aggregates more readily than canonical financial history; recovery objectives may therefore differ.

A backup without a tested restore procedure is insufficient.

---

## 28. Postgres and schema evolution

Use standard Postgres first:

```text
relations
foreign keys
unique/check constraints
transactions
indexes
views
JSONB where genuinely useful
```

Use separate logical schemas for canonical application data and analytics so access, migrations and retention cannot be confused.

Analytics may additionally use:

```text
TimescaleDB hypertables
compression
continuous aggregates
pg_cron retention jobs
```

These analytics extensions do not change the financial-domain persistence model.

Do not add by default:

```text
second primary database
event store
graph database
separate vector database
distributed transactions
third-party product analytics warehouse
```

Migrations are version-controlled.

Application migrations preserve financial history, provenance, ownership, rule ordering, review truth, plan/goal history and auditability.

Analytics migrations preserve event-contract compatibility and must not block normal financial migrations unnecessarily.

Distinguish:

```text
technical schema migration
domain reinterpretation
user-confirmed financial correction
analytics taxonomy migration
```

A domain reinterpretation must not silently masquerade as a technical migration. An analytics taxonomy change must not rewrite canonical financial history.

---

## 29. Migration from current `src`

Current storage contains accounts, merchants, rules, historical transactions, natures and currencies.

Preserve existing transaction provenance:

```text
transaction ID
account
amount
currency
description
category
subcategory
merchant
date
```

Map existing categories into the richer `02` model using a documented deterministic migration while retaining original values.

Preserve rule semantics:

```text
equals
starts_with
ends_with
contains
regex
priority
active
merchant
category / subcategory
tags
transactionType
```

The current CLI rule choice `skip` means **classify once without creating a rule**. It must not become review `skip`.

The existing transaction hash may remain migration metadata but not the sole new import identity.

Migration principle:

```text
preserve historical meaning
→ map to richer canonical concepts
→ retain provenance
→ avoid silent reinterpretation
```

The JSON-file persistence architecture itself does not need to survive.

---

## 30. Extension rules and non-goals

Prefer:

```text
ordinary Worker
before
Workflow

Workflow
before
Queue

Postgres / TimescaleDB analytics
before
new analytics datastore
```

Add only when needed:
- KV for appropriate cacheable non-canonical data;
- DO rate limiting for coordinated provider throttling;
- Queues for proven burst/fan-out/event-bridge requirements;
- another worker runtime for sustained CPU-heavy work;
- pgvector for a demonstrated assistant capability not served by relational history;
- HLL for approximate unique counting only when analytics volume justifies it;
- a columnar analytics extension/store only when TimescaleDB/Postgres no longer meets measured analytics needs.

Do not introduce without demonstrated need:

```text
direct mobile-to-Postgres
microservice per feature
Kafka / NATS
Kubernetes
generic event sourcing
second primary financial database
separate Kei memory database
queue by default
generic Kei chat backend
vector/RAG by default
third-party product analytics SDK/platform
business accounting platform
full double-entry accounting engine
wealth-management platform
```

The general financial core is broader than the initial UX but limited to concepts Kakeibo actually needs.

The analytics subsystem is similarly deliberate: meaningful outcome events first, fine-grained behavioural instrumentation only when a defined research question requires it.

---

## 31. Open decisions

These remain explicit decisions rather than silent implementation choices:

```text
authentication provider
subscription / App Store billing abstraction
primary LLM provider
exact financial-data retention durations
backup / restore policy and recovery objectives
product-analytics retention duration
product-analytics consent / preference policy
cross-surface anonymous-to-authenticated identity-linking policy
```

The updated marketing analytics design remains consent-gated for its first-party tracking/CAPI path.

Any selected solution must satisfy this spec's separation between financial state, audit history, analytics and operational telemetry.

---

## 32. Acceptance criteria

The architecture is correct when:

- mobile reaches private financial state only through authenticated APIs;
- Neon is the single Postgres platform while canonical application data and analytics remain logically separated;
- persistence models the general financial core, not only spendings;
- Kakeibo planning and goals share the same financial truth;
- source-specific formats/signs are isolated behind adapters;
- CSV is an initial ingestion adapter rather than a structural assumption;
- a connected provider can feed the same normalised source-record pipeline without changing Financial Entry semantics;
- provider connections, synchronisation state and provider transaction lifecycle remain outside the financial domain;
- pending/posted provider state cannot be confused with reviewed/unreviewed Kakeibo state;
- provider categorisation can be retained as preparation evidence without becoming canonical Kakeibo classification;
- callback-driven incremental ingestion can be added without mobile polling or a second financial store;
- source provenance remains traceable;
- exact source re-imports are idempotent;
- financial duplicate review remains separate from import idempotency;
- transfers and credit-card settlement avoid double-counting without deleting history;
- business activity can remain outside the personal Kakeibo plan;
- current priority/first-match rule behaviour migrates intact;
- rules prepare but never review entries;
- review truth remains distinct from preparation state;
- splits conserve value without counting the source twice;
- plan history and goal intent remain reconstructable;
- goal allocations remain distinct from reviewed contributions;
- consequential financial mutations are auditable;
- durable imports can retry/resume without corrupting canonical state;
- Durable Objects and R2 never become canonical financial stores;
- Kei is provider-independent, bounded and unable to mutate financial truth directly;
- core financial workflows continue when Kei is unavailable;
- web, mobile and selected backend product events can be analysed through first-party Neon analytics;
- product and marketing analytics use distinct event contracts/tables within the shared analytics subsystem;
- server-generated events represent confirmed product outcomes where the server can observe them;
- client analytics are limited to meaningful exposures/interactions the server cannot observe;
- analytics event properties do not copy sensitive financial values by default;
- analytics failure cannot block a financial-domain action;
- product analytics remain distinct from financial audit history and operational telemetry;
- mobile/product analytics are never forwarded to Meta;
- only allowlisted marketing conversion events may reach Meta CAPI;
- TimescaleDB/pg_cron analytics policies do not affect canonical financial tables;
- current JSON/rule data can migrate without losing historical meaning;
- deeper goals do not require replacing the core architecture;
- new infrastructure appears only after demonstrated need.

Core rule:

> Keep financial meaning in Kakeibo-owned domain code, canonical application state and first-party analytics in deliberately separated Neon schemas, interfaces behind the Hono API, durable multi-step work in Cloudflare Workflows, blobs in R2, operational telemetry outside analytics, and Kei as a bounded interpretation layer over trusted financial data.

---

*Kakeibo — System Architecture and Data Spec v1.2 · 1 September 2026*
