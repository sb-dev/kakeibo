# Kakeibo — Engineering Delivery and Operations Spec

**Version:** 1.0  
**Date:** 2026-09-01  
**Status:** Canonical implementation spec

## 1. Purpose and authority

This spec defines how Kakeibo is validated, delivered, released, observed, supported and recovered.

Production readiness comes from:

```text
repeatable checks
traceable releases
controlled rollout
tested recovery
useful telemetry
clear ownership
```

This spec owns:
- testing and quality gates;
- CI and environments;
- web/API/database/infrastructure delivery;
- mobile builds, updates and store releases;
- rollout and rollback;
- operational observability and alerting;
- support and incidents;
- provider operations;
- backup/restore operations;
- compatibility and cost controls.

Other canonical specs own product behaviour (`01`), financial semantics (`02`), Kei behaviour (`03`), mobile presentation (`04`) and system/data architecture (`05`).

This spec verifies and operates those contracts. It does not redefine them.

---

## 2. Delivery principles

1. **Git is the delivery control plane.** Every production artefact is traceable to a commit.
2. **Test at the cheapest reliable layer.** Domain checks before UI/device checks.
3. **Use Linux CI before native build infrastructure.**
4. **Automate stable repeatable work.** Keep unavoidable legal/account/store steps documented.
5. **Release small.** Prefer narrow, reversible changes.
6. **Rollback or safe degradation is part of release design.**
7. **Operational telemetry, product analytics and financial audit history remain separate.**

---

## 3. Tooling

| Concern | Tool |
|---|---|
| Repository / CI | GitHub + GitHub Actions |
| Monorepo | pnpm + Turborepo |
| Unit / integration | Vitest |
| API fixtures | MSW where useful |
| Web E2E | Playwright |
| Mobile E2E | Maestro |
| Device matrix | Firebase Test Lab |
| Mobile delivery | Expo Application Services |
| Cloudflare deployment | Wrangler |
| Infrastructure | Terraform |
| Operational telemetry | Better Stack + Cloudflare Observability |
| Native diagnostic fallback | Apple + Google platform diagnostics |
| Product analytics | First-party Neon analytics from `05` |

Do not add overlapping platforms without a demonstrated capability gap.

---

## 4. Environments

Use:

| Environment | Purpose |
|---|---|
| Local | development/debugging |
| Preview | PR/branch validation |
| Staging | production-like release candidate |
| Production | public system |

Alpha and beta are mobile **distribution stages**, not backend environments.

Rules:
- production secrets/data never reach untrusted preview execution;
- staging uses safe synthetic/test financial data;
- preview environments are disposable;
- production changes use protected workflows.

---

## 5. Configuration and secrets

Every required configuration value has:
- runtime validation where practical;
- documented purpose;
- environment owner;
- setup/recovery notes when provider-managed.

Secrets:
- never appear in source control or client bundles;
- remain environment-scoped;
- use least privilege;
- have an owner and rotation/recovery path.

Provider operations may cover Cloudflare, Neon, Expo/EAS, Apple, Google, Better Stack, Meta, LLM provider, authentication, billing and later Salt Edge.

---

## 6. Pull-request CI

Baseline:

```text
install/cache
→ format check
→ lint
→ typecheck
→ unit/integration tests
→ web build
→ API validation
→ mobile checks
→ selected smoke tests where justified
```

Requirements:
- frozen lockfile;
- protected `main`;
- mandatory checks block merge;
- reusable scripts contain operational logic rather than large workflow YAML blocks;
- squash merge is the default for normal work.

Do not trigger native builds for ordinary TypeScript changes.

---

## 7. Change-aware CI

Typical mapping:

```text
domain change        → domain + affected application tests
API change           → API + integration tests
web change           → Astro build + critical Playwright
mobile JS change     → mobile checks + optional preview update
native/config change → EAS build path
DB migration         → migration validation
Terraform change     → validate + plan
```

Use Turborepo dependency awareness where suitable. Do not overuse path filters in ways that skip shared-dependency impact.

---

## 8. Testing model

```text
domain invariants
→ application use cases
→ persistence/platform integration
→ API contracts
→ critical UI journeys
→ release/device validation
```

The objective is not maximum test count. Put each risk at the lowest layer that can detect it reliably.

---

## 9. Financial-domain tests

`packages/domain` requires deterministic tests for at least:

```text
plan conservation
fixed commitments not double-counted
envelope totals
movement semantics
transfer exclusion
credit-card settlement
review truth
preparation-state independence
rule priority / first-match
split conservation
duplicate exclusion exactly once
source identity/idempotency
goal allocation ≠ contribution
goal progress
plan/goal history preservation
business-scope exclusion
```

Production financial defects normally gain a regression test here.

Use explicit numeric assertions rather than snapshotting financial calculations.

Property/generative tests may be added when they improve invariants such as split conservation, idempotency or allocation conservation.

---

## 10. Ingestion-adapter tests

Every source adapter needs safe representative fixtures for:

```text
normal records
malformed rows
invalid dates
same-day/same-amount legitimate entries
source-specific sign conventions
duplicate source IDs
re-import
unknown types
missing optional fields
```

Canonical assertion:

```text
source-specific input
→ NormalisedSourceRecord
→ expected FinancialEntry meaning
```

Do not commit real user bank exports.

---

## 11. Future Salt Edge tests

Salt Edge remains dormant until the direct-banking extension is deliberately activated.

When activated, add contract/integration tests for:

```text
connection creation/return
account discovery
initial sync
incremental sync
callback verification/idempotency
pending → posted reconciliation
provider record updates
reconnect
connection removal
rate-limit/retry
provider outage
```

Provider tests must prove convergence on the same normalised ingestion contract as CSV.

Use sandbox/dedicated test credentials. Do not build a second financial test model for Salt Edge.

---

## 12. Application and persistence tests

Application-service tests cover consequential use cases such as:

```text
confirm/change classification
confirm split
confirm duplicate
update plan
create/update goal
goal allocation
rule creation/disablement
review completion
```

Verify:
- authorisation;
- state transition;
- audit event;
- analytics outcome event where defined;
- database rollback on failure;
- idempotency where expected.

Use a real isolated Postgres/Neon environment for tests that depend on constraints, transactions, migrations or provider/runtime behaviour.

Mocks are not sufficient for migration correctness.

---

## 13. Migration tests

Every database migration checks:
- forward application;
- compatibility with expected existing state;
- preserved ownership/provenance;
- preserved review/audit history;
- rollback or forward-fix plan.

Prefer expand/contract:

```text
add compatible schema
→ deploy compatible code
→ backfill/migrate
→ remove obsolete schema later
```

A financial reinterpretation is not a technical migration and requires explicit domain review.

---

## 14. API tests

Fast handler tests cover:
- request validation;
- authentication context;
- response mapping;
- error contracts.

Platform integration tests cover where necessary:
- Hyperdrive/Postgres;
- Workflows;
- R2;
- authentication callbacks;
- AI Gateway;
- analytics writes;
- future connected-provider callbacks.

Authorisation tests must prove one user cannot access another user's resources by guessing IDs.

---

## 15. Kei validation

### Deterministic contract tests

Verify:
- bounded grounding schemas;
- canonical financial values originate from deterministic code;
- structured output validation;
- referenced IDs exist;
- generated output cannot directly mutate financial truth;
- graceful degradation works.

### Behavioural evaluation

Maintain a compact evaluation set for:

```text
Known / Likely / Unknown
mixed/new merchant
Looks Safe explanation
weekly summary
plan explanation
goal progress
progressive goal introduction
incomplete evidence
advice-sensitive goal
```

Detect invented facts, certainty inflation, financial advice, authority violations, implementation-language leakage and excessive verbosity.

Do not run expensive live-model evaluations for every trivial change.

---

## 16. Mobile E2E

Use Maestro for critical journeys:

```text
first launch
monthly plan setup
CSV import
Review Brief
resolve decision
accept group
inspect + confirm Looks Safe
scan all spendings
confirm review
Weekly Summary
create/edit long-term goal
view goal progress
```

Maintain small `smoke`, broader `regression` and `release` suites.

Do not duplicate domain tests in E2E.

When Salt Edge is activated, add connection, return/deep-link, initial sync, reconnect and disconnect journeys.

---

## 17. Device and web validation

Use Firebase Test Lab for targeted Android release-candidate/device coverage, not every PR.

Prioritise:
- supported OS versions;
- representative screen sizes;
- permissions;
- deep links/app links;
- native-module changes;
- background behaviour;
- major OS updates.

Use TestFlight/EAS and Apple channels for iOS release validation.

Use Playwright for critical marketing-site paths:

```text
landing/navigation
pricing CTA
consent
first-party tracking
Meta-eligible conversion relay
forms
store/download CTA
```

Analytics tests verify that private financial/product events never enter Meta payloads.

---

## 18. Product analytics validation

First-party Neon analytics is a product subsystem, not telemetry.

Validate meaningful events such as:

```text
import_started / completed
review_started / completed
plan_updated
goal_capability_shown / dismissed
goal_created / archived
```

Prefer server-authored events for outcomes the backend knows occurred.

Tests verify:
- stable event contract;
- required release/app context;
- no raw financial values by default;
- product events never route to Meta CAPI;
- idempotency where event semantics require it.

Do not track every tap by default.

---

## 19. Operational telemetry

Operational telemetry answers:

```text
Is production healthy?
What failed?
Where?
Since which release?
```

Use:
- Better Stack for cross-product operational visibility;
- Cloudflare Observability for Worker/Workflow diagnostics;
- Apple/Google diagnostics for native gaps.

It is separate from:
- Neon product analytics;
- Neon marketing analytics;
- canonical financial audit history.

Analytics tables are never the primary logging or alerting system.

---

## 20. Required signals

Observe at least:

**API**
```text
latency
5xx rate
authentication failures
rate-limit failures
```

**Ingestion**
```text
runs started/completed/failed
parse/normalisation failures
Workflow retries/duration
idempotency/reconciliation errors
```

**Database**
```text
connection/query failures
migration failures
critical latency/capacity
backup/restore health once configured
```

**Kei**
```text
gateway/provider failures
validation rejection
latency
fallback usage
cost/usage indicators
```

**Mobile**
```text
native crashes
version/build
OS/device clusters
critical journey failures
```

**Marketing**
```text
404s
form failures
tracking endpoint failures
Meta CAPI failures
```

Never log raw CSV content, secrets or unnecessary financial descriptions.

---

## 21. Correlation and release markers

Useful correlation fields:

```text
request_id
user_id when necessary/permitted
ingestion_run_id
review_id
workflow_id
release
app_version
build_number
runtime_version
```

Every production deployment/release records:

```text
surface
environment
commit SHA
version/release
build if applicable
deployment/build/update reference
timestamp
```

Product analytics should also carry non-sensitive release/version context for behavioural regression analysis, but it is not the deployment ledger.

---

## 22. Web/API and infrastructure delivery

Web/API path:

```text
merge to main
→ CI
→ migration gate if needed
→ Wrangler deploy
→ health/smoke verification
→ release marker
```

Terraform changes run:

```text
fmt/check
validate
plan
→ reviewed apply
```

Avoid click-ops where a stable declarative equivalent exists.

Manual provider configuration is documented rather than disguised as IaC.

---

## 23. Mobile delivery classification

### OTA-compatible

Typical:

```text
JS/TS logic
React Native UI
compatible assets/copy
API interaction compatible with runtime
```

Use EAS Update.

### Native/runtime

Typical:

```text
native dependency
Expo SDK/runtime
native plugin
permissions
native app configuration
binary capability
```

Use EAS Build.

Before production OTA:
- CI passes;
- relevant mobile smoke passes;
- API/runtime compatibility is confirmed;
- no native change is required.

OTA is not a mechanism to bypass native/store requirements.

---

## 24. Mobile preview, beta and production

PRs may publish compatible EAS Update previews.

After merge:

```text
JS-only compatible change → beta EAS Update
native/runtime change     → beta EAS Build
```

Production releases are explicit and preferably tag-driven:

```text
v1.4.0
v1.4.1
v1.5.0
```

Production workflow:

```text
release/tag
→ CI
→ release regression
→ Maestro smoke
→ choose OTA vs binary
→ EAS build if required
→ device validation
→ EAS Submit
→ release notes
→ release marker
→ staged rollout
```

---

## 25. Release lifecycle

```text
Alpha
→ Beta
→ Soft launch
→ Managed global rollout
```

**Alpha:** internal TestFlight/Google Play, smoke and representative device validation.

**Beta:** external/closed groups with production-like configuration and limited real-user feedback.

**Soft launch:** deliberately limited public geography/market; do not combine first public release with broad marketing.

**Global rollout:** expand in managed cohorts.

For subsequent native versions:
- iOS uses phased release where appropriate;
- Android uses staged rollout.

Default native release train: once per week when there is a useful native release. OTA-compatible updates may ship independently.

