# Kakeibo — Open-Source Project Organisation Spec

**Version:** 1.2  
**Date:** 2026-09-01  
**Status:** Canonical implementation spec

## 1. Purpose and authority

Kakeibo is organised as one open-source product with one public codebase and several public surfaces.

The repository remains the source of truth for:

```text
source
canonical specifications
financial-domain behaviour
database migrations
deployment infrastructure
tests
technical documentation
synthetic fixtures
contribution/security policy
```

The official Kakeibo service is one production deployment of that public software.

There is no separate:

```text
Community Edition
Self-Hosted Edition
Open-Source Edition
Cloud Edition architecture
```

A technically capable operator can deploy the same architecture using their own accounts with the supported managed providers.

This spec owns:

- open-source repository organisation;
- public project surfaces;
- relationship between public source and the official service;
- contribution/maintainer boundaries;
- independent deployment expectations;
- licensing/trademark requirements;
- extension organisation;
- security-disclosure organisation;
- public documentation ownership.

Other canonical specs retain authority over product (`01`), financial semantics (`02`), Kei (`03`), mobile design (`04`), architecture/data (`05`) and delivery/operations (`06`).

This spec exposes those concepts publicly but does not redefine them.

---

## 2. Open-source proposition

The project proposition is:

> **Kakeibo is open-source personal-finance software. The official Kakeibo service is a supported production deployment of the same public codebase.**

The public source should make it possible to inspect:

```text
financial normalisation
Kakeibo calculations
review truth
rules/history preparation
goal semantics
Kei grounding
analytics events/boundaries
provider integrations
deployment infrastructure
tests and releases
```

A functioning independent deployment is:

```text
public repository
+
operator-owned provider accounts
+
operator-owned credentials
+
documented configuration
=
Kakeibo
```

The official service differs through official:

```text
provider accounts
production secrets
operational configuration
commercial relationships
support
operations
```

not through a hidden product architecture.

---

## 3. Why open source fits Kakeibo

### Trust

Kakeibo handles sensitive financial data.

Users and engineers should be able to verify:

```text
what is deterministic
what requires user confirmation
what Kei receives
what analytics collects
what can reach Meta
what bank providers contribute
```

Trust claims should be inspectable in code.

### Engineering quality

Public source enables:

```text
security review
financial-domain review
accessibility improvements
adapter contributions
test improvements
documentation fixes
```

Open source does not replace security/operations discipline.

### Extensibility

The strongest initial contribution seam is financial ingestion:

```text
source
→ IngestionAdapter
→ NormalisedSourceRecord
→ Kakeibo financial core
```

New source integrations should extend this boundary without changing financial semantics.

---

## 4. Public/private boundary

### Public by default

Normally public:

```text
mobile source
API source
financial domain
application services
database migrations
Cloudflare Workflows
CSV adapters
future Salt Edge adapter
Kei grounding/contracts
analytics contracts
marketing-site source
Terraform/Wrangler configuration
tests
CI/CD workflows
canonical specs
technical documentation
```

### Private by necessity

Remain private:

```text
production credentials
provider secrets/private keys
production financial data
production analytics data
customer/support data
commercial agreements
billing-account information
emergency/admin credentials
sensitive incident evidence
security-sensitive anti-abuse intelligence where publication creates material risk
```

Private information must not become a hidden software dependency.

---

## 5. One architecture

Kakeibo maintains one supported architecture:

```text
React Native / Expo
Cloudflare
Neon
R2
AI Gateway
Better Stack
supported external providers
```

Do not create parallel infrastructure solely for a separate community deployment.

Avoid by default:

```text
Docker-only Kakeibo
SQLite variant
local object-storage stack
local LLM stack
alternative workflow runtime
parallel database implementation
```

Independent deployments use the same supported provider interfaces as the official service.

Development mocks/fixtures are allowed where needed for testing. They do not constitute another production architecture.

---

## 6. Official service and independent deployments

The official service may provide:

