# CLI MVP implementation tasks

**Status:** Planned · **Date:** 28 October 2026\
**Requirements:** [CLI MVP PRD](cli-mvp-prd.md)  
**Baseline:** Kakeibo `main` at `00d7d9e30c4ec65933533635b8d3b0a984e94bab`.

Implement T1–T5 in order. Each task delivers executable behaviour, its focused checks and usage documentation. The PRD defines the CLI release scope; Financial Model v1.2 owns the refund and overlapping-source rules. This task list does not record Pactwright checkpoint acceptance.

## Implementation boundaries

- Use `packages/domain` for financial types, money/period calculations, plans, aggregation and review rules. Keep commands, prompts, CSV parsing, source reconciliation orchestration and storage in `apps/cli`. Use plain modules with CLI depending on domain.
- Use Commander, `csv-parse`, `@inquirer/prompts` and Node.js built-ins. Use pnpm, TypeScript and Vitest. Pin supported versions in T1.
- Keep money and date calculations independent of prompts and filesystem access. Derive totals from entries; do not store aggregate totals.
- Keep movement, financial purpose, plan treatment, category and review state distinct. A refund is an inflow that reduces spending, not income.
- Keep `Goal` and `Outside plan` as distinct treatments, as defined by Financial Model §3.2. Include the single plan-funded Savings goal under Financial Model §6.1. A transfer contributes only when the user links and confirms it. Richer goal management remains deferred.
- Split month-to-date comparisons by month when a review week crosses a month boundary. Use each month's plan and label missing plans explicitly.
- Do not add cloud services, AI, additional packages, an adapter registry, automatic classification or a generic persistence framework.

## T1 — Initialise the store and plan a month

**PRD:** §§3, 4.2, 4.6, 5–6. **Depends on:** none.

**Changes**
- Add the root pnpm workspace configuration, `apps/cli` and `packages/domain`, executable entry point and build configuration. Expose `kakeibo` through the package's `bin`.
- Implement `init`, `plan`, `plan --show`, global `--data-dir`, help and period validation. Require a terminal for interactive actions.
- Define versioned store data for accounts, mappings, imports/source records, entries, categories, the Savings goal, plans, reviews and change history. Add only fields needed by the PRD.
- Implement exact decimal-to-pence parsing and checked arithmetic. Validate non-negative plan amounts and both planning equations.
- Save confirmed plan revisions and optional intentions. Store the Savings goal's monthly allocation as `plan_funded_goal_allocations`; retain its identity, allocation revisions and contribution links. Keep planned income/allocation separate from observed income/contributions.
- Validate stores before mutation. Prevent concurrent writers; reject a second writer without changing data. Save through a temporary file and replacement, retaining the previous valid store as `store.json.bak`.
- Never overwrite an existing store on `init` or replace corrupt/unsupported data with an empty store. Use restrictive permissions where supported. Document stale-lock handling and backup recovery.
- Add workspace scripts for type checking, tests and compilation of both packages; build domain before CLI. Add one GitHub Actions job using a frozen lockfile. Scope any repository format/lint requirements to the files and tools introduced.
- Ignore local stores, backups and personal import directories without excluding synthetic fixtures.

**Verify**
- Initialise a temporary data directory; save, restart and display the PRD's £500 plan.
- Accept £300 allocated across the four envelopes; reject £299, negative amounts, excess precision and unsafe integers without saving.
- Exercise save/load, backup restore, corrupt-store rejection and writer contention in the storage integration suite.

## T2 — Import posted CSV transactions

**PRD:** §§3, 4.1, 4.6, 5. **Depends on:** T1.

