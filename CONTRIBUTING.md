# Contributing to Kakeibo

Kakeibo is implementing its first executable slice, the CLI MVP in `apps/cli` and `packages/domain`. Other applications and packages remain scaffolding. See [`docs/product/cli-mvp-tasks.md`](docs/product/cli-mvp-tasks.md).

Before changing behaviour, read [`docs/specs/README.md`](docs/specs/README.md). A contribution must not silently redefine behaviour owned by a canonical spec.

```text
Level 1  local improvement
Level 2  behavioural implementation
Level 3  canonical change
```

Level 3 changes require an update or explicit review of the owning canonical spec.

Strong future contribution areas include bugs, tests, accessibility, documentation, financial-source adapters, parsing/normalisation, localisation, performance, security and developer tooling.

Never commit real personal bank exports or production financial data. Use synthetic fixtures only.

Meaningful pull requests should identify the problem, scope, behaviour, validation, affected canonical spec and material privacy/security/analytics/release impact.