```text
hosting
mobile distribution
data storage
bank connectivity
Kei inference
backups
monitoring
security operations
updates
support
billing convenience
```

An independent operator may deploy the source using their own supported provider accounts.

The project does not initially promise:

```text
home-server support
offline-only operation
arbitrary-cloud compatibility
one-command local production
deployment support for every infrastructure choice
```

Open-source availability does not imply a free hosted tier.

---

## 7. Public project journey

The public project should support:

```text
Discover
→ Trust
→ Try
→ Understand
→ Deploy or Extend
→ Contribute
```

Typical paths:

```text
Consumer
website → official service → privacy/open-source explanation

Engineer
GitHub → architecture/specs → tests → contribution

Independent operator
GitHub → deployment docs → provider accounts → deploy

Adapter contributor
ingestion contract → adapter guide → fixtures/tests → PR
```

Not every user needs every surface.

---

## 8. Public surfaces

| Surface | Purpose | Main question |
|---|---|---|
| Website | Consumer acquisition/trust | Why use Kakeibo? |
| README | Project overview/first success | What is Kakeibo and how can I inspect/run it? |
| Docs | Product and technical reference | How does Kakeibo work? |
| Academy | Kakeibo practice and product proficiency | How do I use Kakeibo well? |
| Blog | Discovery and current thinking | What is Kakeibo learning and exploring? |
| Canonical Specs | Source-of-truth behaviour | What must Kakeibo mean/do? |
| Synthetic Fixtures | Engineering/test evidence | Can behaviour be reproduced safely? |
| Issues | Actionable work | What needs changing? |
| Discussions | Community exploration | How should we think about this? |
| Security Policy | Private disclosure | How do I report a vulnerability? |
| Releases/Changelog | Version history | What changed? |

Each surface has one primary responsibility.

---

## 9. Repository as source of truth

Public knowledge should flow from canonical sources:

```text
canonical spec
→ implementation
→ tests
→ technical docs
→ README / website explanation
```

A README, blog post, Issue, Discussion or marketing page cannot silently redefine behaviour.

When public writing introduces an idea that becomes Kakeibo behaviour, update the owning spec.

---

## 10. Canonical spec set

```text
docs/
└── specs/
    ├── README.md
    ├── 01-product-and-ux-spec.md
    ├── 02-financial-domain-model-spec.md
    ├── 03-kei-assistant-spec.md
    ├── 04-mobile-design-system-spec.md
    ├── 05-system-architecture-and-data-spec.md
    ├── 06-engineering-delivery-and-operations-spec.md
    └── 07-open-source-project-organisation-spec.md
```

`docs/specs/README.md` contains:

```text
spec index
authority map
version/status map
conflict-resolution rule
```

Research remains separate:

```text
docs/research-logs/
```

Rule:

```text
research → may explain why
canonical spec → defines accepted behaviour
```

---

## 11. Repository structure

Recommended:

```text
kakeibo/
├── README.md
├── LICENSE
├── SECURITY.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── CHANGELOG.md
│
├── apps/
│   ├── mobile/
│   ├── web/
│   └── api/
│
├── packages/
│   ├── domain/
│   ├── application/
│   ├── database/
│   ├── financial-ingestion/
│   ├── api-contracts/
│   ├── api-client/
│   ├── validation/
│   ├── kei/
│   ├── design-tokens/
│   ├── analytics/
│   └── ...
│
├── docs/
│   ├── specs/
│   ├── research-logs/
│   ├── getting-started/
│   ├── product/
│   ├── concepts/
│   ├── guides/
│   ├── reference/
│   ├── architecture/
│   ├── deployment/
│   ├── contributing/
│   └── operations/
│
├── academy/
│   ├── foundations/
│   ├── building-the-ritual/
│   ├── monthly-planning/
│   ├── long-term-direction/
│   ├── understanding-kakeibo/
│   └── advanced-use/
│
├── blog/
│   ├── kakeibo/
│   ├── kakeibo/
│   ├── money-and-behaviour/
│   └── engineering-and-trust/
│
├── fixtures/
│   └── synthetic-financial-data/
│
├── infra/
│   ├── terraform/
│   └── environments/
│
└── .github/
    ├── ISSUE_TEMPLATE/
    ├── PULL_REQUEST_TEMPLATE.md
    └── workflows/
```