**Changes**
- Implement `import <file> --account <name>` and `--remap`. Create named accounts through the confirmed import flow.
- Support the PRD's delimiters, date formats, amount layouts, sign conventions, optional source IDs and GBP validation. Save confirmed mappings.
- Parse source rows into normalised records before creating financial entries. Retain raw values, account, file hash, row position and mapping snapshot.
- Validate the entire file before showing a preview. Commit the mapping, import record and entries together only after confirmation.
- Detect unchanged source-ID reimports within an account; abort on conflicting data. Without IDs, use account, file hash and row position for exact-file reimports.
- Implement PRD §4.1 / Financial Model §10.3 count matching for complete overlapping exports. Capture stated date range, completeness basis and mapping version; never infer coverage from row bounds.
- Group source-normalised values by account, posted date, currency, source movement, amount, description and optional stable reference. Reuse reconciled occurrences one-to-one, independent of order; add only excess occurrences. Do not flag valid excess occurrences as duplicates solely because their values match.
- Persist each incoming row's retained-entry link and match basis. Preserve existing IDs, classifications and review states. Provide explicit reversal of incorrect reuse into a separate unreviewed entry.
- Flag missing occurrences/reduced counts and changed-value discrepancies by posted date. Keep history intact. Uncertain coverage, filtered exports and incompatible mappings require explicit bulk/individual match decisions with per-row overrides.
- Show reused, new and unresolved rows before the single import confirmation. Mark new rows only as unreviewed. Offer keep-separate when identity is uncertain; similarity alone never excludes a row.
- Treat remaining financial duplicate candidates separately from reused source observations.
- Add synthetic fixtures for signed amounts, debit/credit columns, changed mappings, invalid values, exact and overlapping reimports, partial coverage, changed values/counts and legitimate identical purchases.

**Verify**
- Test both sign conventions and amount layouts, quoting, delimiters, invalid rows, source-ID conflicts and exact-file reimports.
- Verify reordered complete exports reuse two identical purchases; a third adds exactly one. Repeating either file adds none. Reused entries retain review state and gain source links.
- Verify reduced counts, missing rows, changed descriptions/amounts, filtered exports and incompatible mappings require explicit reconciliation without deleting history. Test bulk decisions, per-row overrides and reversal of incorrect reuse.
- Confirm new entries are unreviewed and traceable after deleting the source CSV.
- Extend the storage integration suite to prove invalid imports and cancelled previews leave the store unchanged.

## T3 — Review a week and correct entries

**PRD:** §§3, 4.3–4.4, 4.6, 5. **Depends on:** T2.

**Changes**
- Implement `review --week`, `review --show` and `edit <entry-id>`. In `edit`, expose the entry's source observations and reversal of an incorrect reuse decision. Reject explicit week dates that are not Mondays.
- Show all entries, reviewed/unreviewed envelope totals, unresolved classifications and duplicate candidates. Provide initial categories and creation of categories within a treatment.
- Allow movement/purpose and classification corrections, including refunds, transfers and uncertain card settlements. Allow explicit Savings-goal contribution links; count only one contribution per transfer when both account sides are imported.
- Implement individual and bulk keep-both/duplicate exclusion decisions. Preview selected rows, retained-entry references, count and amount; allow per-row overrides and reversal. Reject self-references and exclusion chains that leave no retained entry.
- Show selected entries, count and total before individual or bulk confirmation. Require explicit acceptance of unclassified entries; block confirmation of unresolved duplicate candidates.
- Save each confirmed action together with its before/after history. Changing reviewed meaning requires fresh confirmation or makes the entry unreviewed. Restoring an excluded duplicate makes it unreviewed.
- Show the full-week scan and month-to-date envelope comparisons. Offer separate closure and optional reflection/next-action fields.
- Preserve closure records and notes. Compare entry revisions/membership with the closure snapshot to detect later changes. Exiting does not close the review.

**Verify**
- Test confirmation, unresolved entries, duplicate resolution/reversal, reviewed corrections and closure independently.
- Restart after a confirmed action and resume without losing it.
- Close a week with unresolved entries, then import or edit an entry in that week. Reopening must show changed-since-review status and the saved notes.

## T4 — Summarise a month and inspect category spending

**PRD:** §§3, 4.5–4.6. **Depends on:** T3.

