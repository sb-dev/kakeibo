# Kakeibo CLI

Terminal interface for the Kakeibo money-review workflow: plan the month, import CSVs, review spending and reflect. Data stays on your device in one local JSON store.

**Status:** tasks T1–T3 of the [CLI MVP tasks](../../docs/product/cli-mvp-tasks.md) are implemented: `init`, `plan`, `plan --show`, `import`, `review`, `review --show` and `edit`. Summary and spending reports follow in T4. Requirements live in the [CLI MVP PRD](../../docs/product/cli-mvp-prd.md).

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
| `kakeibo import statement.csv --account current` | Map columns when needed, preview the rows and confirm the import. Needs a terminal. |
| `kakeibo import statement.csv --account current --remap` | Ask for the column mapping again, for example after the export format changed. |
| `kakeibo review --week 2026-10-19` | Open or resume the Monday–Sunday review. Needs a terminal. |
| `kakeibo review --week 2026-10-19 --show` | Show the week's totals, entries, reflection and closure status without prompts. Works when output is redirected. |
| `kakeibo edit tx_014` | Correct one entry: type, treatment and category, review state, duplicate decision or source reuse. Needs a terminal. |

`--month` defaults to the current local month and `--week` to the current local Monday–Sunday week. An explicit `--week` must be a Monday. Every command accepts `--help`. The global `--data-dir <dir>` selects another store directory; the default is `~/.kakeibo`.

### Planning a month

`plan` asks for planned income, fixed commitments, the Savings allocation for the month, limits for **Needs, Wants, Culture and Unexpected**, and an optional intention. It shows the resulting plan and asks for confirmation before saving. Amounts are pounds with at most two decimal places; negative amounts, more than two decimal places and values too large to store exactly are refused and asked again.

The plan is saved only when both equations hold:

```text
flexible budget = planned income - fixed commitments - savings allocation
Needs + Wants + Culture + Unexpected = flexible budget
```

Each confirmed plan is stored as a new revision. Earlier revisions are kept, and a history record explains each change. The Savings allocation is stored against the single plan-funded Savings goal; it records intent, not money already saved.

### Importing a CSV file

`import` reads posted transactions from a UTF-8 CSV file with a header row. Quoted fields and blank lines are accepted. The [synthetic fixtures](../../fixtures/synthetic-financial-data/csv/README.md) show the supported layouts.

| Setting | Supported values |
|---|---|
| Delimiter | comma or semicolon |
| Posted date | `YYYY-MM-DD` or `DD/MM/YYYY`, real calendar dates only |
| Description | required; surrounding and repeated spaces are collapsed |
| Amount | one signed column, or separate money-out (debit) and money-in (credit) columns |
| Sign convention | for a signed column, whether negative or positive means money out; bank and card exports often differ |
| Source transaction ID | optional; identifies a row within the account |
| Currency | optional column; every value must be `GBP`. Without the column, the preview states that amounts are recorded as GBP |
| Stable reference | optional; a bank reference that is part of the matching group |

Amounts use a decimal point and at most two decimal places, with an optional sign; `1,234.56` is read as one thousand two hundred and thirty-four pounds. Zero amounts, decimal commas and amounts too large to store exactly are refused.

The first import into an account asks for every mapping choice. The mapping is saved with the import, and later imports reuse it. If a later file lacks a mapped column, the import stops and suggests `--remap`. A new account name is created by the confirmed import; names are matched without regard to case.

The whole file is validated before the preview. A malformed value stops the import and names its row, line and column. The import then asks whether the file contains **every posted transaction for the account between two dates**. Answer yes only for a complete, unfiltered export, and enter the range yourself; the first and last rows never establish coverage.

The preview shows the account, file, mapping, sign convention, currency, date range, coverage and counts, then lists:

- **reused** rows, which match existing entries; those entries keep their IDs, classification and review state and gain a source link;
- **new** rows, which become unreviewed `Unclassified / Uncategorised` entries; money out starts as spending and money in as income until review;
- **unresolved** rows, which need a decision before the import can be confirmed;
- **flagged dates**, where a complete export is missing existing entries or changes their values. Existing entries are never deleted.

One confirmation saves the account, the mapping, the import record and its entries together. Declining saves nothing. Every source row keeps its raw values, row and line, the file name and SHA-256 hash, the mapping version and the reason it was linked to its entry, so imported history stays usable after the CSV is deleted.

#### Repeat and overlapping imports

| Case | Behaviour |
|---|---|
| The same file again | Recognised by account, file hash and row values. Nothing is imported. |
| A row with a known source ID | Reuses its entry. A different date, description or amount for that ID stops the import. A row with a new ID is never matched to an entry already linked to a different ID. |
| A row without an ID that matches an entry with a known source ID | Always proposed for an explicit decision, never reused or added silently. |
| Complete exports with compatible mappings overlapping on a date | Rows are counted within matching groups (posted date, currency, movement, amount, description and reference), whatever their order. Two existing identical purchases and three incoming ones reuse two and add one. |
| Fewer occurrences or a missing row on a completely covered date | The date is flagged; the existing entries stay. |
| A changed amount or description on a completely covered date | Proposed as a match for an explicit decision; the preview shows the retained and incoming values. Reusing applies the new values; a changed amount makes the entry unreviewed. |
| A filtered or partial file, unknown earlier coverage, or a changed mapping | Matches are proposed, not applied. Choose **reuse** or **keep separate** for all of them, then select rows to override. Kept rows that look identical to an existing entry are marked as possible duplicates for review. |

