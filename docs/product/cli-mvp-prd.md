# Kakeibo CLI MVP — Product Requirements

**Status:** Proposed  
**Date:** 28 October 2026\
**Repository:** [sb-dev/kakeibo](https://github.com/sb-dev/kakeibo)  
**Implementation tasks:** [CLI MVP tasks](cli-mvp-tasks.md)

## 1. Goal

Give one person a simple Kakeibo money-review workflow:

**Plan the month → import CSVs → review spendings → reflect.**

The CLI must show spending against the four Kakeibo envelopes, monthly summaries and the entries behind each category total. It must work offline after installation.

Success means the user can complete this workflow without editing stored JSON or using another application to calculate totals.

## 2. Release boundary

| Decision | MVP scope |
|---|---|
| Interface | Terminal commands, short tables and simple prompts. |
| Language | TypeScript on Node.js. |
| Storage | One local JSON store. |
| User and accounts | One user; several named personal accounts. |
| Currency | GBP for this release. Reject other currencies; do not convert them. |
| Input | Posted transactions from CSV files, with a saved mapping per account. |
| Monthly plan | Income, fixed commitments, savings allocation, four envelope limits and an intention. |
| Classification | Transaction type, Kakeibo treatment/envelope and user-defined category. |
| Reviews | Weekly confirmation, envelope comparison, optional reflection and next action. |
| Reporting | Monthly plan versus actuals, envelope totals and category drill-down. |

Defer AI, bank connections, mobile/web interfaces, cloud services, subscriptions, advanced goals, business accounting, splits, automatic categorisation and projections. A single plan-funded Savings goal and explicitly confirmed contributions are included. Multiple goals, richer targets and long-term goal management are deferred.

This is a smaller interface and runtime than the [current product and roadmap][roadmap]. It retains the monthly Kakeibo plan, envelope/category distinction, weekly reflection, source traceability, explicit confirmation and financial counting rules.

Local JSON replaces the full product's cloud storage for this release. This release does not claim completion of the full product or Pactwright checkpoints. The CLI-specific runtime scope is recorded here. Financial Model v1.2 owns refund semantics and overlapping-source reconciliation.

## 3. Commands and workflow

The commands below define the proposed interface. They are not implemented commands.

| Command | Result |
|---|---|
| `kakeibo init` | Create the local store and show its location. Never replace an existing store. |
| `kakeibo plan --month 2026-10` | Set or revise income, commitments, savings, envelope limits and intention. |
| `kakeibo plan --month 2026-10 --show` | Display the saved monthly plan without prompts. |
| `kakeibo import statement.csv --account current` | Map columns when needed, preview the import and confirm it. |
| `kakeibo review --week 2026-10-19` | Open or resume the Monday–Sunday review for that week. |
| `kakeibo review --week 2026-10-19 --show` | Show its current totals, saved reflection and closure status without prompts. |
| `kakeibo summary --month 2026-10` | Show October's plan, envelope use and observed totals. |
| `kakeibo spending --month 2026-10 --envelope Needs` | Show spending in Needs, grouped by category. |
| `kakeibo spending --month 2026-10 --envelope Needs --category Groceries` | Show entries behind Needs / Groceries. |
| `kakeibo edit tx_014` | Correct the movement, envelope/category, duplicate decision or source-reuse decision for a displayed entry ID. |

`tx_014` is an illustrative ID. Reports display the actual IDs.

When the period is omitted, `review` defaults to the current local Monday–Sunday week; `plan`, `summary` and `spending` default to the current local month. Accept `--week` or `--month` for spending queries, but not both. Spending queries first show envelope totals. Selecting an envelope shows its categories; selecting a category shows its entries.

Every command supports `--help`. A global `--data-dir` selects another store directory. Errors must identify the problem and say whether data changed. Interactive commands require a terminal; report commands must also work when output is redirected.

## 4. Product requirements

### 4.1 CSV import

- Accept UTF-8 CSV with a header row, quoted fields and blank lines.
- Map posted date, description and either a signed amount or separate debit/credit columns. Allow an optional source transaction ID and currency column.
- On the first import for an account, ask for missing mapping choices. Save the mapping after confirmation. Offer `--remap` when a later export changes format.
- Support comma and semicolon delimiters. Support explicit `YYYY-MM-DD` and `DD/MM/YYYY` date formats. Use a decimal point for amounts. Reject unsupported formats with a clear error.
- Show the amount sign convention before import. Do not assume that bank and credit-card exports use the same signs. If the file has no currency column, confirm GBP in the preview.
- Validate the entire file before writing. Show account, date range, new rows, repeat rows, duplicate candidates and errors. A malformed required value aborts the import and identifies its row and field.
- Confirm the preview before saving. Cancellation leaves the store unchanged. Imported entries start unreviewed.

Provide a documented generic CSV fixture. Do not claim compatibility with a named bank until its format has been checked. No bank export was supplied for this PRD.

**Repeat imports and duplicates**

Use the source transaction ID within its account when available. Repeating that ID with unchanged source data creates no new entry. Conflicting data for an existing ID must stop the import; it must not overwrite history.

Without IDs, recognise exact-file reimports by account, file hash and row position. Reconcile different overlapping files using [Financial Model §10.3][overlap]: group source-normalised rows by account, posted date, currency, movement, amount, description and any stable source reference; match occurrence counts rather than row order.

Capture each export's stated inclusive date range and whether it contains all posted transactions in that range. A checked format contract or explicit user declaration can establish completeness; row minimum/maximum dates cannot. Use automatic count matching only for covered dates with compatible complete exports and mappings. If old coverage is unknown, require explicit match decisions.

Reuse matching occurrences and add only excess occurrences. Two existing identical purchases and three incoming purchases reuse two and add one unreviewed entry. Under complete coverage, excess occurrences are new activity; equality alone does not make them duplicate candidates. Count reconciled occurrences, not repeated import observations. Compare source values, never user-edited classifications.

Missing occurrences, reduced counts or changed values require reconciliation of the affected date. Retain existing history. Filtered exports, uncertain coverage and incompatible mappings show proposed matches for explicit bulk or individual decisions. Do not silently substitute changed rows.

The preview distinguishes reused, new and unresolved rows. Normal overlaps need one import confirmation, not a decision for each reused row. Reuse preserves entry IDs, classifications and review states; new entries remain unreviewed. Save source-row links and match evidence. Reversing incorrect reuse creates a separate unreviewed entry and preserves the retained entry.

Financial duplicate candidates remain separate from source reuse. Show selected rows, retained-entry references, count and amount before bulk **keep both** or **exclude duplicate** actions. Allow per-row overrides. Exclusion is reversible. Two legitimate identical purchases must remain possible.

### 4.2 Monthly Kakeibo plan

The monthly plan sets intent before the weekly spending reviews. Ask for:

- planned income;
- total fixed commitments, which sit outside the flexible envelopes;
- a user-selected current-month allocation for the single Savings goal;
- limits for **Needs, Wants, Culture and Unexpected**;
- an optional monthly intention.

“Savings allocation” is the CLI label for `plan_funded_goal_allocations` with one plan-funded Savings goal ([Financial Model §6.1][savings]). Store the allocation against that goal, not as an unrelated savings field. The CLI equations are:

```text
flexible budget = planned income - fixed commitments - savings allocation
Needs + Wants + Culture + Unexpected = flexible budget
```

Accept the plan only when both sides balance and every amount is non-negative. Show the effect of a revision before the user confirms it. Preserve earlier plan revisions and review decisions. Imported income never silently changes planned income. The savings allocation expresses intent; it is not evidence that money has been saved. Import is allowed before a plan exists, but review and summary must clearly show that the monthly plan is missing.

### 4.3 Classification

Each spending has a **plan treatment** and a **category**. They are separate fields.

| Treatment | Purpose | Example category |
|---|---|---|
| Fixed | Required commitments, outside flexible envelopes | Housing |
| Needs | Necessary flexible spending | Groceries |
| Wants | Optional purchases and convenience | Eating out |
| Culture | Learning, enrichment and recreation | Books |
| Unexpected | Unplanned flexible costs | Repairs |
| Goal | Explicitly confirmed contribution to the Savings goal | Savings |
| Outside plan | Financial activity outside Kakeibo allocations | Credit-card payment |
| Unclassified | Treatment has not been resolved | Uncategorised |

Provide a short set of initial categories within each treatment, then allow the user to add categories. A category cannot replace an envelope. An entry can be corrected during review or with `edit`. Do not infer that a recurring payment is Fixed. A savings transfer may be linked explicitly to the Savings goal; a transfer alone is not proof of a contribution. Count one contribution per real transfer, not both imported account sides. Goal contributions stay separate from income, Fixed and flexible spending.

### 4.4 Weekly review

1. Show the period, reviewed and unreviewed totals by envelope, missing classifications, duplicate candidates and the current monthly intention.
2. Let the user inspect entries, set their type, treatment and category, resolve duplicates, or leave an entry unresolved.
3. Show the selected entries before individual or bulk confirmation. Include the count and total. Only explicit confirmation marks entries reviewed.
4. Show a complete weekly scan, envelope totals against the monthly plan and unresolved amounts. If the week spans two months, show each month's month-to-date spending, plan and intention separately; label each missing plan. Offer an explicit close action; exiting the command does not close the review.
5. Offer two optional fields: **What stood out?** and **What will you change next week?**
6. Save each confirmed action. Resume after interruption without losing it.

Importing, categorising and closing a review must not implicitly confirm entries. Closure may retain unresolved entries.

An entry without a known treatment or category remains `Unclassified / Uncategorised` and stays visible in reports. Confirmation requires the user to accept that classification explicitly. An unresolved duplicate candidate cannot be marked reviewed.

Changing a reviewed classification requires fresh confirmation; otherwise the entry becomes unreviewed. Restoring an excluded duplicate makes it unreviewed. Preserve a small before/after change history for both kinds of correction.

Reopening a review shows its saved notes and current totals. New entries or corrections in a closed week mark it **changed since review**. Preserve its notes and previous closure record.

### 4.5 Monthly summaries and category drill-down

Show planned income, fixed commitments, savings allocation and monthly intention alongside observed income and spending. For each of the four envelopes, show its limit, reviewed spending, unreviewed spending and the amount remaining against reviewed spending. Show Fixed separately.

Show gross spending, refunds, net spending, category totals and unresolved-entry counts. Keep planned amounts separate from observed amounts.

Use:

```text
net spending = gross spending - refunds
reviewed remaining = envelope limit - reviewed net spending
```

A category drill-down lists contributing purchases and refunds with ID, posted date, account, description, envelope, amount and review state. Its totals must reconcile with the same envelope/category and period in the summary.

Exclude transfers and confirmed duplicates from income and spending totals. Keep goal-related movements separate from both Fixed and flexible spending. Keep these entries inspectable through the weekly review.

Use Monday–Sunday weeks and calendar months. Require a Monday for an explicit `--week` value. Store posted dates as calendar dates, without timezone conversion.

Label current periods as **in progress**. All reports describe imported activity only. An empty period means **no imported activity**. Do not present totals as a bank balance, verified savings or proof that all accounts are complete.

### 4.6 Financial rules

| Case | Required behaviour |
|---|---|
| Money | Store and calculate integer pence. Parse decimal text exactly. Reject excess precision and unsafe integer values or totals. |
| Income and spending | Derive the initial movement from the confirmed source mapping. Keep movement, plan treatment, category and review state separate. |
| Refund | Keep movement `inflow` and purpose `refund` separate. Reduce spending in the selected treatment/category in the refund's posted period; never count it as income. Apply review state independently. |
| Transfer | Exclude it from income and spending after the user identifies it. Do not infer transfers from amount or description alone. |
| Credit-card settlement | Exclude it as a transfer when the underlying purchases are tracked or the user resolves its treatment. Keep uncertain payments visible and unresolved. |
| Duplicate | Exclude only a confirmed duplicate. Suspected duplicates remain in the unreviewed figures until resolved. |

[Financial Model §§3.3 and 11][financial] own refund accounting. A purchase link is optional; missing purchases do not prevent explicit refund classification. Later-month refunds do not rewrite earlier months. Allow negative net spending and reviewed remaining above the original limit; show gross spending and refunds separately. Unknown classifications remain visible. Plans do not change, and income-minus-net-spending calculations must not add refunds again.

## 5. Local data

Default location: `~/.kakeibo/store.json`.

| Stored information | Purpose |
|---|---|
| Schema version and currency | Validate compatibility and monetary units. |
| Accounts and CSV mappings | Reuse confirmed import settings. |
| Imports and source records | Preserve file hash, row/source ID, original values, mapping version, declared coverage/completeness, match decisions and source-row links to retained entries. |
| Savings goal and monthly plans | Preserve the goal's identity, user-selected allocation, status, confirmed contribution links, plan income, commitments, four envelope limits, intention and revision history. Derive contribution totals. |
| Entries | Preserve normalised values, movement, purpose, treatment, category, optional goal link, review state and duplicate decisions. |
| Weekly reviews | Preserve notes, closure records and the entry revision recorded at closure. |
| Change history | Explain explicit classification, confirmation and duplicate changes. |

Derive summaries from entries. Do not persist a second set of totals. Imported history must remain usable after the source CSV is deleted.

Validate the store before changes. Save each complete change through a temporary file and replacement. Keep the previous valid file as `store.json.bak`. Prevent concurrent writers.

A corrupt or unsupported store must produce an error. Never replace it with an empty store. Document recovery from the backup.

Data stays on the device. Use restrictive file permissions where supported. State that JSON is plain text. Do not send telemetry or commit personal CSVs, stores or backups. Use synthetic fixtures.

## 6. Implementation approach

Use two small workspace packages. `packages/domain` owns financial types, money/period calculations, planning, aggregation and review rules. `apps/cli` owns commands, prompts, CSV parsing, source reconciliation orchestration and JSON storage. Keep plain modules and a one-way dependency from CLI to domain. Domain code must not depend on terminal or filesystem code.

Preserve the conceptual ingestion boundary from [Architecture §9][ingestion]. Do not create an adapter registry, generic repository layer, dependency-injection framework or additional service.

| Tool | Use |
|---|---|
| [Commander][commander] | Commands, options, help and usage errors. |
| [csv-parse][csv-parse] | CSV parsing, including quoting and delimiters. |
| [@inquirer/prompts][inquirer] | Mapping choices, classification and confirmation. |
| Node.js built-ins | Files, hashes, paths and currency display. |
| pnpm, TypeScript and Vitest | Package management, compilation and focused tests. |

Use plain terminal tables. Add a library only when it removes meaningful custom code. Pin a supported Node.js LTS version and dependency versions during implementation. Defer Turborepo and additional packages until they are needed.

Add one GitHub Actions job for type-checking, tests and compilation. Document installation, the generic CSV format, the weekly workflow and backup recovery.

## 7. Acceptance and minimal tests

Use four focused unit-test groups:

| Group | Required evidence |
|---|---|
| Import | Valid mappings/sign conventions work; invalid rows fail. Exact and reordered overlapping reimports add nothing. Increased counts add only excess occurrences. Reduced counts, changed values, partial coverage and incompatible mappings require reconciliation. Legitimate identical purchases survive; reuse is reversible. |
| Calculations and plans | Plan amounts balance against the Savings goal allocation. Income, purchases, refunds, contributions, transfers, duplicate decisions and review states produce exact totals without double-counting. |
| Periods | Default periods, Sunday/Monday, month/year boundaries, cross-month reviews and later-month refunds place each entry against the correct period/plan. |
| Review state | Only confirmation creates reviewed truth. Closure preserves unresolved entries. Later changes flag the review without losing notes. |

Add one integration test for the JSON save/load lifecycle, invalid-import rollback and corrupt-store protection. Avoid coverage targets, terminal snapshots and tests of library internals.

Use a small numeric fixture: October plan income £500, fixed commitments £100 and savings allocation £100 leave £300 flexible. Allocate Needs £150, Wants £100, Culture £25 and Unexpected £25. A £50 Needs/Groceries purchase, a £20 Culture/Books purchase and a £10 Needs/Groceries refund result in Needs £40, Culture £20 and net flexible spending £60. A £200 transfer contributes zero to spending. When these entries are reviewed, Needs remaining is £110. If the refund posts in November instead, October Needs stays £50; November with no purchases shows £10 refunds and −£10 net spending. Refund income is zero in both cases. An unreviewed refund affects only unreviewed figures. Reject a plan whose envelopes total £299.

Release acceptance also requires one documented CLI walkthrough: plan the month, import, reimport, review, restart, reopen, inspect envelope status and drill down into a category. Run it in a temporary data directory with synthetic data. Record the supported Node.js version and operating system.

## 8. Source alignment

Baseline review: Kakeibo `main` at [`00d7d9e`][baseline] on 26 October 2026 contained specifications and scaffolding, with no executable application. Financial Model v1.2 in this change adds the refund and overlap rules used here.

| Source | Rules retained or scoped |
|---|---|
| [Product §§2, 5–7, 9–11, 15][product] | Monthly plan, four envelopes, import preview, explicit review, corrections, reflection and recovery. The CLI simplifies presentation. |
| [Financial Model §§3, 5–7, 9–12][financial] | Plan balance, single Savings goal, refunds, classification, reviewed truth, transfers and source/duplicate reconciliation. Richer goals and business scope are deferred. |
| [Architecture §§5, 9–10, 14–15, 19][architecture] | Ingestion separation, source traceability and consistent writes. Local JSON scopes the runtime for this release; financial logic retains the `packages/domain` boundary. |
| [Engineering §§3, 8–10][engineering] | Existing pnpm/Vitest choices and tests focused on financial risk. Cloud, API and mobile verification applies when those components are added. |
| [Specification index][spec-index] | Canonical specifications remain the owners of shared financial and product rules. |

[baseline]: https://github.com/sb-dev/kakeibo/tree/00d7d9e30c4ec65933533635b8d3b0a984e94bab
[roadmap]: roadmap.md
[product]: https://github.com/sb-dev/kakeibo/blob/00d7d9e30c4ec65933533635b8d3b0a984e94bab/docs/specs/01-product-and-ux-spec.md
[financial]: ../specs/02-financial-domain-model-spec.md
[savings]: ../specs/02-financial-domain-model-spec.md#61-simple-savings-and-richer-goals
[overlap]: ../specs/02-financial-domain-model-spec.md#103-overlapping-file-exports-without-stable-ids
[architecture]: https://github.com/sb-dev/kakeibo/blob/00d7d9e30c4ec65933533635b8d3b0a984e94bab/docs/specs/05-system-architecture-and-data-spec.md
[ingestion]: https://github.com/sb-dev/kakeibo/blob/00d7d9e30c4ec65933533635b8d3b0a984e94bab/docs/specs/05-system-architecture-and-data-spec.md#9-financial-sources-accounts-and-adapters
[engineering]: https://github.com/sb-dev/kakeibo/blob/00d7d9e30c4ec65933533635b8d3b0a984e94bab/docs/specs/06-engineering-delivery-and-operations-spec.md
[spec-index]: ../specs/README.md
[commander]: https://github.com/tj/commander.js
[csv-parse]: https://csv.js.org/parse/
[inquirer]: https://github.com/SBoudrias/Inquirer.js
