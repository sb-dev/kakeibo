# CLI MVP walkthrough and release verification

**Status:** Walkthrough passed · **Date:** 28 October 2026\
**Requirements:** [CLI MVP PRD](cli-mvp-prd.md) §§6–7 · **Task:** [T5](cli-mvp-tasks.md#t5--verify-and-document-the-complete-cli-workflow)\
**Tested commit:** `4607365879956ba0c15541b07f27f3657404e180` (`main` after T4) with the two fixtures added by T5.

This record is the release evidence the PRD asks for: the automated checks, the built executable, and one complete CLI walkthrough run in a temporary data directory with synthetic data. A planned command or a passing unit test alone is not release evidence; every result below was observed.

## 1. Environment

| Item | Value |
|---|---|
| Node.js | v22.22.0 (supported range `>=22.12.0 <23`) |
| pnpm | 10.28.0 |
| Operating system | Ubuntu 24.04.5 LTS, Linux 6.18.44 x86_64 |
| `kakeibo` executable | `~/.local/share/pnpm/kakeibo`, created by `pnpm link --global` in `apps/cli` after `pnpm build` |
| Data directory | A temporary directory passed with `--data-dir`; `~/.kakeibo` was not touched |
| Terminal | 220 columns; interactive commands were answered through a pseudo-terminal, report commands ran with stdout redirected to a pipe |
| Runtime | 39 commands in 71 s wall-clock, of which the interactive review took 39 s; every report command returned in under 0.4 s |

## 2. Automated checks

Run from a clean checkout, in this order.

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | Completed; lockfile unchanged |
| `pnpm typecheck` | Passed for `@kakeibo/domain` and `@kakeibo/cli` |
| `pnpm test` | 15 files, 191 tests passed |
| `pnpm build` | Compiled `packages/domain`, then `apps/cli` |
| `node apps/cli/bin/kakeibo.js --help` | Exit 0; lists `edit`, `import`, `init`, `plan`, `review`, `spending`, `summary` |
| `cd apps/cli && pnpm link --global && kakeibo --version` | Prints `0.1.0` |

The tests map to the PRD §7 groups as follows.

| PRD group | Files | Tests |
|---|---|---|
| Import | `apps/cli/src/import/csv.test.ts`, `apps/cli/src/import/reconcile.test.ts`, `apps/cli/src/commands/import.test.ts` | 12 + 24 + 13 |
| Calculations and plans | `packages/domain/src/money/pence.test.ts`, `packages/domain/src/plan/plan.test.ts`, `packages/domain/src/review/totals.test.ts`, `packages/domain/src/reports/summary.test.ts`, `apps/cli/src/commands/plan.test.ts` | 10 + 11 + 3 + 8 + 15 |
| Periods | `packages/domain/src/periods/periods.test.ts`, `apps/cli/src/commands/report.test.ts` | 12 + 14 |
| Review state | `packages/domain/src/review/review-state.test.ts`, `apps/cli/src/commands/review.test.ts`, `apps/cli/src/commands/edit.test.ts` | 15 + 16 + 5 |
| Storage integration suite | `apps/cli/src/storage/storage.integration.test.ts` | 21 |
| Store schema validation | `packages/domain/src/store/validate.test.ts` | 12 |

`pnpm --filter @kakeibo/cli link --global` does not work with pnpm 10 (`Unknown option: 'recursive'`); run `pnpm link --global` inside `apps/cli` instead. The CLI guide was corrected.

## 3. Walkthrough

Fixtures, all synthetic, from `fixtures/synthetic-financial-data/csv/`:

| File | Role |
|---|---|
| `review-week.csv` | First export of the current account, 19 October to 1 November |
| `review-week-reexport.csv` | A later export of the same account in a different row order with one new row on 3 November: the overlapping reimport |
| `cafe-search-partial.csv` | A filtered search export containing only the two identical Corner Cafe purchases of 24 October |
| `savings-account.csv` | The savings-account side of the £200 transfer |

Every command took `--data-dir <temporary directory>`. Prompt answers are listed so the run can be repeated by hand.

### 3.1 Initialise and plan

| Step | Command | Answers | Observed |
|---|---|---|---|
| 1 | `kakeibo init` | — | Store created. Exit 0. |
| 2 | `kakeibo init` | — | `A store already exists at … init never replaces an existing store. No data was changed.` Exit 1. |
| 3 | `kakeibo plan --month 2026-10` | income 500, fixed 100, Savings allocation 100, Needs 150, Wants 100, Culture 25, Unexpected 25, intention "Cook at home on weekdays", save yes | `Flexible budget to allocate across the four envelopes: £300.00`, then `Saved plan revision 1 for 2026-10`. Exit 0. |
| 4 | `kakeibo plan --month 2026-10 --show` | — | Revision 1, envelopes total £300.00, intention shown. Exit 0. |

### 3.2 Import, overlapping reimport and a filtered export

| Step | Command | Answers | Observed |
|---|---|---|---|
| 5 | `kakeibo import csv/review-week.csv --account current` | Comma; `Date`; `YYYY-MM-DD`; `Description`; one signed column `Amount`; negative is money out; no ID, currency or reference column; complete export for 2026-10-19 to 2026-11-01; import yes | Preview: `Reused 0 · New 9 · Needs decision 0 · Duplicate candidates 0`, `Currency: the file has no currency column; every amount will be recorded as GBP.` Result: `Imported review-week.csv into 'current' as imp_001: 9 new unreviewed entries, 0 reused.` Entries `tx_001`–`tx_009`. |
| 6 | `kakeibo import csv/review-week-reexport.csv --account current` | complete export for 2026-10-19 to 2026-11-08; import yes | `Using saved mapping version 1 for 'current'.` Preview: `Reused 9 · New 1`, every reused row shown with its entry and `counted occurrence`, independent of row order. Result: `1 new unreviewed entry (tx_010, 3 November), 9 reused.` |
| 7 | the same command again | — | `review-week-reexport.csv was already imported into 'current' as imp_002 … Nothing to import. No data was changed.` Exit 0. |
| 8 | `kakeibo import csv/cafe-search-partial.csv --account current` | filtered or partial; bulk decision "Keep them as separate new entries"; no per-row override; import yes | Preview: `Needs decision 2`, both rows proposed against `tx_006` and `tx_007` with reason `this file is not declared complete for the date`. After the decision: `New 2 · Duplicate candidates 2`. Result: `2 new unreviewed entries (tx_011, tx_012) … 2 possible duplicate(s) to resolve in review.` |
| 9 | `kakeibo import csv/savings-account.csv --account savings` | same mapping answers as step 5; complete export for 2026-10-22 to 2026-10-22; import yes | `Imported savings-account.csv into 'savings' as imp_004: 1 new unreviewed entry (tx_013), 0 reused.` |
| 10 | `kakeibo review --week 2026-10-19 --show` | — | 10 entries, all unreviewed; Unclassified unreviewed £402.80; two duplicate candidates listed with their retained entries. |

### 3.3 Review the week

Step 11: `kakeibo review --week 2026-10-19`. Each action was saved as soon as it was confirmed.

| Action | Answers | Observed |
|---|---|---|
| Classify `tx_001` Tesco Stores −£50.00 | Spending · Needs · Groceries · save and mark reviewed | `Saved 1 entry as reviewed.` |
| Classify `tx_002` Waterstones −£20.00 | Spending · Culture · Books · save and mark reviewed | `Saved 1 entry as reviewed.` |
| Classify `tx_003` Tesco refund +£10.00 | Refund · Needs · Groceries · save and mark reviewed | `Income, Unclassified / Uncategorised → Refund, Needs / Groceries` |
| Classify `tx_004` Transfer to savings −£200.00 | Contribution to the Savings goal · Savings · other side `tx_013` · save and mark reviewed | Both sides changed to `Goal contribution, Goal / Savings`, `Linked to the Savings goal as one contribution of £200.00.`, `Saved 2 entries as reviewed.` |
| Classify `tx_006` and `tx_007` Corner Cafe −£3.20 | Spending · Wants · new category `Cafes` (created with the first save) · save, leave unreviewed | `Saved 1 entry as unreviewed.` twice |
| Confirm entries | select `tx_006`, `tx_007`; confirm | `Not offered: tx_011, tx_012 are duplicate candidates. Resolve them first.` Preview `Selected 2 entries · £6.40 money out`, then `Saved: 2 entries marked reviewed.` |
| Resolve duplicate candidates (2) | select `tx_011`, `tx_012`; bulk "Exclude as duplicates of their retained entries"; no override; apply | Preview with retained entries `tx_006` and `tx_007`, `2 entries · £6.40 money out`; `Saved 2 duplicate decisions.` |
| Write the reflection | "The savings transfer went out on time" / "Check the card statement before the next review"; save | `Saved the reflection. The review is not closed until you close it.` |
| Close the review | yes | `Closing 2026-10-19: 10 entries · reviewed 7 · unresolved 1 · excluded duplicates 2`, `Unresolved entries stay unreviewed and visible: tx_005 (£120.00 money out).`, then `Closed the review for 2026-10-19.` |
| Exit | — | `Exited.` Exit 0. |

`tx_005` Card payment to Visa was left unresolved on purpose; the card's purchases are not imported here.

### 3.4 Restart, reopen and correct after closure

| Step | Command | Answers | Observed |
|---|---|---|---|
| 12 | `kakeibo review --week 2026-10-19 --show` | — | `Review: closed 2026-10-28T18:34:26.442Z`, `Entries: 10 · reviewed 7 · unreviewed 1 · excluded duplicates 2`, the saved reflection and the closure record. Reviewed: Needs £40.00, Wants £6.40, Culture £20.00; Unclassified unreviewed £120.00; contributions `reviewed £200.00 (1)`. |
| 13 | `kakeibo review --week 2026-10-26 --show` | — | `Week 2026-10-26 to 2026-11-01 (in progress)`. Month to date shows `2026-10` against plan revision 1 and `2026-11` with `No plan saved for 2026-11` and `no plan` in every limit cell. |
| 14 | `kakeibo edit tx_005` | Change type · Transfer between own accounts or card settlement · Outside plan / Credit-card payment · save and mark reviewed · Done | The entry detail lists both source observations (`src_005` created it, `src_019` from the re-export reused it). `Saved 1 entry as reviewed.`; revision 1 → 2. |
| 15 | `kakeibo review --week 2026-10-19 --show` | — | `Review: CHANGED SINCE REVIEW (closed 2026-10-28T18:34:26.442Z; changed tx_005)`. Transfers £120.00 under "Not spending"; Unclassified £0.00; reflection and closure preserved. |

### 3.5 Summary and category drill-down

| Step | Command | Observed |
|---|---|---|
| 16 | `kakeibo summary --month 2026-10` | See the totals below. `Unresolved: 1 unreviewed · 1 Unclassified · 0 duplicate candidates`. |
| 17 | `kakeibo summary --month 2026-11` | `No plan saved for 2026-11`; `no plan` limits; unreviewed Unclassified £55.50 from `tx_009` and `tx_010`. |
| 18 | `kakeibo spending --month 2026-10` | Treatment table totals: gross £88.40, refunds £10.00, net £78.40, reviewed £66.40, unreviewed £12.00, 6 entries; `transfers £120.00 (1)`, contributions `reviewed £200.00 (1)`, `excluded duplicates 2`. |
| 19 | `kakeibo spending --month 2026-10 --envelope Needs` | `Groceries £50.00 £10.00 £40.00 £40.00 £0.00 2`; `limit £150.00 · reviewed £40.00 · unreviewed £0.00 · reviewed remaining £110.00`. |
| 20 | `kakeibo spending --month 2026-10 --envelope Needs --category Groceries` | `tx_001 … £50.00 reviewed` and `tx_003 … -£10.00 reviewed`; `Total: gross £50.00 · refunds £10.00 · net £40.00`. |
| 21 | `kakeibo spending --month 2026-10 --envelope Wants --category Cafes` | `tx_006` and `tx_007` at £3.20 each; net £6.40. |

`store.json` was byte-identical before and after steps 16–21.

### 3.6 Reverse a source match

| Step | Command | Answers | Observed |
|---|---|---|---|
| 22 | `kakeibo edit tx_001` | Reverse an incorrect source reuse · `src_012` from `review-week-reexport.csv` row 3 · yes · Done | `Saved: src_012 now belongs to new unreviewed entry tx_014.` `tx_001` keeps revision 2, `Needs / Groceries`, reviewed; its detail now lists `Reversed source rows (now separate entries): src_012 → tx_014`. |
| 23 | `kakeibo review --week 2026-10-19 --show` | — | `Review: CHANGED SINCE REVIEW (… added tx_014; changed tx_005)`, 11 entries, `tx_014 2026-10-19 Tesco Stores -£50.00 … Unclassified / Uncategorised unreviewed`. |

### 3.7 Errors and exit codes

| Step | Command | Observed |
|---|---|---|
| 24 | `kakeibo plan --month 2026-10` with stdin redirected | `` `kakeibo plan` is interactive and needs a terminal. Use `kakeibo plan --month 2026-10 --show` to display the saved plan. No data was changed.`` Exit 1. |
| 25 | `kakeibo review --week 2026-10-20 --show` | `--week must be a Monday; 2026-10-20 is not. Weeks run Monday to Sunday, so use --week 2026-10-19. No data was changed.` Exit 2. |
| 26 | `kakeibo spending --month 2026-10 --category Groceries` | `--category needs --envelope, for example --envelope Needs --category Groceries. No data was changed.` Exit 2. |
| 27 | `kakeibo edit tx_005` with stdin redirected | `` `kakeibo edit` is interactive and needs a terminal. … No data was changed.`` Exit 1. |
| 28 | `kakeibo edit tx_999` in a terminal | `` No entry tx_999. Entry IDs appear in `kakeibo review --show`. No data was changed.`` Exit 1. |

### 3.8 Backup recovery

| Step | Command | Observed |
|---|---|---|
| — | `store.json` truncated to 200 bytes to simulate corruption | — |
| 29 | `kakeibo summary --month 2026-10` | `The store at …/store.json is corrupt or unsupported and was not modified.` / `invalid JSON: Unterminated string in JSON at position 200 (line 12 column 6)` / `The previous valid store may be at …/store.json.bak; see apps/cli/README.md for recovery. No data was changed.` Exit 1. |
| — | `mv store.json store.json.corrupt && cp store.json.bak store.json` | — |
| 30 | `kakeibo plan --month 2026-10 --show` | `Plan for 2026-10 (revision 1, …)` with the £500 plan. Exit 0. |
| 31 | `kakeibo review --week 2026-10-19 --show` | `Review: CHANGED SINCE REVIEW (… changed tx_005)`, 10 entries. `tx_014` is absent: the backup holds the state before the most recent save, so the step 22 reversal has to be repeated. |

### 3.9 Help and redirected output

Steps 32–39: `kakeibo --help` and `kakeibo <command> --help` for `init`, `plan`, `import`, `review`, `edit`, `summary` and `spending` all exited 0 with usage text. Every report command above (`plan --show`, `review --show`, `summary`, `spending`) ran with stdout redirected to a pipe and no terminal on stdin.

## 4. Expected and observed totals

Expected values were calculated by hand from the fixtures and the classifications above. Observed values are from `summary --month 2026-10` (step 16) after the closure correction and before the reversal.

| Figure | Expected | Observed |
|---|---|---|
| Needs reviewed net spending (£50 purchase − £10 refund) | £40.00 | £40.00 |
| Needs reviewed remaining (£150 − £40) | £110.00 | £110.00 |
| Culture reviewed net spending | £20.00 | £20.00 |
| Wants reviewed net spending (two Corner Cafe purchases) | £6.40 | £6.40 |
| Flexible total reviewed net spending | £66.40 | £66.40 |
| Reviewed gross spending / refunds / net | £76.40 / £10.00 / £66.40 | £76.40 / £10.00 / £66.40 |
| Unreviewed Unclassified (Cinema City, 30 October) | £12.00 | £12.00 |
| Income (a refund is never income) | £0.00 | £0.00 |
| Transfers, not spending (card payment) | £120.00 (1) | £120.00 (1) |
| Savings-goal contributions, counted once although both account sides are imported | £200.00 (1) | £200.00 (1) |
| Excluded duplicates, not counted | £6.40 (2) | £6.40 (2) |
| Fixed reviewed spending | £0.00 | £0.00 |
| November net spending (1 and 3 November, unreviewed, no plan) | £55.50 | £55.50 |

The PRD §7 fixture figures Needs £40, Culture £20 and Needs remaining £110 appear unchanged; the Wants figure comes from the two cafe purchases this walkthrough adds.

## 5. Continuous integration

The GitHub Actions job (`.github/workflows/ci.yml`: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, `pnpm build`) runs on every pull request. The same four commands passed locally on the tested commit as recorded in §2. The CI result for the pull request that adds this record is noted on that pull request.

## 6. Acceptance

The CLI MVP workflow in PRD §1, plan → import → review → reflect, with monthly summary and category drill-down, was completed from the terminal without editing stored JSON or calculating totals elsewhere. Bank compatibility is not claimed: no bank export has been checked, and the walkthrough used the documented generic CSV format only.