---

## 26. Promotion gates

Before increasing rollout, inspect:

```text
crash health
API errors
authentication
ingestion reliability
review path
financial correctness
billing when enabled
support reports
```

Product analytics may reveal behavioural regressions such as a collapse in `review_completed`, but telemetry/correctness signals remain primary operational gates.

Pause rollout when a material regression appears.

Exact Android percentages are operational configuration. `10% → 50% → 100%` is a useful starting pattern, not a canonical invariant.

---

## 27. Rollback and safe degradation

| Surface | Recovery |
|---|---|
| Web/API | previous healthy deployment or forward fix |
| Database | migration-specific rollback/forward fix |
| Terraform | reviewed corrective apply |
| Mobile OTA | known-good update / hotfix |
| Mobile binary | pause rollout + replacement build |
| Kei | disable/fallback without blocking finance workflows |
| Meta CAPI | disable forwarding without blocking product |
| Future Salt Edge | pause sync without damaging canonical history |

Rollback/pause triggers include:

```text
deployment failure
critical crash spike
authentication outage
API 5xx spike
ingestion corruption/failure
review path broken
financial calculation regression
data-loss/security risk
billing failure spike when enabled
```

Financial correctness takes priority over feature availability.

---

## 28. Data incidents

Suspected corruption, data loss or cross-user exposure is an incident regardless of affected-user count.

First actions:
1. stop the damaging write/access path;
2. preserve evidence;
3. identify affected data/time range;
4. prevent further damage/exposure;
5. establish recovery/correction strategy;
6. communicate according to incident/legal requirements.

Do not run speculative repair scripts directly against production.

---

## 29. Provider operations

Every external provider has an operations entry containing:

```text
Owner
Automated setup
Manual setup
Secrets
Verification
Renewal/rotation
Recovery
Failure mode
```

Relevant providers may include Apple, Google, Expo/EAS, Cloudflare, Neon, Better Stack, Meta, authentication, billing, LLM provider and later Salt Edge.

Provider setup changes update operational documentation in the same change.

---

## 30. Future Salt Edge operations

Before activating Salt Edge, define:

```text
sandbox/test credentials
production ownership
callback verification
credential rotation
reconnect/support flow
provider outage response
rate limits/retries
sync-health telemetry
provider-metadata retention
```

Observe:

```text
connections/reconnect-required
sync success/failure
callback verification failure
records reconciled
provider latency
rate-limit/retry
pending→posted reconciliation failure
```

Salt Edge failure must not erase trusted history.

Provider synchronisation can be disabled while CSV ingestion and existing canonical data remain operational.

---

## 31. Alerts

Alert on actionable production conditions:

```text
production deployment failed
migration failed
API 5xx spike
authentication failure spike
ingestion/Workflow failure spike
critical mobile crash spike
mobile submission failed
rollout halted
sustained Meta CAPI failure
sustained Kei failure
```

Later:

```text
Salt Edge callback verification failure
sustained sync failure
reconnect spike
provider outage/rate-limit exhaustion
```

Do not page for one recoverable error already handled by retry.

Every alert should identify affected surface/environment, severity, current release, start time, useful error/metric and runbook/recovery path.

---

## 32. Severity, support and incidents

| Severity | Meaning |
|---|---|
| P0 | broadly unusable or severe data/security risk |
| P1 | major journey broken or material correctness issue |
| P2 | normal defect with limited impact/workaround |
| P3 | minor defect |
| P4 | improvement/request |

P0/P1 create an incident.

Incident triggers include outage, broken authentication/billing, major crash spike, financial-data risk, cross-user exposure, bad release and failed rollout.

Incident flow:

```text
open incident
→ identify surface/environment
→ inspect latest release
→ pause/rollback if appropriate
→ assign owner
→ communicate
→ minimal fix
→ verify recovery
```

Default active P0/P1 update cadence: 30 minutes unless the incident lead chooses otherwise.

P0/P1 postmortem:

```text
Impact
Timeline
Root cause
Resolution
Detection
Prevention
```

Prevention should target the smallest missing control rather than trigger unrelated architecture work.

Support reports should capture platform, app version/build, device/OS, approximate time and safe reproduction details. Never request raw financial exports through insecure support channels.

---

## 33. Backup and recovery

Before public production, define canonical Neon recovery objectives and document:
- backup mechanism;
- retention;
- restore target;
- procedure;
- owner;
- restore-test cadence.