Exact names may evolve.

The invariants are:

```text
one monorepo
one architecture
one canonical spec set
public deployment infrastructure
no parallel Community Edition
```

---

## 12. README

The README should follow:

```text
Understand
→ Trust
→ Run
→ Inspect
→ Explore
→ Contribute
```

Recommended structure:

```text
Hero
What Kakeibo is
Weekly-review model
Why open source
Trust/AI/privacy boundaries
Architecture at a glance
Quick Start
Run tests
Deployment
Canonical specs
Project structure
Contributing
Security
Official service
Licence/trademark
```

It should explicitly state:

> The official Kakeibo service runs the same open-source application available in this repository.

Do not turn the README into the complete documentation.

---

## 13. Trust explanation

README/website should provide direct routes to:

```text
Financial Domain Model
Kei Assistant Spec
System Architecture/Data
Analytics architecture
Security policy
```

Key verifiable claims include:

```text
Kei does not own financial truth
unreviewed activity is not silently reviewed
product analytics is first-party in Neon
product events do not route to Meta
provider categories do not become Kakeibo truth automatically
```

Avoid vague security/AI marketing claims that cannot be substantiated.

---

## 14. Technical Quick Start

The Quick Start should reach first useful execution with minimal provider setup.

Typical route:

```text
clone
install
configure local/test environment
run checks
start relevant apps
load synthetic fixture
complete a review flow
```

Do not require production Meta, Salt Edge, store submission or production LLM configuration merely to run core tests.

Development mocks are acceptable when defined by the testing architecture.

---

## 15. Deployment documentation

Provide a first-class deployment guide for the actual managed architecture.

Cover:

```text
Cloudflare
Neon
Expo/EAS
Better Stack
LLM/AI Gateway
domain/DNS
Apple/Google where distributing apps
authentication/billing once selected
Salt Edge when activated
```

Separate configuration into:

```text
required
optional capability
production-only
future
```

Every deployment uses operator-owned credentials.

Desired invariant:

```text
public source
+
documented provider configuration
+
valid credentials
=
functioning Kakeibo deployment
```

Hidden official-only runtime behaviour is architecture/documentation drift.

---

## 16. Provider documentation

Each supported provider guide should describe:

```text
account/project setup
configuration
secret names
permissions
callbacks where relevant
verification
known limitations
recovery links
```

Do not publish:
- actual credentials;
- sensitive production identifiers;
- confidential commercial terms.

Provider setup documentation supplements `06`; it does not redefine operational policy.

---

## 17. Salt Edge

When activated, Salt Edge remains a normal ingestion integration:

```text
packages/
└── financial-ingestion/
    ├── core/
    ├── csv/
    └── salt-edge/
```

Salt Edge documentation covers:

```text
required provider access
connection flow
callback setup
sync/reconnect behaviour
sandbox/test setup
known limitations
```

Public:

```text
adapter implementation
mapping/normalisation
callback logic
tests
docs
```

Private:

```text
production credentials
commercial/provider agreement
production connection data
```

Adding Salt Edge must not create a separate Kakeibo financial model.

---

## 18. Adapter contribution contract

An ingestion adapter must:

```text
accept source-specific input
preserve provenance
produce NormalisedSourceRecord
respect source identity/idempotency
keep provider/source state separate from review truth
include synthetic fixtures
include deterministic tests
```

Provider categories/merchant enrichment may be preparation evidence.

They cannot become reviewed Kakeibo truth by themselves.

Adapter acceptance depends on correctness and maintenance cost, not popularity alone.

---

## 19. No extension marketplace initially

Do not build:

```text
plugin marketplace
adapter marketplace
extension-store infrastructure
generic registry platform
```

before real ecosystem demand.

