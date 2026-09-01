# Kakeibo — Financial Domain Model Spec

**Version:** 1.1  
**Date:** 2026-09-01  
**Status:** Canonical implementation spec

## 1. Purpose and authority

This spec defines the financial concepts, calculations, classification semantics, review truth and invariants used by Kakeibo.

Kakeibo uses a layered model:

```text
General financial core
        ↓
Kakeibo planning + optional financial goals
        ↓
Weekly review and user confirmation
        ↓
Trusted financial history
        ↓
Kei explanations and insights
```

The internal financial core may be richer than the vocabulary exposed in the UI. Product surfaces should reveal only the financial detail required for the current task.

This spec owns the financial core, its Kakeibo projection, financial goals, classification, review semantics, deterministic rules, splits, duplicates, totals, projections and domain invariants. Product & UX owns progressive disclosure and user journeys. Kei does not own canonical financial state.

This is a product-domain model, not financial advice. Kakeibo may calculate consequences of targets the user selected; it must not choose financial strategies for the user.

---

## 2. Layered domain model

### 2.1 General financial core

The core represents financial activity without forcing every entry into a Kakeibo envelope. It must support at least:

```text
income
personal spending
fixed commitments
transfers
credit-card repayments
debt repayments
business activity
goal contributions
adjustments
```

### 2.2 Kakeibo projection

Kakeibo is the primary user-facing planning model. Relevant personal activity is interpreted as:

```text
Fixed
Needs
Wants
Culture
Unexpected
```

Not every financial entry belongs to one of these treatments.

### 2.3 Financial goals

Financial goals are optional first-class concepts alongside the Kakeibo plan. Supported goal classes include:

```text
cash buffer
general savings
sinking fund
mortgage overpayment
debt reduction
investment contribution
pension contribution
custom goal
```

The domain supports them from the start; Product & UX controls when they are surfaced.

### 2.4 Weekly review

Weekly review is a trust layer over financial activity, not the financial model itself.

```text
financial meaning ≠ review state
```

An entry may have a strong prepared interpretation while remaining unreviewed.

---

## 3. Financial entries and classification

A **financial entry** is the canonical internal representation of one normalised imported or explicitly entered financial movement. Ordinary outflows may be called **spendings** in user-facing surfaces.

Minimum domain information:

```text
id
source account
source identity / provenance
date
raw amount
normalised movement
description
merchant / counterparty when known
financial classification
review state
preparation metadata
```

The original imported representation remains traceable after normalisation, classification, splitting or duplicate resolution.

### 3.1 Movement and source semantics

Source amount signs are not globally meaningful. A card purchase may arrive positive while a bank expense arrives negative. Source adapters determine movement while preserving the raw value.

Canonical movements:

```text
inflow
outflow
transfer
adjustment
```

Examples:

```text
salary                     → inflow
Tesco purchase             → outflow
current account → savings  → transfer
credit-card payoff         → transfer when card purchases are tracked
manual correction          → adjustment
```

### 3.2 Classification dimensions

Classification separates concerns rather than overloading one category field:

```text
movement
plan treatment
category
optional tags
optional financial goal
scope
```

Implementations may store these differently as long as the meanings remain distinct.

Canonical plan treatments:

```text
Fixed
Needs
Wants
Culture
Unexpected
Goal
Outside plan
Unclassified
```

`Goal` means the entry contributes to a user-selected goal. `Outside plan` means the entry is financially meaningful but does not consume a Kakeibo allocation.

Detailed categories are user-extensible from the start. Examples include `Needs / Groceries`, `Fixed / Housing`, `Goal / Cash buffer` and `Outside plan / Credit-card payment`.

Tags such as `coffee`, `children`, `commute` or `home` may support search and insights but never replace financial classification.

At minimum, scope distinguishes `personal` and `business`. Business entries may remain reviewable and exportable while staying outside the personal plan.

---

## 4. Existing-rule compatibility

The current implementation already contains useful semantics that should be preserved rather than discarded.

Existing categories include:

```text
essantial-expenses
optional-expenses
culture-and-leisure
extra-and-unexpected
income
credit-card-payoff
debt
business
```

Rules also carry subcategory, transaction type, tags, merchant association, priority and active state.

A migration may interpret them as:

| Existing meaning | Canonical interpretation |
|---|---|
| `essantial-expenses` + `fixed` | `Fixed` |
| `essantial-expenses` + ordinary expense | `Needs` |
| `optional-expenses` | `Wants` |
| `culture-and-leisure` | `Culture` |
| `extra-and-unexpected` | `Unexpected` |
| `income` | inflow, normally `Outside plan` until planning uses it |
| `credit-card-payoff` | transfer / `Outside plan` when underlying card activity is tracked |
| `business` | business scope / `Outside plan` |
| `debt` | preserve purpose, then distinguish required repayment from optional goal contribution |

Migration must remain auditable and must not silently rewrite historical meaning. The misspelled identifier `essantial-expenses` is a migration concern, not canonical vocabulary.

---

## 5. Monthly Kakeibo model

Canonical structure:

```text
Planning income
− Fixed commitments
− Plan-funded goal allocations
= Flexible spending budget

Flexible spending budget
→ Needs
→ Wants
→ Culture
→ Unexpected
```

Canonical formulas:

```text
flexible_spending_budget
  = planning_income
  - fixed_commitments
  - plan_funded_goal_allocations

envelope_limits_total
  = needs + wants + culture + unexpected

envelope_limits_total = flexible_spending_budget
```

The plan cannot be confirmed while the four envelopes do not allocate the full flexible budget. Kakeibo must not silently rebalance another envelope, commitment or goal.

### 5.1 Planning income

`planning_income` is explicit user-selected plan data. It is not automatically replaced by imported inflows.

Kakeibo may separately track reviewed observed income:

```text
planning income ≠ observed income
```

An unexpected bonus, refund or interest payment can therefore be recognised without rewriting the plan.

### 5.2 Fixed commitments

Fixed commitments are obligations expected before flexible spending decisions: rent, required mortgage repayment, council tax, utilities, insurance, contractual minimum repayments and other commitments the user marks as fixed.

They reduce the flexible budget, remain reviewable, do not consume a flexible envelope and are not fixed merely because a merchant repeats.

Required mortgage repayment and optional mortgage overpayment remain distinct:

```text
required repayment  → Fixed / Housing
optional overpayment → Financial goal when the user tracks it
```

### 5.3 Flexible envelopes

| Envelope | Meaning | Examples |
|---|---|---|
| Needs | necessary flexible spending | groceries, transport, household essentials |
| Wants | optional consumption and convenience | eating out, takeaway, shopping |
| Culture | enrichment, learning and recreation | books, cinema, museums, classes |
| Unexpected | unplanned flexible spending | urgent repair, one-off replacement |

These are planning categories, not moral labels.

---

## 6. Financial goals

A financial goal is an outcome or allocation the user deliberately chooses to track over time.

Minimum meaning:

```text
goal type / name
user-selected target
progress
optional current-month allocation
status
```

Templates may be offered, but the user chooses whether to create the goal and selects its target.

### 6.1 Simple savings and richer goals

The initial UX may present a single **Savings goal**. Internally this is a plan-funded financial goal and can later be expanded without changing the Kakeibo model.

```text
Simple
Savings goal £500

Expanded
Cash buffer             £300
Holiday sinking fund    £100
Mortgage overpayment    £100
Total goal allocation   £500
```

The richer model must not make the simple experience harder.

### 6.2 Plan-funded and tracking-only goals

A goal may be **plan-funded**, meaning its current-month allocation reduces the flexible spending budget, or **tracking-only**, meaning it is observed without consuming the current plan.

This prevents double-counting. For example, a workplace pension contribution should not reduce take-home planning income a second time when that income is already post-pension.

### 6.3 Goal contributions and progress

A reviewed financial entry may contribute towards a goal:

```text
current account → savings account
→ Goal / Cash buffer

optional extra mortgage payment
→ Goal / Mortgage overpayment
```

Goal progress may show target, reviewed progress, remaining amount and percentage when meaningful. Completing one goal must not cause Kakeibo to select the user's next goal.

---

## 7. Review truth and preparation

### 7.1 Review state

```text
unreviewed
reviewed
```

An entry becomes reviewed only through explicit individual, group or bulk user confirmation.

Rules, history, deterministic heuristics and Kei may prepare an entry but do not create reviewed truth.

### 7.2 Preparation state

