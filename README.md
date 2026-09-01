# Kakeibo

Kakeibo is an open-source personal-finance project built around a calm Kakeibo-inspired weekly review.

```text
Financial activity
→ prepare what needs attention
→ user confirms what actually happened
→ monthly Kakeibo planning
→ optional long-term goals
→ bounded Kei explanations
```

## Status

This repository is currently at the **pre-implementation scaffold** stage.

It contains the canonical specifications and public-project structure. Application code, infrastructure implementation, CI workflows and provider configuration have not been implemented yet.

## Canonical specifications

The seven canonical specs live in [`docs/specs/`](docs/specs/). Their authority and conflict rules are defined in [`docs/specs/README.md`](docs/specs/README.md).

## Public surfaces

```text
Website  → consumer acquisition and trust
README   → project overview and first technical understanding
Docs     → product and technical reference
Academy  → Kakeibo practice and Kakeibo proficiency
Blog     → discovery and current thinking
Specs    → canonical behaviour
```

Kakeibo does not maintain a separate Community Edition or self-hosted architecture.

```text
public source
+
operator-owned supported provider accounts
+
operator-owned credentials
+
documented configuration
=
Kakeibo deployment
```

The official Kakeibo service is one supported production deployment of the same public codebase.

## Repository map

```text
apps/       future mobile, web and API applications
packages/   future shared/domain packages
docs/       specifications and documentation
academy/    Markdown-first learning material
blog/       Markdown-first editorial material
fixtures/   synthetic financial test data
infra/      future declarative infrastructure
.github/    contribution and future automation scaffolding
```

## Licence

Kakeibo is licensed under the [Apache License 2.0](LICENSE).

The software licence does not grant rights to the Kakeibo name, logo or other
project branding. See [TRADEMARKS.md](TRADEMARKS.md).

## Security

See [`SECURITY.md`](SECURITY.md). A private reporting route must be configured before public launch.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).
