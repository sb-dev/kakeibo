# Kakeido — Open-Source Project Organisation Spec

**Version:** 2  
**Date:** 2026-09-02  
**Status:** Canonical implementation spec

## 1. Purpose and authority

Kakeido is organised as one open-source product with one public codebase and several public surfaces.

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
Kei behavioural/evaluation artefacts
contribution/security policy
```

The official Kakeido service is one production deployment of that public software.

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

> **Kakeido is open-source personal-finance software. The official Kakeido service is a supported production deployment of the same public codebase.**

The public source should make it possible to inspect:

```text
financial normalisation
Kakeibo calculations
review truth
rules/history preparation
goal semantics
Kei policy, persona, task contracts and grounding
Kei release/evaluation definitions
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
Kakeido
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

## 3. Why open source fits Kakeido

### Trust

Kakeido handles sensitive financial data.

Users and engineers should be able to verify:

```text
what is deterministic
what requires user confirmation
what Kei receives
which Kei policy/task contract governs a response
how Kei candidates are benchmarked and promoted
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
→ Kakeido financial core
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
Kei policy/persona/task contracts
Kei grounding/output schemas
Kei release manifests
Kei benchmark/red-team definitions and safe synthetic datasets
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
raw production Kei grounding/prompts/responses containing financial data
production AI traces containing personal or financial data
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

Kakeido maintains one supported architecture:

```text
React Native / Expo
Cloudflare
Neon
R2
bounded Kei application runtime
AI Gateway
Better Stack
supported external providers
```

Do not create parallel infrastructure solely for a separate community deployment.

Avoid by default:

```text
Docker-only Kakeido
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
| Website | Consumer acquisition/trust | Why use Kakeido? |
| README | Project overview/first success | What is Kakeido and how can I inspect/run it? |
| Docs | Product and technical reference | How does Kakeido work? |
| Academy | Kakeibo practice and product proficiency | How do I use Kakeido well? |
| Blog | Discovery and current thinking | What is Kakeido learning and exploring? |
| Canonical Specs | Source-of-truth behaviour | What must Kakeido mean/do? |
| Synthetic Fixtures | Engineering/test evidence | Can behaviour be reproduced safely? |
| Kei Evaluation Assets | Behavioural quality evidence | How is Kei tested without using production financial data? |
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
→ tests / Kei benchmarks where applicable
→ release manifest
→ technical docs
→ README / website explanation
```

A README, blog post, Issue, Discussion or marketing page cannot silently redefine behaviour.

When public writing introduces an idea that becomes Kakeido behaviour, update the owning spec.

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
kakeido/
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
│   │   ├── policy/
│   │   ├── persona/
│   │   ├── tasks/
│   │   ├── schemas/
│   │   ├── evals/
│   │   └── release/
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
│   ├── understanding-kakeido/
│   └── advanced-use/
│
├── blog/
│   ├── kakeido/
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
What Kakeido is
Weekly-review model
Why open source
Trust/AI/privacy boundaries
Kei behaviour and evaluation
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

> The official Kakeido service runs the same open-source application available in this repository.

Do not turn the README into the complete documentation.

---

## 13. Trust explanation

README/website should provide direct routes to:

```text
Financial Domain Model
Kei Assistant Spec
Kei evaluation/release documentation
System Architecture/Data
Analytics architecture
Security policy
```

Key verifiable claims include:

```text
Kei does not own financial truth
production Kei behaviour is versioned and traceable to public source
unreviewed activity is not silently reviewed
product analytics is first-party in Neon
product events do not route to Meta
provider categories do not become Kakeido truth automatically
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

Do not require production Meta, Salt Edge, store submission or production LLM configuration merely to run core tests. Kei tests and benchmarks should support synthetic fixtures and controlled test model configuration.

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
functioning Kakeido deployment
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

Adding Salt Edge must not create a separate Kakeido financial model.

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

They cannot become reviewed Kakeido truth by themselves.

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
Kei deterministic contract tests
Kei benchmarks/red-team cases
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
| Kei behaviour/authority | `03` |
| Kei runtime architecture | `05` |
| Kei evaluation/release/operations | `06` |
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
Kei behavioural contract
→ prompt/task implementation
→ benchmark/red-team cases
→ immutable release manifest
→ public release explanation
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

Docs explain how Kakeido works for users, contributors and independent operators.

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
Kei authority and Known / Likely / Unknown
Kei runtime/release model
Kei evaluation and privacy boundaries
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

The Academy teaches the Kakeibo practice and how to use Kakeido effectively.

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
  goals in Kakeido
  cash buffers
  sinking funds
  allocations vs contributions