| State | Meaning |
|---|---|
| needs decision | missing or ambiguous evidence requires attention |
| worth checking | a coherent suggestion exists but deserves confirmation |
| looks safe | strong low-attention evidence supports deliberate bulk confirmation |

These are attention states, not probability bands. `Looks safe` never means reviewed.

### 7.3 Skip terminology

Review `skip` means leave the entry unresolved for later.

The historical CLI rule option named `skip` has a different meaning: classify once without creating a reusable merchant rule. During migration, treat that older action as **classify once**, not as a review state.

---

## 8. Rules, history and groups

Retain the deterministic rule engine. Supported matching behaviour includes:

```text
equals
starts_with
ends_with
contains
regex
```

Active rules run in ascending explicit priority; the first matching rule wins. Rules may retain merchant association, category/subcategory, tags and transaction-type metadata.

A rule produces a **prepared interpretation**, not reviewed truth:

```text
rule match
→ prepared classification
→ attention state
→ user confirmation
→ reviewed classification
```

Rules are user-approved automation. A one-off correction may inform a proposed rule but must not silently create a broad rule.

Reviewed history may support future suggestions when comparable evidence exists. Corrections improve future evidence without rewriting reviewed history. Merchant identity is not proof of purpose.

Grouping is a review optimisation, not a classification. Group only coherent entries such as the same merchant, prepared classification, rule or recurring pattern; never group merely because entries share an envelope.

---

## 9. Transfers, credit cards and business activity

Transfers remain distinct from spending to avoid double-counting.

If individual card purchases are represented, the bank-account payment settling the card is normally:

```text
transfer / Outside plan
```

not a second spending amount. If Kakeibo cannot determine whether both sides are represented, preserve the entry and surface uncertainty rather than silently excluding it.

Existing business classifications also survive. Business entries may be represented as business-scope `Outside plan` activity: reviewable and searchable, but excluded from the personal Kakeibo plan.

---

## 10. Splits and duplicates

### 10.1 Splits

A financial entry may be split across purposes:

```text
sum(split amounts) = original entry amount
```

Examples:

```text
£40 Amazon
→ £25 Wants / Shopping
→ £15 Culture / Books

£2,200 mortgage payment
→ £2,000 Fixed / Housing
→   £200 Goal / Mortgage overpayment
```

Each split receives its own classification and optional goal link. Confirmed split parts drive totals; the original remains the audit source and must not also be aggregated.

### 10.2 Import idempotency vs financial duplicates

These are separate concepts:

| Case | Behaviour |
|---|---|
| same source record re-imported | idempotently avoid creating another canonical entry |
| distinct records look like the same real-world movement | create a duplicate candidate for review |
| user confirms a duplicate | exclude the confirmed duplicate from totals |

Prefer stable source identifiers. Fallback fingerprints must include enough source provenance to avoid collapsing legitimate same-day, same-amount activity.

---

## 11. Totals, projections and history

Track at least:

```text
planning income
reviewed observed income when available
fixed commitments planned / reviewed
plan-funded goal allocations
goal contributions reviewed
flexible spending planned / reviewed / unreviewed
projected flexible spending
projected end-of-month remainder
```

Each flexible envelope tracks limit, reviewed spend, unreviewed spend, reviewed remaining amount and pace when valid. Each active goal tracks target, progress, optional current-month allocation and reviewed contributions where meaningful.

Aggregation rules:

- reviewed totals contain only reviewed entries;
- transfers do not become spending merely because cash left an account;
- business activity does not consume personal envelopes;
- confirmed duplicates contribute zero;
- confirmed split parts replace the original;
- fixed commitments, goal allocations and flexible spending remain distinct;
- one amount must not contribute twice to the same financial result.

### 11.1 Pace projection

The first implementation may use:

```text
elapsed_ratio = elapsed_days / days_in_month
pace_projection = reviewed_flexible_spending / elapsed_ratio
```

Do not project before enough of the month has elapsed. Exclude transfers, business activity, duplicates and unreviewed entries from reviewed spend; keep unresolved activity visible alongside the projection.

### 11.2 Projected remainder / savings

```text
projected_remainder
  = planning_income
  - fixed_commitments
  - projected_flexible_spending
```

A simple UI may call this projected savings when the plan uses a single savings goal. It does not prove that money has already been transferred or saved.

