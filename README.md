# Kakeibo

Kakeibo is open-source personal-finance software designed around a calm weekly review, monthly Kakeibo planning and optional user-selected goals. It prepares imported financial activity for review, keeps consequential decisions with the user and uses Kei, its AI assistant, for explanations and bounded suggestions.

The weekly flow is **import → prepare → inspect and confirm → summarise and reflect**. Monthly planning separates fixed commitments, goal allocations and the Needs, Wants, Culture and Unexpected envelopes.

## Design

| Decision | Owning specification |
|---|---|
| Application code owns financial calculations. Transfers, card settlements and goal allocations must not double-count money. | [Financial Domain Model](docs/specs/02-financial-domain-model-spec.md) |
| Preparation, rules and AI suggestions do not make an entry reviewed. The user confirms financial interpretations. | [Product and UX](docs/specs/01-product-and-ux-spec.md), [Financial Domain Model](docs/specs/02-financial-domain-model-spec.md) |
| CSV and connected banking feed the same `IngestionAdapter → NormalisedSourceRecord → FinancialEntry` boundary. Provider details stay outside the financial domain. | [System Architecture and Data](docs/specs/05-system-architecture-and-data-spec.md#9-financial-sources-accounts-and-adapters) |
| Application-selected Kei tasks use bounded grounding and validated outputs. AI provides explanations and bounded suggestions; key decisions remain with the user. | [Kei Assistant](docs/specs/03-kei-assistant-spec.md) |
| Kei policy, persona, task contracts and output schemas form immutable releases. Tests, benchmarks, model comparisons and rollback govern changes. Model routes remain separate from behaviour releases. | [Kei engineering lifecycle](docs/specs/06-engineering-delivery-and-operations-spec.md#15-kei-engineering-lifecycle) |
| Mobile accesses private state through the API. Financial state, audit history, first-party analytics and operational telemetry have separate responsibilities. Product events never go to Meta. | [System Architecture and Data](docs/specs/05-system-architecture-and-data-spec.md) |
| The official service and independent deployments use the same public codebase and supported architecture, with operator-owned provider accounts and credentials. | [Open-Source Project Organisation](docs/specs/07-open-source-project-organisation-spec.md#5-one-architecture) |

Open source makes the financial rules, assistant behaviour and evaluation definitions inspectable. Production credentials and personal financial data remain private. Public tests and examples use synthetic data.

The [seven-specification index](docs/specs/README.md) records versions, ownership and conflict rules. The [Mobile Design System](docs/specs/04-mobile-design-system-spec.md) defines how these behaviours appear in the app.

## Roadmap

Kakeibo is both a product and Pactwright's persistent external acceptance project. Its product work also exercises specialist Production Skills.

| Horizon | Outcome |
|---|---|
| **Now** | Deliver the deterministic financial foundation through Pactwright checkpoint 1. The current repository contains the canonical specifications and project scaffolding. |
| **Next** | Deliver CSV ingestion, review preparation, cross-specification review and the versioned Kei foundation through checkpoints 2–5. Build the mobile review and planning journeys on these foundations. |
| **Later** | Prove operational learning, publication feedback, GitHub views and public readiness through checkpoints 6–9. Add connected banking at Graduation. |

The [implementation roadmap](docs/product/roadmap.md) maps product outcomes to acceptance criteria, delivery dependencies and Production Skills proving work. It separates product launch requirements from the later connected-banking extension.

## Stack

The architecture specifies the following stack. The roadmap records delivery progress.

| Responsibility | Technologies |
|---|---|
| Language and workspace | TypeScript, pnpm, Turborepo |
| Mobile | React Native, Expo, Expo Router, React Native Reusables, NativeWind |
| Public website | Astro |
| API and ingestion | Hono, Cloudflare Workers, Cloudflare Workflows |
| Data and uploads | Neon Postgres, Cloudflare Hyperdrive, Cloudflare R2 |
| AI boundary | Cloudflare AI Gateway, versioned Kei bundles and model routes |
| Infrastructure and delivery | Terraform, Wrangler, GitHub Actions, Expo Application Services |
| Verification and operations | Vitest, Playwright, Maestro, Promptfoo, Better Stack, Cloudflare Observability |

See [Architecture §3](docs/specs/05-system-architecture-and-data-spec.md#3-adopted-platform) and [Engineering §3](docs/specs/06-engineering-delivery-and-operations-spec.md#3-tooling) for the full platform and tooling boundaries.

## Getting started

Start with the [product specification](docs/specs/01-product-and-ux-spec.md), [specification index](docs/specs/README.md) and [roadmap](docs/product/roadmap.md). The first executable slice is the CLI MVP (`apps/cli` and `packages/domain`). It needs Node.js 22 LTS and pnpm 10.

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
node apps/cli/bin/kakeibo.js --help
```

`kakeibo init` creates a local store and `kakeibo plan --month 2026-10` plans a month. Import, review and reporting commands follow the [CLI MVP tasks](docs/product/cli-mvp-tasks.md). See [`apps/cli/README.md`](apps/cli/README.md) for usage, data files and backup recovery.

[Deployment documentation](docs/deployment/README.md) will describe the supported managed-provider architecture. Core tests must use safe fixtures and must not require production banking, advertising, app-store or LLM credentials.

## Repository and public documentation

| Area | Responsibility |
|---|---|
| `apps/` | CLI (`apps/cli`), and future mobile, public web and API applications |
| `packages/` | Financial domain, application services and shared contracts |
| `infra/` | Declarative infrastructure and environment configuration |
| [Docs](docs/README.md) | Product and technical reference, specifications and roadmap |
| [Academy](academy/README.md) | Kakeibo practice and product proficiency |
| [Blog](blog/README.md) | Discovery and current thinking |
| [Synthetic fixtures](fixtures/synthetic-financial-data/README.md) | Safe financial examples for tests and documentation |

## Licence

Kakeibo is licensed under the [Apache License 2.0](LICENSE).

The software licence does not grant rights to the Kakeibo name, logo or other
project branding. See [TRADEMARKS.md](TRADEMARKS.md).

## Security

See [`SECURITY.md`](SECURITY.md). A private reporting route must be configured before public launch.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