Understanding Kakeido
  review truth
  what Kei knows and does not know
  Known / Likely / Unknown
  why Kei cannot change financial truth
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
Kakeido
→ releases, product decisions, design changes

Kakeibo
→ method, history, modern practice

Money & Behaviour
→ financial reflection, habits, decision-making research

Engineering & Trust
→ privacy, bounded AI, Kei evaluation/versioning, open source, analytics, open banking
```

The Blog may explore ideas before they become product behaviour.

If an idea is adopted into Kakeido, the owning canonical spec must be updated.

The Blog must not publish identifiable financial data or turn general educational content into personalised financial advice.

---

## 26. Website

The website remains primarily a consumer/trust surface.

It answers:

> Why should I trust and use Kakeido?

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
Kei source/version/evaluation transparency
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
AI evaluation, shadow testing and release engineering
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
Kei benchmark/red-team improvements
safe bounded Kei task/prompt improvements
safe UI improvements
```

Product-scope changes require stronger review.

Community demand is evidence, not automatic product direction.

A technically sound pull request can still be wrong for Kakeido.

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
compatible Kei task/prompt implementation
Kei benchmark/evaluator improvement
```

Requires tests and spec compatibility.

### Level 3 — Canonical change

```text
financial invariant
product scope
architecture boundary
Kei authority/policy
Kei agent/tool/memory boundary
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
Kei behaviour/evaluation impact if relevant
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
packages/kei/policy/
packages/kei/tasks/
packages/kei/schemas/
packages/kei/evals/
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

Vulnerabilities involving authentication, authorisation, financial exposure, provider credentials/callbacks, cross-user Kei grounding, prompt injection with material impact, model/provider data leakage, Kei tool-authorisation failures or analytics privacy must not begin as public Issues.

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

## 37. Software licence

Kakeido adopts the **Apache License 2.0**.

```text
SPDX identifier: Apache-2.0
Copyright 2026 Samir Benzenine
```

Apache-2.0 permits:
- use;
- modification;
- redistribution;
- commercial use;
- independent hosted deployments.

It provides explicit copyright and patent grants while preserving attribution and notice requirements.

Do not add private restrictions to the Apache-2.0 software licence or describe a more restrictive source-available variant as Kakeido's open-source licence.

The repository root `LICENSE` file is authoritative for the full licence text.

---

## 38. Licence strategy

Kakeido deliberately chooses a permissive open-source model.

The intended trade-off is:

```text
low adoption friction
commercial compatibility
straightforward contribution/reuse
clear patent terms
```

in exchange for allowing third parties to:
- fork Kakeido;
- modify it;
- redistribute it;
- operate commercial hosted versions;
- keep their own modifications private where Apache-2.0 permits.

Do not create a hidden premium core or intentionally reduce the public software to compensate for this permissive licence.

---

## 39. Hosted competition

Kakeido accepts that Apache-2.0 permits third parties to operate competing hosted services.

Protection of the official service should come primarily from:

```text
Kakeido trademark
product quality
operations
provider relationships
support
continuous development
user trust
```

not from source secrecy or intentionally crippled public functionality.

Software licensing and trademark rights remain separate.

---

## 40. Trademark

Software licence and trademark are separate.

Trademark policy governs use of:

```text
Kakeido
Kakeido logo
Kei identity where protected
official service branding
claims of endorsement
```

Forks may exercise their software rights without implying they are the official Kakeido service.

Maintain the repository-level `TRADEMARKS.md` policy and mature it before broader public launch or ecosystem scale makes ambiguity expensive.

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

if Kakeido is positioned as the open-source application.

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

Kei is part of the public product architecture, not a hidden hosted-service behaviour layer.

Public Kei artefacts should normally include:

```text
behavioural authority/policy
persona definition
task contracts
grounding contracts/builders
output schemas
provider-neutral model contracts
structured-output validation
fallback behaviour
release manifests
benchmark definitions
red-team definitions
safe synthetic evaluation datasets
```

The public repository should make it possible to answer:

```text
What may Kei do?
What may Kei never do?
What financial information can a Kei task receive?
Which exact behavioural release produced a response?
How is that release benchmarked?
What changed between two Kei releases?
```

### 45.1 Git as behavioural source of truth

Production-defining Kei behaviour remains version-controlled in Git.

Canonical flow:

```text
03 behavioural contract
→ Kei policy/persona/task implementation
→ benchmark/red-team evidence
→ immutable Kei release manifest
→ production promotion under 06
```