**Changes**
- Implement `summary --month` and `spending` with week/month, envelope and category filters. Default both to the current local month. Reject conflicting periods and category queries without an envelope.
- Use the same `packages/domain` calculations as weekly review. Show income, gross spending, refunds, net spending and reviewed/unreviewed amounts.
- Show each envelope's limit and remaining amount against reviewed net spending. Display Fixed separately; keep Goal, Outside plan and Unclassified amounts distinguishable.
- Exclude transfers and confirmed duplicates from income/spending. Keep unresolved duplicate candidates in unreviewed totals.
- Show entry IDs and the contributing purchases/refunds in category drill-down. Preserve refunds in their posted period, including negative category net spending.
- Label missing plans, periods in progress and no imported activity. Support redirected output without prompts.

**Verify**
- Check the PRD's numeric fixture: Needs £40, Culture £20, net flexible spending £60, Needs reviewed remaining £110 and transfer spending £0. Refund income is £0; an allocation alone is not a goal contribution.
- Test partial refunds, missing original purchases, unclassified/unreviewed refunds and a refund posted next month. Prior months stay unchanged; negative net spending and remaining above the limit are valid. Never count a refund again in income-minus-net-spending.
- Verify explicitly linked Savings-goal contributions remain separate from spending/income and both sides of a transfer cannot double-count progress.
- Verify reviewed/unreviewed separation and reconciliation from entry → category → envelope → summary.
- Test default periods, Sunday/Monday, month/year boundaries, leap dates and a week spanning two plans, including a missing plan.
- Verify report commands do not alter stored data.

## T5 — Verify and document the complete CLI workflow

**PRD:** §§6–7. **Depends on:** T4.

**Changes**
- Update `README.md` and add a concise CLI guide with verified install/run commands, supported Node.js version, generic CSV format, sign mapping, review workflow and backup recovery.
- Document GBP/personal-account scope, plain-text storage and imported-activity limits. Claim bank compatibility only after checking a supplied export format.
- Run the PRD walkthrough in a temporary data directory: initialise → plan → import → overlapping reimport → review → restart → reopen → summary → category drill-down.
- Include a correction after closure, bulk duplicate decisions, source-match reversal and a restored backup. Record commands, expected/observed totals, runtime, OS and tested commit.

**Verify**
- Run type checking, the four focused unit-test groups and the storage integration suite, then compile and invoke the built executable.
- Confirm installation exposes `kakeibo`, all commands provide help, reports work when redirected, and errors state whether data changed.
- Record CI and walkthrough results before marking the MVP accepted. A planned command or passing unit test alone is not release evidence.

## Test allocation

Use the PRD's four unit-test groups: import (T2), calculations/plans (T1/T4), periods (T1/T3/T4) and review state (T3). Extend one storage integration suite across T1–T3. T5 owns the documented CLI walkthrough. Add no coverage targets, terminal snapshots or tests of library internals.

## Source alignment

The CLI scope differs from the full product in runtime, persistence and deferred capabilities. Financial logic uses the canonical domain package boundary. These differences are explicit in PRD §§2, 6 and 8. Review against the owners below; do not treat this task list as an amendment to them.

| Owner | Implementation concern |
|---|---|
| Product §§5–7, 9–11, 15 | Planning, envelopes, review, reflection and recovery |
| [Financial Model §§3, 5–7, 9–12](../specs/02-financial-domain-model-spec.md) | Classification, refunds, plan balance, single Savings goal, confirmation, source/duplicate reconciliation and history |
| Architecture §§5, 9–10, 14–15, 19 | Local CLI scope, source provenance and atomic changes |
| Engineering §§6, 8–10, 33, 36–37 | Focused checks, recovery, safe fixtures and documentation |
| Open-Source Project Organisation §§5, 12 | Local CLI scope and accurate public setup instructions |

Financial Model v1.2 defines the revised refund and overlap semantics. Other canonical specifications are unchanged apart from the version index. Any further semantic conflict must be identified against its owner rather than resolved silently in code.
