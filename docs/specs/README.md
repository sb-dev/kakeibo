# Kakeibo Canonical Specifications

These seven specifications are the source of truth for Kakeibo.

| # | Specification | Version | Owns |
|---|---|---:|---|
| 01 | [Product and UX](01-product-and-ux-spec.md) | 1.1 | product scope, journeys, IA, progressive disclosure and commercial/product boundaries |
| 02 | [Financial Domain Model](02-financial-domain-model-spec.md) | 1.1 | financial concepts, calculations, classifications, goals, review truth and invariants |
| 03 | [Kei Assistant](03-kei-assistant-spec.md) | 1.0 | assistant identity, evidence, language, safety and user authority |
| 04 | [Mobile Design System](04-mobile-design-system-spec.md) | 1.0 | mobile presentation, interactions, components and accessibility |
| 05 | [System Architecture and Data](05-system-architecture-and-data-spec.md) | 1.2 | runtime/data boundaries, ingestion, persistence, analytics, security and provider architecture |
| 06 | [Engineering Delivery and Operations](06-engineering-delivery-and-operations-spec.md) | 1.0 | testing, CI/CD, releases, rollout, observability, incidents and recovery |
| 07 | [Open-Source Project Organisation](07-open-source-project-organisation-spec.md) | 1.2 | repository organisation, Docs/Academy/Blog, contribution, licensing and trademark boundaries |

## Authority rule

A spec owns the concepts assigned to it. Other specs may define only integration or presentation concerns.

```text
01 → goals are progressively disclosed
02 → defines what a financial goal means
03 → defines how Kei discusses goals
04 → defines how goals appear on mobile
05 → defines how goals are persisted and served
06 → defines how goal behaviour is tested and released
07 → defines how goal behaviour is documented publicly
```

## Conflict resolution

1. Identify the specification that owns the disputed concept.
2. Preserve that specification's semantics.
3. Update dependent specifications if their integration text has drifted.
4. Do not resolve semantic conflicts only in code, documentation or marketing.

## Research

Research belongs in [`../research-logs/`](../research-logs/).

```text
research → may explain why
canonical spec → defines accepted behaviour
```