Restore tests verify user ownership, Financial Entries, reviewed classifications, plans, goals and audit relationships.

R2 recovery is separate.

Analytics recovery may have weaker objectives than canonical financial state.

Recovery priority:

```text
identity/access
→ canonical financial database
→ API
→ ingestion/review
→ clients
→ Kei
→ analytics
→ marketing conversion forwarding
```

A backup without a tested restore path is insufficient.

---

## 34. Mobile OS and dependency maintenance

Monthly:
- review Expo SDK/React Native compatibility;
- check iOS/Android warnings;
- validate representative current OS versions.

Before major OS releases, verify authentication, deep links/app links, permissions, background behaviour, billing if enabled and native diagnostics.

Prioritise:
- security updates;
- Expo/React Native compatibility;
- Cloudflare/runtime support;
- database/runtime support;
- provider API deprecations.

Do not auto-merge high-risk major upgrades without journey validation.

---

## 35. Cost controls

Prefer:

```text
Linux CI before native build
targeted E2E before full device matrix
Worker before Workflow
Workflow before Queue
existing telemetry before another vendor
Neon analytics before another analytics warehouse
```

Monitor potentially nonlinear cost:
- EAS builds;
- Firebase Test Lab;
- LLM calls;
- Workflows;
- Neon storage/compute;
- analytics volume;
- external-provider API usage.

Cost optimisation must not weaken financial correctness controls.

---

## 36. Test data and CI artefacts

Use synthetic/safe fixtures.

Do not:
- commit real bank exports;
- copy production financial data into fixtures;
- send production financial data to LLM test providers;
- expose production secrets in CI artefacts.

Safe CI artefacts may include test reports, synthetic screenshots, coverage reports, Terraform plans and release metadata.

Disposable artefacts should use bounded retention.

---

## 37. Spec and operational documentation

Lightweight checks may verify canonical spec filenames/version footers and other machine-checkable contracts.

Do not build an elaborate spec-governance platform.

Maintain concise runbooks for:

```text
development
environments
provider setup
release
rollback
support
incidents
backup/restore
mobile OS compatibility
```

Runbooks answer operational questions; they do not duplicate `05` architecture.

---

## 38. Public-readiness gate

Before soft launch, verify:

```text
financial invariant tests
critical Maestro journeys
representative device validation
production telemetry
actionable alerts
release markers
tested rollback path
database backup
tested restore procedure to agreed level
support/incident path
privacy/retention configuration
Meta boundary cannot receive private financial/product events
```

Future Salt Edge readiness is not required for the CSV-based launch.

---

## 39. Promotion beyond soft launch

Review:

```text
crash health
API/Workflow reliability
import success
review completion
financial-correctness incidents
support themes
billing health when enabled
product analytics quality
```

Product/marketing growth decisions belong to `01`; this gate is engineering/operational confidence.

---

## 40. Acceptance criteria

Engineering delivery and operations are correct when:

- every production change is Git-traceable;
- mandatory CI blocks known-invalid changes;
- financial invariants are tested below the UI;
- ingestion adapters are independently testable;
- application/persistence tests verify audit and transaction boundaries;
- migrations are exercised against real Postgres semantics;
- API authorisation is tested;
- critical mobile journeys run in Maestro;
- release candidates receive targeted device validation;
- normal JS changes do not require native builds;
- OTA and binary paths are explicit;
- releases progress through alpha, beta, soft launch and managed rollout;
- native rollout can be paused;
- practical rollback/safe-degradation paths exist;
- financial correctness and data exposure trigger incident handling;
- Better Stack/Cloudflare provide operational visibility;
- Neon product analytics remains separate from telemetry/audit history;
- analytics failure cannot block finance workflows;
- product events never flow to Meta CAPI;
- releases correlate to commit/version/build;
- provider credentials/setup have ownership and recovery;
- backup/restore is explicit and tested;
- Salt Edge can later add provider-specific tests/alerts without changing the core financial test model;
- a Salt Edge outage can be isolated without damaging canonical history;
- CI/device/LLM/provider costs remain intentional.

Core rule:

> Validate financial meaning at the cheapest deterministic layer, deliver every change through a traceable release path, observe production with operational telemetry, and make rollback or safe degradation part of the design.

---

*Kakeibo — Engineering Delivery and Operations Spec v1.0 · 1 September 2026*
