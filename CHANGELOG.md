# Changelog

## Unreleased

### Project scaffold

- Added seven canonical Kakeibo specifications.
- Added Docs, Academy and Blog scaffolding.
- Added contribution and security-policy placeholders.
- Added future application, package and infrastructure directories.
- Adopted Apache License 2.0.
- Added trademark-policy placeholder.

### CLI MVP

- Added the pnpm workspace with `packages/domain` and `apps/cli` (T1 of the CLI MVP tasks).
- Added `kakeibo init`, `kakeibo plan` and `kakeibo plan --show` with a versioned local JSON store, atomic saves, `store.json.bak` and single-writer locking.
- Added a GitHub Actions job for type checking, tests and compilation.