### 11.3 Historical comparison

Use reviewed comparable history for merchant totals, recurring amounts, envelope pace and goal contribution consistency. Insufficient history must not produce `usual` or `normal` claims. Comparison is descriptive, not prescriptive.

---

## 12. Plan, goal and history changes

Current plan changes may affect flexible budget, goal allocations, remaining envelopes, pace and projections, but must not rewrite historical entries or prior-month plans.

Goal changes affect current or future planning according to the user's explicit choice. They must not rewrite previous contributions or historical targets.

Rule edits affect future preparation unless the user performs a separate explicit historical correction.

A closed weekly review may contain deliberately unresolved entries; closure does not convert them to reviewed.

---

## 13. Advice-sensitive boundaries and epistemic limits

Kakeibo may track user-selected cash buffers, savings, mortgage overpayments, debt reduction, investment contributions and pension contributions.

Preserve these distinctions:

```text
tracking ≠ recommending
calculation ≠ suitability judgement
required obligation ≠ optional goal
observed contribution ≠ advised contribution
```

Research values for investing percentages, emergency-fund sizes, mortgage rates, pensions or debt strategies are not canonical defaults.

Kakeibo also operates on incomplete evidence. Imported files may omit accounts; transfers may show only one side; planning income may differ from observed inflows; a projection is not a balance; a goal target is not proof of contribution; merchant recurrence is not proof that an entry is fixed.

The domain must preserve enough state for the product and Kei to communicate these limits.

---

## 14. Core invariants

```text
flexible_spending_budget
  = planning_income
  - fixed_commitments
  - plan_funded_goal_allocations

envelope_limits_total = Needs + Wants + Culture + Unexpected
envelope_limits_total = flexible_spending_budget

fixed commitments never consume flexible envelope limits
plan-funded goal allocations never also consume a flexible envelope
transfers never become flexible spending solely because cash left an account
business activity never consumes personal Kakeibo envelopes

reviewed totals contain only reviewed entries
needs decision / worth checking / looks safe do not mean reviewed
review skip does not mean reviewed
rules, heuristics and assistant suggestions do not create reviewed truth
first matching active rule wins according to explicit priority

sum(split amounts) = original entry amount
confirmed split parts replace the original amount in aggregates
re-importing the same source entry is idempotent
a duplicate candidate is not automatically excluded
confirmed duplicates contribute zero to aggregates

plan changes do not rewrite historical reviewed entries
goal changes do not rewrite historical contributions or targets
rule edits do not silently rewrite reviewed history

unreviewed activity remains separately visible
projected values remain explicitly projected
user-selected targets remain distinct from calculated consequences
one amount must not be counted twice across spending, transfer and goal aggregates
```

---

## 15. Acceptance criteria

The model is correct when:

- existing income, expense, credit-card-payoff, debt and business classifications can migrate without being forced into the four envelopes;
- existing priority-ordered rule behaviour and user-extensible subcategories can be preserved;
- source-specific amount signs do not determine financial meaning by themselves;
- transfers and credit-card payoffs can be excluded from spending without losing the financial entry;
- business activity remains reviewable without affecting the personal plan;
- the primary Kakeibo UX can stay simple while the internal financial model remains broader;
- fixed obligations, goal allocations and flexible envelopes cannot be double-counted;
- a simple savings goal can coexist with optional cash-buffer and other long-term goals;
- goals and targets remain user-selected;
- required mortgage repayment and optional overpayment remain distinct;
- preparation state cannot be confused with reviewed truth;
- the historical CLI `skip` behaviour cannot be confused with review skip;
- splits preserve value without counting the source twice;
- import idempotency and duplicate review remain distinct;
- reviewed and unreviewed totals remain distinct;
- projections and historical comparisons remain deterministic and explainable;
- plan and goal changes do not rewrite historical financial truth;
- Kei can explain domain facts without owning canonical calculations;
- researched financial strategies cannot silently become recommendations or defaults.

Core test:

> Can Kakeibo maintain one coherent financial truth underneath a simple weekly-review experience, support optional longer-term goals without double-counting money, and preserve user authority over every consequential financial interpretation and target?

---

*Kakeibo — Financial Domain Model Spec v1.1 · 1 September 2026*