Supported adapters may live directly in the monorepo.

Experimental third-party integrations may remain external and be linked where useful.

Design a registry only after concrete extension needs emerge.

---

## 20. Synthetic financial fixtures

Synthetic fixtures are first-class engineering assets.

They should be:

```text
realistic
synthetic
safe
reproducible
reusable across tests/docs
```

A canonical synthetic financial dataset should cover:

```text
income
rent/mortgage
groceries
transport
subscriptions
credit-card purchase
credit-card settlement
transfer
cash-buffer contribution
optional mortgage overpayment
business activity
mixed merchant
same-day same-amount entries
duplicate source record
duplicate candidate
split purchase
```

Reuse it across:

```text
domain tests
adapter tests
API tests
Maestro
documentation
screenshots
contributor onboarding
```

Never publish real personal financial exports as fixtures.

---

## 21. Knowledge ownership

| Information | Canonical location |
|---|---|
| Product definition | `01` |
| Financial semantics | `02` |
| Kei behaviour | `03` |
| Mobile design | `04` |
| Architecture/data | `05` |
| Delivery/operations | `06` |
| Open-source organisation | `07` |
| Installation/deployment | Docs |
| Synthetic test data | `fixtures/` |
| Research rationale | `docs/research-logs/` |
| Releases | GitHub Releases/Changelog |
| Defects/work | Issues |
| Community exploration | Discussions |
| Current public thinking | Blog/site |

Lower-authority surfaces may summarise but not contradict canonical sources.

---

## 22. Content reuse

Prefer reuse of meaning and executable assets.

```text
Canonical spec
→ implementation
→ reference/docs
→ concise public explanation
```

```text
Synthetic fixture
→ test
→ walkthrough
→ screenshot/demo
```

```text
Ingestion contract
→ CSV adapters
→ Salt Edge
→ contributor guide
```

Do not create a templating system merely to enforce literal single-sourcing of prose.

The goal is one authoritative meaning.

---

## 23. Docs

Docs explain how Kakeibo works for users, contributors and independent operators.

They are distinct from canonical specs:

```text
Canonical Specs
→ authoritative behaviour

Docs
→ understandable explanation, guidance and reference
```

Recommended areas:

```text
Getting Started
Product
Concepts
Guides
Reference
Architecture
Deployment
Operations
Contributing
```

Docs may cover:

```text
first import
first weekly review
monthly planning
long-term goals
Kei
review truth
rules/history
transfers
connected financial sources
adapter development
deployment
provider configuration
API/configuration reference
analytics event reference
```

Docs must not become a second source of product truth.

---

## 24. Academy

The Academy teaches the Kakeibo practice and how to use Kakeibo effectively.

It is not a generic financial-education product and must not provide personalised financial advice.

Suggested curriculum:

```text
Foundations
  Kakeibo
  weekly review
  Needs / Wants / Culture / Unexpected

Building the ritual
  first weekly review
  resolving uncertainty
  rules without losing control
  reflection

Monthly planning
  planning income
  fixed commitments
  flexible envelopes
  deliberate adjustments

Long-term direction
  goals in Kakeibo
  cash buffers
  sinking funds
  allocations vs contributions

Understanding Kakeibo
  review truth
  what Kei knows
  transfers vs spending
  user authority

Advanced use
  multiple accounts
  credit cards
  business-scope activity
  connected banking
```

Keep Academy content Markdown-first.

Do not build an LMS, course-account system, badges or progress infrastructure unless later evidence justifies it.

---

## 25. Blog

The Blog supports discovery and current thinking.

Recommended editorial streams:

```text
Kakeibo
→ releases, product decisions, design changes

Kakeibo
→ method, history, modern practice

Money & Behaviour
→ financial reflection, habits, decision-making research

Engineering & Trust
→ privacy, bounded AI, open source, analytics, open banking
```

The Blog may explore ideas before they become product behaviour.

If an idea is adopted into Kakeibo, the owning canonical spec must be updated.

The Blog must not publish identifiable financial data or turn general educational content into personalised financial advice.

