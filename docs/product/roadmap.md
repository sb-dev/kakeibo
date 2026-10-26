# Kakeibo implementation roadmap

This roadmap connects Kakeibo's product requirements to the work that proves Pactwright and Production Skills. It proposes delivery placement; the [canonical specifications](../specs/README.md) continue to own behaviour.

## Current position

**Now: prepare the checkpoint 1 financial-domain delivery.** The repository contains the seven canonical specifications and project scaffolding. It has no executable financial implementation, package manifest or application CI. No Kakeibo checkpoint acceptance is recorded here.

**Next:** checkpoints 2–5 and the product journeys built on their foundations. **Later:** checkpoints 6–9, public-launch acceptance and connected-banking Graduation.

## Authority and dependencies

| Source | Responsibility |
|---|---|
| [Kakeibo specifications](../specs/README.md) | Product behaviour, financial truth, Kei authority, mobile design, architecture, operations and public-project rules. |
| [Pactwright runbooks](https://github.com/sb-dev/pactwright/tree/main/docs/checkpoints) | Capability delivery order and executable acceptance work. Checkpoints 1–9 run in order; Graduation follows acceptance of the hardened system. |
| [Kakeibo acceptance profile][profile] | Cross-specification checks that supplement each numbered runbook. It does not replace Kakeibo's specifications. |
| [Production Skills integration contract][skills-integration] | Specialist workflow composition, revision identity and evaluation ownership. Kakeibo owns its selections, integration plan and product-specific conclusions. |

Each checkpoint first proves the Pactwright capability in its owning project, then installs the exact accepted release in Kakeibo and proves a real Kakeibo outcome. A package release alone does not complete Kakeibo acceptance.

## Pactwright acceptance progression

Follow each linked runbook together with the cited acceptance-profile section for the full requirements and failure cases. Owner numbers refer to the [Kakeibo specification index](../specs/README.md).

| Stage | Kakeibo delivery | Exit evidence | Owners / profile |
|---|---|---|---|
| **[1 — Financial foundation][cp1]** | Minimal pnpm consumer root and `packages/domain`: entries, planning, goals, transfers, card settlements, business scope, review truth, rules, splits, source identity and history. Verify the licence, private security route and safe fixtures. | Numeric invariant tests and accepted Intent → Evidence delivery. Domain code has no API, database, UI or provider dependency. | 02, 05, 06, 07; profile §5 |
| **[2 — CSV ingestion][cp2]** | API, application services, persistence and infrastructure for CSV ingestion. Raw uploads go to R2; normalised entries and provenance go to Neon. | Adapter/API/persistence tests prove re-import idempotency, resumable imports, explicit invalid rows and duplicate preparation. Preparation never confirms entries. | 01, 02, 05, 06, 07; profile §6 |
| **[3 — Knowledge and review preparation][cp3]** | Ingest the index and all seven specs as separate Sources. Deliver the deterministic weekly-review preparation read model and Hono API. | Traceable ownership and bounded context. Tests distinguish needs decision, worth checking and looks safe from reviewed truth. | All seven for onboarding; 01, 02, 05, 06 for preparation; profile §7 |
| **[4 — Cross-specification review][cp4]** | Review the seven-owner system and deliver one supported correction through Project Intelligence and normal Delivery. | Finding → Source → accepted meaning → explicit Intent → Evidence → current-state review. A finding does not change product truth by itself. | 01–07; profile §8 |
| **[5 — Versioned Kei and specialist production][cp5]** | Implement at least one bounded Kei task, initial task contracts, immutable release identity and offline evaluations. Resolve specialist skills through the selected Agent Pack. Produce a grounded public asset after accepting the implementation. | Exact dependency revisions; deterministic tests, benchmarks and adversarial cases; immutable behaviour bundle and separate model route; human approval of the exact public output. | 03, 05, 06, 07; 01/04 as required; profile §9 |
| **[6 — Operational learning][cp6]** | Deploy accepted work. Compare exact active/candidate Kei exposures through an isolated shadow experiment, govern the outcome and demonstrate rollback. | Predeclared metrics and guardrails; candidate cannot reach users, change financial state or block the active response; bounded evidence reaches PI; no automatic promotion. | 02, 03, 05, 06, 07; profile §10 |
| **[7 — Publication feedback][cp7]** | Observe a real Kakeibo publication through bounded collection and analysis. Route justified findings through PI. | Exact publication provenance and privacy boundaries. Report no-finding or insufficient-evidence outcomes accurately; a second live revision is not mandatory. | 01, 03, 05, 06, 07; profile §11 |
| **[8 — GitHub operating views][cp8]** | Project existing delivery, deployment, experiment and learning records into the shared GitHub operating surface. | Live record-to-view traceability, preserved histories and ownership-safe reconciliation. No private financial payload enters the projections. | 06, 07 and applicable product owners; profile §12 |
| **[9 — Hardening and public readiness][cp9]** | Turn a confirmed or explicitly simulated Kei defect into a permanent regression case and a new release. Complete recovery, independent deployment and contributor/public-documentation acceptance. | Reproduction, regression assertion, candidate release, offline and operational gates, seven-owner review, deployment proof and supported-family acceptance. | 01–07; profile §13 |
| **[Graduation — Connected banking][graduation]** | After checkpoint 9 and an accepted provider integration specification, add Salt Edge Account Information behind the existing ingestion boundary. | CSV/bank source equivalence through a representative review; provider lifecycle, callback, reconciliation and outage tests; preserved history and CSV operation. | 01–07; profile §14 |

## Product deliveries alongside the checkpoints

The checkpoints prove selected capabilities. These additional deliveries cover product requirements that need explicit placement. The placement below is proposed sequencing, not an amendment to the owning specifications.

| Product outcome | Dependency and placement | Acceptance source |
|---|---|---|
| Mobile weekly review: Decisions, Group Checks, Looks Safe, full-week scan and confirmation | Build on checkpoint 3's preparation API. Complete before public-launch acceptance; an API alone is not the complete review experience. | [Product §18](../specs/01-product-and-ux-spec.md#18-acceptance-criteria), [Mobile §29](../specs/04-mobile-design-system-spec.md#29-acceptance-criteria) |
| Monthly plans, optional user-selected goals, history, insights and reflection | Deliver bounded slices over the domain/application foundation. Keep goal allocation distinct from contribution and preserve historical interpretation. | [Product §§5–10](../specs/01-product-and-ux-spec.md#5-monthly-planning), [Financial §§5–12](../specs/02-financial-domain-model-spec.md#5-monthly-kakeibo-model), [Mobile §§13–20](../specs/04-mobile-design-system-spec.md#13-plan) |
| Authentication, subscription billing, model routing, retention and recovery decisions | Resolve each choice before its dependent implementation or launch gate. Keep choices explicit until accepted. | [Architecture §31](../specs/05-system-architecture-and-data-spec.md#31-open-decisions), [Product §14](../specs/01-product-and-ux-spec.md#14-commercial-model) |
| Accessible device journeys, CI, deployment, telemetry, backup and restore | Develop with the relevant executable slices. Establish the evaluation environment before checkpoint 6. Complete engineering gates before soft launch. | [Engineering §§16–39](../specs/06-engineering-delivery-and-operations-spec.md#16-mobile-e2e) |
| Public trust and deployment documentation | Publish the smallest useful documentation with each accepted capability. Complete independent-deployment and launch-policy checks by public readiness. | [Open Source §§12–18](../specs/07-open-source-project-organisation-spec.md#12-readme), [§53](../specs/07-open-source-project-organisation-spec.md#53-open-decisions-before-public-launch) |

CSV-based launch does not depend on Salt Edge. Soft launch must satisfy [Engineering §38](../specs/06-engineering-delivery-and-operations-spec.md#38-public-readiness-gate); wider rollout follows §39. Checkpoint acceptance and product-launch acceptance remain separate decisions.

Open-ended Ask Kei, persistent agent memory, autonomous financial tools and payment initiation are not added by this roadmap.

## Production Skills proving work

These bootstrap plans explicitly use Kakeibo as a stress-test project. They define planned proving work, not completed runs. Product-specific decisions and results belong in Kakeibo; reusable technique and benchmark improvements return to the owning skills repository.

| Programme | Kakeibo outcome and failure cases | Proposed placement |
|---|---|---|
| [Legal Skills][legal] | Compare privacy terms with data flows, subscription terms with cancellation/refunds, AI disclosures with Kei behaviour, and licence/brand claims with evidence. Exercise stale authority, missing obligations and contradictions. | Begin with design decisions. Complete relevant checks before public claims and launch. |
| [Business Building Skills][business] | Evaluate pricing, trials/guarantees, retention, acquisition and support economics. Reject hidden renewal, unsupported financial-benefit claims and growth plans that ignore churn or delivery costs. | Inform commercial implementation. Use operational evidence before scaling acquisition. |
| [Advertising Production Skills][advertising] | Produce campaign variants grounded in actual product behaviour and approved terms. Test claim/proof, privacy/targeting and downstream activation/retention rather than installs alone. | Connect accepted public assets at checkpoint 5 with feedback at checkpoints 6–7. |

Software Engineering and UI/UX are proposed skill selections for their corresponding product deliveries. Select only the families and Extension Packs needed for an outcome. Do not block the financial foundation on every family's maturity.

Formal external resolution starts at checkpoint 5 through **Agent Pack → Production Skills** bindings. Record exact revisions and selected Extension Packs. Keep three evidence layers separate:

- the skills repository benchmarks specialist quality;
- Pactwright evaluates orchestration and responsibility fulfilment;
- Kakeibo tests the assembled product against its specifications.

The [evaluation contract][skills-evaluation] defines these boundaries. Central registry/conformance checks do not prove a Kakeibo workflow or specialist quality.

## Upstream execution dependencies

The source review found these runbook mismatches on 26 October 2026. Resolve them in Pactwright before the affected transition; this roadmap does not select replacement package versions or commands.

- Checkpoint 1 specifies corrective release `0.0.2`, while checkpoint 2 assumes a `0.0.1 → 0.0.2` upgrade.
- Checkpoint 9's upgrade block names `review-creative` and `creative`, while preceding runbooks use `graph-review` and `assets-publication`.
- The acceptance profile refers to Open-Source spec v3, while Kakeibo's current spec 07 header is version 2. Use the owning Kakeibo document for behaviour and reconcile the upstream reference.

Reviewed sources: Kakeibo [`7544323`](https://github.com/sb-dev/kakeibo/tree/75443233c474a2a4072348078c22d72d15573645), Pactwright [`c38fa95`](https://github.com/sb-dev/pactwright/tree/c38fa95afe66fb68dcc3a297cebc04587365f23d), Production Skills [`ae4c0f1`](https://github.com/sb-dev/production-skills/tree/ae4c0f1bd63107f9dc33e192bbf2a02a9cab75cf).

## Progress and maintenance

Before Project Intelligence is available, link accepted deliveries and verification evidence when updating the public progress summary. Do not infer completion from a specification, package publication or directory.

From checkpoint 3, [Project Intelligence's derived Intent roadmap][pi-roadmap] owns the outstanding-work view. It derives candidates from accepted knowledge and Delivery Evidence; candidates do not automatically become Intents. This document remains the acceptance mapping and public summary, not a second task graph or priority engine. Do not hand-maintain generated reports or graph state.

For each accepted milestone, retain the owning requirements, exact execution/dependency identities, verification results and Delivery Evidence. Keep private financial data outside public evidence. Update only the public surfaces affected by the delivered capability.

[profile]: https://github.com/sb-dev/pactwright/blob/main/docs/checkpoints/00-kakeibo-acceptance-profile.md
[cp1]: https://github.com/sb-dev/pactwright/blob/main/docs/checkpoints/01-self-hosted-delivery.md
[cp2]: https://github.com/sb-dev/pactwright/blob/main/docs/checkpoints/02-remote-delivery.md
[cp3]: https://github.com/sb-dev/pactwright/blob/main/docs/checkpoints/03-project-intelligence.md
[cp4]: https://github.com/sb-dev/pactwright/blob/main/docs/checkpoints/04-graph-review.md
[cp5]: https://github.com/sb-dev/pactwright/blob/main/docs/checkpoints/05-production-skills-and-assets-publication.md
[cp6]: https://github.com/sb-dev/pactwright/blob/main/docs/checkpoints/06-operations.md
[cp7]: https://github.com/sb-dev/pactwright/blob/main/docs/checkpoints/07-publication-feedback.md
[cp8]: https://github.com/sb-dev/pactwright/blob/main/docs/checkpoints/08-github-project-surface.md
[cp9]: https://github.com/sb-dev/pactwright/blob/main/docs/checkpoints/09-hardened-closed-loop.md
[graduation]: https://github.com/sb-dev/pactwright/blob/main/docs/checkpoints/10-graduation-connected-banking.md
[skills-integration]: https://github.com/sb-dev/production-skills/blob/main/docs/specs/04-cross-domain-orchestration-and-integration.md
[skills-evaluation]: https://github.com/sb-dev/production-skills/blob/main/docs/specs/03-production-skills-evaluation-and-extension-packs.md
[legal]: https://github.com/sb-dev/production-skills/blob/main/docs/research-logs/2026-09-08-legal-skills-new-project-bootstrap-process.md#21-stage-15--design-kakeibo-and-worldstack-canonical-stress-tests
[business]: https://github.com/sb-dev/production-skills/blob/main/docs/research-logs/2026-09-08-business-building-skills-new-project-bootstrap-process.md#23-stage-16--design-canonical-business-stress-tests
[advertising]: https://github.com/sb-dev/production-skills/blob/main/docs/research-logs/2026-09-08-advertising-production-skills-new-project-bootstrap-process.md#23-stage-17--design-canonical-advertising-stress-tests
[pi-roadmap]: https://github.com/sb-dev/pactwright/blob/main/docs/specs/03-project-intelligence.md#21-intent-roadmap