Do not make an external prompt-management dashboard the only place where production behaviour exists.

A dashboard may mirror, test or visualise Kei behaviour, but an official production Kei release must resolve to public Git-traceable source.

### 45.2 Public release traceability

Kei runtime releases use Semantic Versioning as defined by `06`.

Canonical spec documents use whole-number documentation versions; that rule does not apply to Kei runtime releases.

A production Kei release should be traceable to:

```text
Kei semantic version
bundle hash
public source commit
policy/persona/task/schema versions
benchmark-suite/dataset versions
model-route reference
```

The exact provider/model selected by a dynamic route may vary under controlled rollout, but the route/version relationship must remain operationally traceable.

Do not reuse an already released Kei semantic version for changed behaviour.

### 45.3 Public evaluation assets

Safe evaluation artefacts should be public by default:

```text
synthetic benchmark cases
deterministic assertions
model-judge definitions where safe
red-team cases where publication does not create material security risk
benchmark configuration
evaluation command/documentation
aggregate benchmark results when published
```

Evaluation assets are engineering evidence, not a separate public "Examples" surface.

They should live with Kei engineering/testing assets and be reusable by contributors and CI.

### 45.4 Private production evidence

Remain private by necessity:

```text
raw production financial grounding
raw production prompts containing financial data
raw production responses containing personal financial context
production AI traces containing user data
private user feedback/support evidence
sensitive anti-abuse details where disclosure creates material risk
provider credentials
```

Production failure evidence should become public regression coverage only after it is reduced to the minimum reproducible behaviour and sanitised or replaced by synthetic data.

### 45.5 Contributor expectations for Kei

A Kei contribution that changes generated behaviour should identify:
- affected task/policy/persona/schema;
- intended behavioural change;
- benchmark impact;
- red-team impact where relevant;
- compatibility/version impact;
- privacy/security impact;
- evidence that deterministic financial truth remains outside the model.

A contribution may improve wording or task behaviour without changing `03` when it remains inside the existing behavioural contract.

A change to Kei authority, advice boundaries, memory/tool policy or task semantics requires canonical-spec review.

### 45.6 External AI platforms

Kakeido may use external model providers, AI Gateway features or evaluation/observability platforms.

They must not create a private behavioural fork.

Required invariant:

```text
external AI service
≠
canonical Kei behaviour
```

The public repository must contain enough configuration/contracts to understand the official behaviour without access to a private dashboard.

Secrets, production routing credentials and private user traces remain outside the repository.


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
Kei behavioural/model-route changes when user-relevant
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
Kei release/model-route compatibility where relevant
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
Kei benchmark/red-team assets
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
richer walkthroughs/reference fixtures
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

Kei behavioural release example:

```text
policy/task implementation
benchmark/red-team evidence
release manifest
relevant technical docs
release notes
README/site trust explanation only when the user-facing contract changes
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
Does this improve canonical Kakeido?
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
├── Academy
├── Blog
├── Synthetic Fixtures
├── Kei Evaluation Assets
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

The goal is to make the real Kakeido product:

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

Legal review should validate trademark, brand/asset and contributor-policy details where appropriate. The software licence is already Apache-2.0.

---

## 54. Acceptance criteria

The open-source organisation is correct when:

- the repository contains the real Kakeido product rather than a reduced edition;
- the official service uses the same canonical architecture as the public project;
- another operator can deploy Kakeido with documented supported provider accounts and their own credentials;
- no parallel community/self-hosted architecture is required;
- secrets/user data/commercial agreements remain private without becoming hidden runtime dependencies;
- every public surface has a clear responsibility;
- behaviour remains owned by canonical specs rather than README/blog/issues;
- financial, Kei and analytics trust boundaries are inspectable;
- production-defining Kei policy/persona/task/schema behaviour is Git-traceable rather than dashboard-only;
- official Kei releases use Semantic Versioning plus immutable bundle hashes while canonical spec documents use whole-number versions;
- safe Kei benchmark/red-team definitions and synthetic evaluation datasets are public engineering assets;
- raw production financial prompts, grounding, responses and user traces remain private;
- production Kei defects can become public regression cases only after sanitisation or synthetic reconstruction;
- external AI/evaluation platforms do not become a hidden source of canonical Kei behaviour;
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

> Keep the real Kakeido product and production-defining Kei behaviour public, keep user data and sensitive operations private, maintain one architecture, and make trust verifiable through specifications, code, benchmarks and tests.

---

*Kakeido — Open-Source Project Organisation Spec v2 · 2 September 2026*