---

## 26. Website

The website remains primarily a consumer/trust surface.

It answers:

> Why should I trust and use Kakeibo?

The README answers:

> What is the project, how does it work, and how can I inspect or contribute?

Useful website routes:

```text
Product
How it works
Kei
Pricing
Privacy
Open Source / Security
Blog
GitHub
```

Use repository-owned Astro content where practical without turning the site into technical reference documentation.

---

## 27. Open-source page

The website should have a concise open-source page explaining:

```text
source repository
official service uses public code
what is public/private
financial-truth model
Kei boundary
analytics boundary
security reporting
contribution route
```

Independent deployment is not a free tier of the official service.

It is independently operated open-source software using supported providers.

---

## 28. Public writing

Blog/site material may cover:

```text
Kakeibo design
weekly review
financial-domain modelling
privacy
bounded AI
open banking
engineering decisions
product research
release lessons
```

Public articles can propose ideas but cannot define canonical behaviour.

Never use identifiable user financial data in public content without explicit, appropriate consent and privacy review.

---

## 29. Contribution model

Strong contribution areas:

```text
bugs
tests
accessibility
documentation
financial-source adapters
parsers/normalisation
localisation
performance
security
developer tooling
safe UI improvements
```

Product-scope changes require stronger review.

Community demand is evidence, not automatic product direction.

A technically sound pull request can still be wrong for Kakeibo.

---

## 30. Product governance

Maintainers retain responsibility for canonical direction.

Changes such as:

```text
generic AI chat
investment recommendations
tax advice
portfolio trading
different budgeting philosophy
parallel infrastructure
```

cannot enter merely because implementation exists.

Rule:

```text
code contribution
cannot silently redefine
canonical product/domain architecture
```

Canonical changes update/review the owning spec before or alongside implementation.

---

## 31. Contribution levels

### Level 1 — Local improvement

```text
typo
documentation
test coverage
safe refactor
small defect
```

Normal review.

### Level 2 — Behavioural implementation

```text
adapter
API behaviour
review interaction
analytics event
goal interaction
```

Requires tests and spec compatibility.

### Level 3 — Canonical change

```text
financial invariant
product scope
architecture boundary
Kei authority
privacy rule
open-source governance
```

Requires explicit owning-spec review/update.

---

## 32. Pull requests

Meaningful PRs describe:

```text
problem
scope
behaviour
tests
affected canonical spec
privacy/security impact
analytics impact if relevant
release impact if relevant
```

Adapter PRs additionally document:

```text
source
normalisation
fixtures
idempotency
known limitations
```

Keep templates lightweight for trivial changes.

---

## 33. Issues and Discussions

Use Issues for actionable work:

```text
bugs
approved improvements
documentation defects
adapter requests
security follow-up after disclosure
```

Use Discussions for:

```text
questions
ideas
deployment help
adapter interest
financial-domain discussion
contributor help
```

Neither is canonical.

Important decisions must eventually appear in the relevant spec/issue/implementation.

---

## 34. Maintainers

Keep governance lean initially.

Maintainers own:

```text
canonical consistency
security response
release integrity
code review
product boundaries
provider compatibility
community moderation
```

Add maintainers based on sustained contribution and judgement, not raw contribution count.

Use `CODEOWNERS` selectively for high-consequence areas such as:

```text
packages/domain/
database migrations
packages/kei/
packages/analytics/
infra/
docs/specs/
SECURITY.md
```

---

## 35. Security policy

`SECURITY.md` is required from the beginning.

It defines:

```text
private reporting route
information to provide
supported versions
acknowledgement expectations
disclosure process
what must not be posted publicly
```

Vulnerabilities involving authentication, authorisation, financial exposure, provider credentials/callbacks, Kei leakage or analytics privacy must not begin as public Issues.

Use GitHub private security advisories or another documented private route.

---

## 36. Vulnerability workflow

```text
private report
→ acknowledge
→ reproduce/triage
→ assess
→ fix privately when required
→ release
→ coordinated disclosure
→ advisory/regression control
```