A mapping change is compatible when only the header changed. A different date format, amount layout or sign convention, description column, reference column or use of source IDs makes earlier coverage incompatible. An incorrect reuse can be reversed into a separate unreviewed entry with `kakeibo edit`; reversing a changed-amount replacement restores the earlier amount and makes the entry unreviewed.

### Reviewing a week

`review` shows the week, then offers actions until you choose **Exit**. Each confirmed action is saved at once, so an interrupted review resumes where it stopped. Exiting never closes the review.

The report (also printed by `--show`) contains:

- the period, marked **in progress** for the current week, and the closure status: not closed, closed, or **changed since review**;
- net spending per treatment (Fixed, Needs, Wants, Culture, Unexpected, Outside plan, Unclassified), split into reviewed and unreviewed; refunds reduce spending and are never income;
- income, transfers and Savings-goal contributions, which are not spending;
- unresolved (Unclassified) entries and duplicate candidates with the entry each one may duplicate;
- every entry, grouped by day;
- month-to-date limits, reviewed and unreviewed spending and reviewed remaining for each month in the week, using that month's plan. A week that crosses a month end shows both months; a missing plan is labelled;
- the reflection and earlier closures.

Totals describe imported activity only. They are not a bank balance.

| Action | Effect |
|---|---|
| Confirm entries | Select entries; the preview shows the count and total. Unclassified entries need explicit acceptance; duplicate candidates cannot be confirmed until resolved. |
| Classify or correct | Choose the type (spending, refund, income, transfer, Savings-goal contribution or adjustment), the treatment and the category, or create a category. Changing a reviewed entry asks whether to confirm the new classification or leave it unreviewed. |
| Resolve duplicate candidates | Select candidates, choose **exclude** or **keep both** for all, then select rows to override. The preview shows each retained entry, the count and the amount. An excluded duplicate counts zero and is marked reviewed. |
| Reverse a duplicate decision | The entry becomes an unreviewed duplicate candidate again. |
| Add a category | Within any treatment except Unclassified. Names are unique within a treatment. |
| Write the reflection | Two optional fields: **What stood out?** and **What will you change next week?** |
| Close the review | Records every entry in the week and its revision. Unresolved entries stay unreviewed. Closing again keeps earlier closures and notes. |

A closed week shows **changed since review** when a later import adds an entry to it or a correction changes one of its entries. The report names those entries.

Type rules:

| Type | Money | Treatments |
|---|---|---|
| Spending | out | Fixed, the four envelopes, Outside plan or Unclassified |
| Refund | in | the same as spending; it reduces that treatment's spending in its posted period |
| Income | in | Outside plan or Unclassified |
| Transfer (including a card settlement when the card's purchases are tracked) | in or out | Outside plan |
| Savings-goal contribution | in or out | Goal |
| Adjustment | in or out | Outside plan |

An uncertain card settlement can stay Spending / Unclassified, where it remains visible and unresolved. A Savings-goal contribution is always an explicit link. If the other account side of the transfer is imported, choose it when asked: both entries share one link and the contribution counts once. Changing a linked entry to another type removes the link; the other side becomes a transfer.

### Correcting one entry

`edit <entry-id>` shows the entry, its account, values, classification, review state, duplicate decision, Savings-goal link and every source row linked to it (import, file name, row, line, match basis and raw values). It offers the classify, confirm and duplicate actions above for that entry, plus:

- **Mark as a duplicate of another entry**: enter the ID of the entry to keep. An entry cannot duplicate itself, and an exclusion that would leave no retained entry is refused.
- **Reverse an incorrect source reuse**: the chosen source row gets its own new unreviewed entry; the entry keeps its ID, classification and review state.

Every saved correction increases the entry's revision and adds a before/after record to the store's history.

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
| 0 | Success, including "plan not saved" or "import cancelled" after you decline the confirmation, and a file that was already imported. |
| 1 | The command could not complete (missing store, store exists, lock held, corrupt store, plan does not balance, no terminal, invalid CSV values, conflicting source IDs, unknown entry ID, an entry changed by another process during a prompt). |
| 2 | Usage error (unknown option, missing `--account`, invalid `--month`, a `--week` that is not a Monday). |
| 130 | Cancelled with Ctrl+C. |

## Stale lock

If kakeibo is killed while saving, `store.lock` may remain. The next write fails with:

```text
Another kakeibo process (pid 4242 on laptop since 2026-10-28T10:01:02.000Z) holds /home/you/.kakeibo/store.lock. If no kakeibo process is running, delete that file and retry. No data was changed.
```

The CLI never removes a lock by itself. Check that no kakeibo process is running (`ps -p 4242` on Linux or macOS), then delete `store.lock` and retry. Reading commands such as `plan --show` and `review --show` do not take the lock.

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
pnpm test        # vitest: domain unit tests, CLI command tests and the storage integration suite
pnpm build       # compiles packages/domain, then apps/cli
```

`packages/domain` owns money, periods, plan rules, classification, review, duplicate and Savings-goal rules, spending totals, the store schema and new-entry defaults and has no terminal or filesystem code. `apps/cli` owns commands, prompts, rendering, CSV parsing, source reconciliation and JSON storage. Tests sit next to the code they cover (`*.test.ts`); the storage suite uses temporary directories and never touches `~/.kakeibo`.
