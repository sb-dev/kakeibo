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
- Added `kakeibo import <file> --account <name>` and `--remap` (T2): saved per-account CSV mappings, comma/semicolon delimiters, `YYYY-MM-DD` and `DD/MM/YYYY` dates, signed or debit/credit amounts with an explicit sign convention, GBP checks, whole-file validation, a preview and one confirmation.
- Added source reconciliation: source-ID reimports, exact-file reimports, counted occurrences for complete overlapping exports, declared coverage, flagged missing and changed rows, explicit bulk/per-row decisions and reversible reuse. New entries start unreviewed.
- Fixed subcommand usage errors so they exit with code 2 and state that no data changed.