Security fixes should return to the public codebase once disclosure timing allows.

Do not maintain a permanently private patched product fork.

---

## 37. Licence requirements

Kakeibo requires an OSI-compatible licence before public launch.

The licence decision must explicitly address:

```text
modification
redistribution
commercial use
hosted use
attribution
patent terms
reciprocity
```

Do not describe a source-available licence that prohibits ordinary commercial use as open source.

Exact licence selection remains a deliberate legal/strategic decision.

---

## 38. Licence strategy

Two broad directions:

### Permissive

Examples:

```text
Apache-2.0
MIT
```

Advantages:

```text
low adoption friction
simple contribution/reuse
commercial use allowed
```

Trade-off:

```text
competitors may reuse code without publishing modifications
```

### Copyleft

A GPL-family licence may require reciprocal source availability in covered scenarios.

Advantages:

```text
stronger reciprocity
```

Trade-offs:

```text
more licence/integration complexity
hosted-service implications depend on licence
```

Do not invent a custom licence merely to restrict competitors while retaining an open-source label.

Legal review should validate the final choice.

---

## 39. Hosted competition

The project must explicitly decide whether third parties may operate competing hosted services under the selected licence.

This is primarily a:

```text
licence
trademark
execution
service quality
```

decision.

Do not deliberately cripple public core functionality to create a hosted-service moat.

Hosted value should come primarily from operating Kakeibo well.

---

## 40. Trademark

Software licence and trademark are separate.

Trademark policy governs use of:

```text
Kakeibo
Kakeibo logo
Kei identity where protected
official service branding
claims of endorsement
```

Forks may exercise their software rights without implying they are the official Kakeibo service.

Publish a simple trademark policy before ecosystem scale makes ambiguity expensive.

---

## 41. Assets and third-party licensing

Distinguish:

```text
software licence
documentation/content licence
brand/trademark permission
third-party asset licences
```

Do not assume the software licence automatically grants unrestricted use of logos, Kei artwork or third-party provider marks.

Contributor additions must use compatible licences.

---

## 42. No hidden premium core

Avoid:

```text
public shell
+
private financial engine
+
private review engine
+
private Kei behaviour
```

if Kakeibo is positioned as the open-source application.

Private service/admin tooling is acceptable when genuinely operational.

Core user-facing financial truth and review behaviour should remain public.

---

## 43. Commercial service

The official service may monetise:

```text
managed hosting
storage
bank connectivity
LLM usage
mobile distribution
backups
operations
support
maintenance
convenience
```

Pricing remains owned by `01`.

Open-source availability does not require the hosted service to be free.

---

## 44. Analytics transparency

Public code/docs should make clear:

```text
product analytics → first-party Neon
marketing analytics → separate Neon stream
operational telemetry → Better Stack/Cloudflare
financial audit → canonical application data
Meta → allowlisted marketing conversion events only
```

Production analytics data remains private.

The public implementation makes collection behaviour inspectable.

---

## 45. Kei transparency

Public Kei implementation should expose:

```text
grounding construction
deterministic financial inputs
provider boundary
structured output validation
failure fallback
```

Do not publish user prompts/data or production traces containing financial information.

Product-defining prompt/policy behaviour should generally be version-controlled where safe.

---

## 46. Financial-model transparency

The project should support traceability:

```text
financial invariant
→ domain code
→ regression test
```

Strong examples:

```text
review truth
rule ordering
split conservation
transfer exclusion
duplicate handling
goal allocation vs contribution
```

Publishing undocumented code alone is insufficient.

---

## 47. Releases

Use GitHub Releases and a concise changelog where useful.

Release notes communicate:

```text
user-visible changes
important technical changes
migration requirements
provider compatibility
known issues
security advisories when appropriate
```

Do not reproduce commit history as a changelog.

Public deployments may require compatibility notes for:

```text
database migrations
API/mobile runtime
provider integrations
Salt Edge API later
```

---

## 48. Public roadmap

