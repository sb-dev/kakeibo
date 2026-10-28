# Kakeibo CLI

Terminal interface for the Kakeibo money-review workflow: plan the month, import CSVs, review spending and reflect. Data stays on your device in one local JSON store.

**Status:** task T1 of the [CLI MVP tasks](../../docs/product/cli-mvp-tasks.md) is implemented: `init`, `plan` and `plan --show`. Import, review, summary, spending and edit follow in T2–T4. Requirements live in the [CLI MVP PRD](../../docs/product/cli-mvp-prd.md).

## Requirements

- Node.js 22 LTS (`>=22.12.0 <23`).
- pnpm 10 (`corepack enable` picks up the pinned version from `package.json`).

## Run from source

```sh
pnpm install
pnpm build
node apps/cli/bin/kakeibo.js --help
```

To call it as `kakeibo`, link the package once after building:

```sh
pnpm --filter @kakeibo/cli link --global
kakeibo --help
```

## Commands

| Command | Result |
|---|---|
| `kakeibo init` | Create the local store and show its location. Never replaces an existing store. |
| `kakeibo plan --month 2026-10` | Set or revise the month's plan interactively. Needs a terminal. |
| `kakeibo plan --month 2026-10 --show` | Display the saved plan without prompts. Works when output is redirected. |

`--month` defaults to the current local month. Every command accepts `--help`. The global `--data-dir <dir>` selects another store directory; the default is `~/.kakeibo`.

### Planning a month

`plan` asks for planned income, fixed commitments, the Savings allocation for the month, limits for **Needs, Wants, Culture and Unexpected**, and an optional intention. It shows the resulting plan and asks for confirmation before saving. Amounts are pounds with at most two decimal places; negative amounts, more than two decimal places and values too large to store exactly are refused and asked again.

The plan is saved only when both equations hold:

```text
flexible budget = planned income - fixed commitments - savings allocation
Needs + Wants + Culture + Unexpected = flexible budget
```

Each confirmed plan is stored as a new revision. Earlier revisions are kept, and a history record explains each change. The Savings allocation is stored against the single plan-funded Savings goal; it records intent, not money already saved.

## Data directory

| File | Purpose |
|---|---|
| `store.json` | The store. Plain-text JSON, GBP only, schema version 1. |
| `store.json.bak` | The previous valid store, replaced on every successful save. |
| `store.lock` | Exists only while a kakeibo process is writing. |
| `store.json.tmp-*` | A save in progress. Removed automatically on the next save. |

The directory is created with mode `0700` and files with `0600` where the platform supports it (not on Windows). The store is not encrypted: anyone who can read the file can read your financial data. Keep the data directory on a local filesystem; the lock relies on exclusive file creation, which network filesystems may not honour.

Every save validates the current store, writes the new store to a temporary file in the same directory, copies the current store to `store.json.bak`, then renames the temporary file over `store.json`. A crash at any point leaves either the old or the new store in place, never a partial file.

## Error messages and exit codes

Every error says what went wrong and ends with **No data was changed.** or **Data was saved.**

| Exit code | Meaning |
|---|---|
| 0 | Success, including "plan not saved" after you decline the confirmation. |
| 1 | The command could not complete (missing store, store exists, lock held, corrupt store, plan does not balance, no terminal). |
| 2 | Usage error (unknown option, invalid `--month`). |
| 130 | Cancelled with Ctrl+C. |

## Stale lock

If kakeibo is killed while saving, `store.lock` may remain. The next write fails with:

```text
Another kakeibo process (pid 4242 on laptop since 2026-10-28T10:01:02.000Z) holds /home/you/.kakeibo/store.lock. If no kakeibo process is running, delete that file and retry. No data was changed.
```

The CLI never removes a lock by itself. Check that no kakeibo process is running (`ps -p 4242` on Linux or macOS), then delete `store.lock` and retry. Reading commands such as `plan --show` do not take the lock.

## Backup recovery

If `store.json` is corrupt or unsupported, every command fails and names the problem. The CLI never replaces a corrupt store with an empty one. To restore the previous valid store:

```sh
cd ~/.kakeibo            # or your --data-dir
mv store.json store.json.corrupt
cp store.json.bak store.json
kakeibo plan --month 2026-10 --show
```

`store.json.bak` holds the state before the most recent successful save, so the last change may need to be repeated. Keep `store.json.corrupt` until you are sure nothing is missing. A store written by a newer kakeibo (higher `schema_version`) is reported as unsupported; upgrade the CLI instead of editing the file.

## Development

```sh
pnpm typecheck   # tsc for both packages
pnpm test        # vitest: domain unit tests and the CLI storage integration suite
pnpm build       # compiles packages/domain, then apps/cli
```

`packages/domain` owns money, periods, plan rules and the store schema and has no terminal or filesystem code. `apps/cli` owns commands, prompts and JSON storage. Tests sit next to the code they cover (`*.test.ts`); the storage suite uses temporary directories and never touches `~/.kakeibo`.