Keep any public roadmap small:

```text
Now
Next
Later
```

Do not convert exploratory ideas into promises.

Salt Edge may remain:

```text
planned after the CSV-based system is implemented and proven
```

until evidence justifies activation.

---

## 49. Project maturity

### Initial public repository

Required:

```text
README
LICENSE
SECURITY.md
CONTRIBUTING.md
canonical specs
working source
tests
synthetic fixtures
CI
basic docs
```

### Deployable project

Add:

```text
provider setup
environment docs
Terraform/Wrangler guidance
migration guidance
deployment verification
```

### Active contributor project

Add when needed:

```text
adapter contribution guide
discussion categories
maintainer guide
triage conventions
clear support policy
```

### Ecosystem stage

Only after demonstrated demand:

```text
integration index
richer examples
formal compatibility policy
additional maintainers
```

Do not build community infrastructure ahead of community.

---

## 50. Public synchronisation

When a capability becomes usable, update the smallest public surface set required to make it understandable and inspectable.

Example: Salt Edge release:

```text
adapter implementation
ingestion docs
provider setup
security/provider notes
fixtures/tests
README capability summary
release notes
website capability update
```

Do not mechanically update every surface for every change.

---

## 51. Scope control

Reject upstream changes that primarily create:

```text
another product
another financial philosophy
another architecture
another UI framework
another infrastructure stack
```

unless deliberately adopted.

Review asks:

```text
Does this improve canonical Kakeibo?
Does it preserve the specs?
Does maintenance cost match value?
Does it create a parallel system?
```

Fork authors remain free to pursue different directions under the licence.

Upstream does not need abstractions solely to support hypothetical forks.

---

## 52. Initial open-source scope

Start with:

```text
Repository
├── README
├── Source
├── Canonical Specs
├── Technical Docs
├── Synthetic Fixtures
├── Deployment Guide
├── CONTRIBUTING
├── SECURITY
├── LICENSE
└── Website
```

Do not initially build:

```text
marketplace
learning-management system
community portal
special self-hosting distribution
complex plugin framework
```

The goal is to make the real Kakeibo product:

```text
transparent
inspectable
deployable using supported providers
extensible at deliberate seams
straightforward to contribute to
```

---

## 53. Open decisions before public launch

Resolve:

```text
trademark policy
brand/asset licence
copyright ownership
contributor licence policy if any
supported-version/security policy
official wording for independent deployments
```

Prefer conventional mechanisms.

Do not add a Contributor Licence Agreement without a concrete reason.

Legal review should validate the final model.

---

## 54. Acceptance criteria

The open-source organisation is correct when:

- the repository contains the real Kakeibo product rather than a reduced edition;
- the official service uses the same canonical architecture as the public project;
- another operator can deploy Kakeibo with documented supported provider accounts and their own credentials;
- no parallel community/self-hosted architecture is required;
- secrets/user data/commercial agreements remain private without becoming hidden runtime dependencies;
- every public surface has a clear responsibility;
- behaviour remains owned by canonical specs rather than README/blog/issues;
- financial, Kei and analytics trust boundaries are inspectable;
- public synthetic fixtures replace real personal financial data in tests and documentation;
- adapters can be contributed without redefining the financial core;
- Salt Edge can later be public as a normal ingestion adapter;
- contributions cannot silently expand product scope;
- vulnerabilities have a private disclosure path;
- Apache License 2.0 is the adopted software licence;
- software licence and trademark are treated separately;
- independent deployments cannot reasonably imply official endorsement;
- deployment docs describe the actual managed-provider architecture;
- there is no hidden premium implementation of core financial/review behaviour;
- commercial value can come from operating the official service rather than source secrecy;
- community/process infrastructure grows only when demonstrated demand requires it.

Core rule:

> Keep the real Kakeibo product public, keep sensitive operations private, maintain one architecture, and make trust verifiable through specifications, code and tests.

---

*Kakeibo — Open-Source Project Organisation Spec v1.2 · 1 September 2026*
