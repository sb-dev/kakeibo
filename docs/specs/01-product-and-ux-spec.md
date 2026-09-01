# Kakeibo — Product & UX Spec

**Version:** 1.1  
**Date:** 2026-09-01  
**Status:** Canonical implementation spec

## 1. Purpose and authority

Kakeibo is a Kakeibo-inspired money review and planning app built around a calm weekly ritual.

Its core job is:

> Turn everyday financial activity into a small number of useful review decisions, help the user plan intentionally, and progressively support longer-term financial goals without taking control away from them.

This spec owns product definition, scope, information architecture, user journeys, weekly review behaviour, monthly planning UX, import UX, product-level trust boundaries and the commercial model.

Other canonical specs own:

- `02-financial-domain-model-spec.md`: financial concepts, calculations, classifications and invariants.
- `03-kei-assistant-spec.md`: assistant-authored explanations, uncertainty, tone and suggestions.
- `04-mobile-design-system-spec.md`: visual language, components and mobile interaction treatment.
- `05-system-architecture-and-data-spec.md`: runtime architecture, APIs, persistence and security architecture.
- `06-engineering-delivery-and-operations-spec.md`: testing, CI/CD, environments, releases and operations.

When another spec owns a concept, this document defines its product meaning rather than duplicating its internal rules.

---

## 2. Product definition

Kakeibo is a review-and-planning product, not a dashboard-first finance application. The weekly Kakeibo ritual is the primary experience; deeper financial planning is progressively disclosed rather than presented upfront.

Lead with:

- what needs attention;
- what can be reviewed together;
- what already looks safe;
- how the month is tracking;
- what the user can do next.

Do not lead with raw transaction tables, dense analytics, large chart collections, financial optimisation claims or a generic AI chat interface.

The product has three connected layers:

```text
Weekly review
→ establish a trusted picture of everyday financial activity

Monthly Kakeibo plan
→ set intent and boundaries for current money

Optional long-term goals
→ give selected money a longer-term direction
```

The first two form the default early experience. Long-term goals are available from the start through deliberate navigation, but Kakeibo should normally introduce them progressively after the user has become comfortable with the weekly review ritual.

Canonical lifecycle:

```text
Plan the month
→ Import spending
→ Review brief
→ Resolve decisions
→ Check coherent groups
→ Confirm safe spendings
→ Scan the complete week
→ Close the review
→ Reflect briefly
```

The weekly review is the centre of the product experience.

---

## 3. Product principles

### 3.1 Lead with decisions, not data

Prefer `6 spendings need a decision · 4 groups are worth checking · 52 look safe` over `74 transactions imported`.

The first question is not how much data exists, but how much attention is required.

### 3.2 Group before listing

Default order:

```text
summary
→ decisions
→ coherent groups
→ safe spendings
→ complete weekly scan
→ item detail on demand
```

Do not make a transaction table the primary review interface.

### 3.3 One clear job at a time

Each step should make the current task obvious: plan, import, decide, check, confirm, scan, close or reflect.

### 3.4 Prepare work; do not hide it

Kakeibo may use rules, reviewed history and deterministic calculations to reduce review effort. The user must be able to understand what was suggested, why, what will change if confirmed and how to correct it.

### 3.5 User confirmation creates reviewed truth

`looks safe` means low attention, not already reviewed. A spending becomes reviewed only after an explicit individual, group or bulk user confirmation as defined by the Financial Domain Model.

Do not describe prepared spendings as `accepted automatically`.

### 3.6 Bulk actions must be safe

Before bulk confirmation, show how many spendings are affected, representative examples, why they look safe and how to inspect the full set. Provide undo where the operation remains safely reversible.

### 3.7 Preserve uncertainty

When evidence supports a likely choice, show it as a suggestion. When evidence is insufficient, ask the user rather than manufacture an answer. Kei-specific evidence rules live in the Kei Assistant spec.

### 3.8 Every insight should lead somewhere

A useful insight explains what changed or offers a directly relevant action, such as viewing affected spendings, reviewing a merchant, adjusting the user's plan or inspecting a rule.

Avoid passive analytics that exist only because the data can be charted.

### 3.9 Calm beats gamification

Avoid streak pressure, celebratory spending scores, shame-based warnings, competitive targets, fake urgency and manipulative nudging. Progress may be visible, but completion is not a game mechanic.

### 3.10 Use progressive disclosure

Start with the smallest useful money ritual. Do not ask a new user to configure every financial capability before they can benefit from Kakeibo.

Long-term goals and deeper planning remain available from the start, but should not compete with the weekly review during early use. When the user demonstrates familiarity with reviewing and planning, Kakeibo may surface a restrained suggestion to explore longer-term goals.

Progressive disclosure is not feature gating:

- no review count unlocks a feature;
- an interested user can deliberately access goals at any time;
- suggestions are optional and dismissible;
- Kakeibo does not infer which financial goal is suitable for the user;
- hiding or dismissing a suggestion does not reduce core functionality.

---

## 4. Information architecture

Kakeibo has four primary areas:

```text
Today
Review
Plan
Explore
```

**Today** shows current state and one useful next action.

**Review** imports and processes the weekly review. It is the strongest product destination.

**Plan** sets and maintains the current monthly Kakeibo plan and provides a deliberate route to optional long-term goals.

**Explore** inspects spendings, insights, rules and reflections when the user has a specific question.

Account, settings, subscription and privacy controls are utility surfaces. They must not displace the four primary areas without a deliberate product change.

---

## 5. Monthly planning

### 5.1 Purpose

Set monthly intent before reviewing spending against it.

Canonical structure:

```text
income
fixed commitments
goal allocation (simple savings goal by default)
flexible spending budget
Needs / Wants / Culture / Unexpected
monthly intention
```

Fixed commitments are visible in the plan but sit outside the four flexible envelopes. Financial formulas and invariants are owned by the Financial Domain Model.

### 5.2 Experience

The user should understand:

- what money is already committed;
- what they want to allocate towards selected financial goals, with a simple savings goal as the default experience;
- what remains for flexible spending;
- how they want to allocate that spending;
- what intention they want to remember this month.

The plan should feel like setting intent, not filling in a spreadsheet.

### 5.3 Changes

Changing an envelope, goal allocation or another plan input must show the resulting trade-off before confirmation. Plan changes affect the current plan and must not rewrite historical financial activity or past review decisions.

### 5.4 Long-term goals

Long-term goals are optional first-class capabilities that sit alongside the monthly Kakeibo plan. Examples include:

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

The user chooses whether to create a goal and chooses its target. Kakeibo may explain what a goal tracks, show progress against the user's target and calculate the effect of a user-selected monthly allocation. It must not decide which goal the user should pursue.

Goals should normally appear as a secondary destination from Plan rather than a new primary navigation tab. This keeps the Kakeibo ritual dominant while making deeper planning deliberately accessible.

A goal can influence the current monthly plan when the user deliberately allocates current money towards it. The Financial Domain Model owns those semantics.

### 5.5 Progressive introduction of goals

A user who wants long-term planning may access it immediately. Otherwise, Kakeibo should wait until the weekly review appears familiar before introducing it contextually.

Use behavioural evidence rather than a fixed unlock threshold. Signals may include repeated completed reviews, regular return to Review, fewer unresolved items and deliberate use of Plan. These signals determine when to surface the capability, not whether the capability exists.

A suitable prompt is bounded and optional:

```text
Your weekly reviews are becoming consistent.
You can also use Kakeibo to track longer-term goals such as building a cash buffer.

[Explore goals]  [Not now]
```

Do not:

- automatically create a goal;
- prescribe the next goal;
- frame deeper planning as a reward for completing reviews;
- repeatedly nag after dismissal;
- turn financial progress into an engagement mechanic.

---

## 6. Financial activity import

### 6.1 Purpose

Import financial activity and prepare relevant entries for review. CSV is the initial ingestion mechanism.

The user should feel that they are preparing a review, not manipulating database records.

### 6.2 Recognition

The user selects a bank or credit-card CSV and, where necessary, the source account. Recognise common file structures automatically where possible. Hide column mapping and parsing controls unless recognition fails or the user asks to inspect them.

### 6.3 Preview

Before import, show at least:

- recognised account and period;
- new financial entries, summarised in user-facing language appropriate to their type;
- possible duplicates;
- rows that need fixing;
- a clear `Import and prepare review` action.

Possible duplicates and malformed rows are findings, not silent corrections.

### 6.4 Long-running preparation

If preparation continues after upload, communicate what is happening, whether the user may leave safely, whether progress is preserved and what happens if preparation fails. Durable execution details belong to the architecture spec.

---

## 7. Weekly review

The weekly review has eight stages:

```text
1. Import Spending
2. Review Brief
3. Decisions
4. Group Checks
5. Looks Safe
6. All Spendings Scan
7. Weekly Summary
8. Optional Reflection
```

This is a guided sequence, not a locked wizard. The user may move between review lanes, inspect details and return later without losing confirmed progress.

### 7.1 Review Brief

Purpose: make the workload feel bounded.

Show:

- review period;
- number needing a decision;
- number of groups worth checking;
- number that look safe;
- total imported spendings;
- a small number of focus areas;
- recommended starting lane.

The brief should answer:

```text
How much work is this?
Why does anything need my attention?
Where should I start?
```

### 7.2 Decisions

Purpose: resolve high-attention spendings one at a time.

Show merchant, amount/date/account, why attention is required, a likely classification when evidence supports one, a small number of alternatives, and visible actions for accept, change, split, skip and details.

Do not expose the entire category taxonomy by default. Detail may reveal raw description, relevant reviewed history and the evidence needed to decide.

### 7.3 Group Checks

Purpose: reduce repeated decisions by reviewing clearly coherent spendings together.

Group by merchant or another pattern that preserves meaning. Never group merely because items share an envelope.

Show group name, item count and total, suggested classification, why it is worth checking, a compact item list, and actions to accept, change, review individually or create a rule.

Grouping must reduce effort without hiding meaningful differences.

### 7.4 Looks Safe

Purpose: inspect low-attention spendings without forcing item-by-item review.

A safe set may be prepared from explicit user-approved rules, stable reviewed history or other deterministic evidence defined by the domain model.

Show number of spendings, representative examples, a short reason, `Confirm all` and `Inspect list`.

Confirmation is explicit. The user remains the actor who converts these spendings to reviewed state.

### 7.5 All Spendings Scan

Purpose: inspect the complete week without turning every spending into a separate task.

This is a weekly receipt, not a transaction table.

Default structure:

- grouped by day;
- compact rows;
- short attention labels;
- filters;
- item detail on demand.

Useful labels include `new`, `changed`, `rule`, `above normal`, `duplicate?` and `skipped`.

Useful filters include `All`, `Flagged`, `Changed this review`, `By day` and `By Kakeibo envelope`.

Raw bank descriptions and implementation metadata stay behind detail unless needed.

### 7.6 Closing the review

The user should understand what has been reviewed, what remains skipped or unresolved, whether any spending is excluded as a confirmed duplicate and what will be included in the summary.

Do not hide unresolved state merely to make the review appear complete.

### 7.7 Weekly Summary

Purpose: close the review with meaning rather than completion statistics alone.

The summary should answer:

```text
What happened?
What mattered?
What stayed stable?
What might be useful next week?
```

Show concise completion context followed by a short explanation of the week. Canonical financial facts come from deterministic domain calculations; assistant-authored interpretation follows the Kei Assistant spec.

### 7.8 Weekly Reflection

Reflection is optional, short and practical. Show relevant weekly context and no more than two lightweight prompts, such as:

```text
One sentence about the week
Anything you want to change next week?
```

Do not turn the weekly review into long-form journalling or therapy-like questioning.

---

## 8. Today

Purpose: show current status and one next useful action.

Recommended structure:

```text
month status
weekly review status
one main signal
one primary action
```

A representative Today surface may show projected savings against target, the current weekly review workload, one Kei observation and `Review this week` as the primary action.

Do not show a full transaction feed, dense chart wall, every available insight or multiple competing alerts.

When no review is due, surface the most relevant plan, import or review action rather than inventing engagement content.

---

## 9. Month Status

Purpose: show whether the current month remains aligned with the user's plan.

Show:

- projected savings vs target;
- fixed commitments status;
- reviewed flexible spending vs plan;
- unreviewed flexible spending;
- envelope status;
- one main insight;
- one relevant action.

The Financial Domain Model owns projected-savings and status semantics.

Month Status is a focused progress view, not the home screen and not a general analytics dashboard.

---

## 10. Explore

Explore is for inspection and specific questions outside the main review flow. It begins with destinations rather than raw history:

```text
Spendings
Insights
Rules
Journal
```

### 10.1 Spendings

Search and inspect history by merchant or description, envelope, category, week/period, account and attention/review state. Do not open Explore into an unfiltered transaction table.

### 10.2 Insights

Show a small number of meaningful patterns derived from canonical data. Each insight should explain the pattern and offer a relevant next action when one exists.

Insights are secondary to the weekly review and must not become a competing dashboard system.

### 10.3 Rules

The user may inspect, create, edit and disable categorisation rules. Rule management should not interrupt the weekly review unless directly useful to the current decision.

A rule is user-approved automation. The Financial Domain Model owns its effect on classification and reviewed history.

### 10.4 Journal

Revisit weekly and monthly reflections. Journal is for recall and behaviour learning, not long-form writing or an open-ended diary product.

---

## 11. Classification, correction and splits

Product language uses **spending** for ordinary imported outflows. The internal financial model is broader and may also represent income, transfers, goal contributions and other financial activity without exposing implementation terminology to the user.

Flexible classification uses `Kakeibo envelope / category`. Fixed commitments remain separate from the four flexible envelopes.

The Financial Domain Model owns classification, splits, duplicate handling and related invariants. The UX must preserve these behaviours:

- the user can correct a suggested classification;
- splits remain traceable to the imported source spending;
- corrections inform future evidence without rewriting reviewed history;
- confirmed duplicates are explicitly user-resolved;
- reviewed and unreviewed money remain distinguishable.

---

## 12. Kei in the product

Kei is the quiet assistant inside Kakeibo. Kei prepares review context, explains what deserves attention and turns reviewed spending into small useful observations.

Kakeibo owns workflow, canonical financial state, user actions, navigation and review completion.

Kei owns assistant-authored explanations, observations, summaries and bounded suggestions.

The initial product does not include a general-purpose Kei chat screen. Kei should appear only where extra context helps the current task, and the user must be able to complete the core product without conversing with Kei.

---

## 13. Trust, control and financial-guidance boundary

### 13.1 User authority

Kakeibo helps the user organise, inspect, compare, review and track their own financial plan.

The user remains the authority over plan targets, long-term goals, goal targets, classification decisions, rule creation, split decisions, duplicate resolution, review confirmation and behavioural intentions.

### 13.2 Product positioning

Kakeibo is a personal-finance organisation and spending-review tool. It must not position itself as a financial adviser, investment adviser, wealth manager, automated adviser or service that chooses the best financial action for the user.

### 13.3 Choice language

Prefer `choose`, `compare`, `track`, `review`, `inspect`, `set a target`, `adjust` and `consider`.

Avoid `you should`, `best for you`, `recommended for you`, `optimal`, `correct next step` and `we advise` when they imply personal financial suitability.

Factual plan observations are valid. For example:

```text
Wants is projected above the limit you set.
```

This is different from advice-like wording such as:

```text
You should reduce Wants and invest the difference.
```

### 13.4 Advice-sensitive subjects

Investment, pension, tax, debt, mortgage and financial-product **recommendations** are outside the product's decision-making scope.

User-controlled goals in advice-sensitive areas may be tracked when the user deliberately creates them. Kakeibo may calculate progress and explain the user's selected target, but it must not convert tracking into a suitability recommendation.

A disclaimer must never be used to justify advice-like product behaviour.

### 13.5 Data trust

Imported data may be incomplete or stale. Do not imply a complete, live or authoritative view of the user's finances unless the data source genuinely supports it.

Kakeibo does not move the user's money.

---

## 14. Commercial model

Kakeibo is a paid product. The business model should reinforce trust rather than monetise financial attention.

Canonical principles:

```text
no permanent free tier
no free trial
one primary paid plan
annual-first pricing
monthly option may remain available
30-day money-back guarantee
Kei included with reasonable fair-use controls
no advertising-funded product model
no selling financial data
```

Current pricing baseline:

```text
Annual   £59.99 / year
Monthly   £6.99 / month
```

An early-access annual price such as `£49 / year` may be used as a launch offer. Exact price points are commercial configuration and may change without altering the product architecture.

The paid value is the complete review habit, not access to a quantity of AI messages. Do not charge per Kei message in the core experience.

Primary positioning:

> Kakeibo turns messy bank and credit-card spending into a calm weekly review, with Kei explaining what deserves attention.

Primary purchase/reassurance pattern:

```text
Start your first review
30-day money-back guarantee
```

Billing implementation belongs to the relevant engineering spec and product configuration.

---

## 15. Errors, empty states and recovery

Errors should explain what happened, why it matters, what the user can do next and whether anything changed.

Never leave the user uncertain about whether a financial mutation succeeded.

Empty states point to the next useful action. Example:

```text
No spending imported yet.
Import a bank or credit-card CSV to prepare your first weekly review.
[Import spending]
```

Interrupted review work should resume from durable confirmed state rather than forcing the user to repeat completed decisions.

If a bulk change can be safely reversed, make recovery obvious.

---

## 16. Cross-surface interaction rules

Presentation details belong to surface-specific design specs, but all clients must preserve the same product semantics.

Core actions must not rely on hidden gestures, keyboard-only shortcuts, colour alone or assistant interpretation.

Accelerators may exist, but must never be the only way to perform a core action.

The same action must mean the same thing across clients. For example, `Confirm all` always represents explicit confirmation of the shown safe set; it must not silently include unresolved decisions from another lane.

---

## 17. Current product boundary

The canonical current product includes:

- monthly Kakeibo planning;
- CSV financial-activity import;
- review preparation;
- weekly review;
- categories and splits;
- user-approved rules;
- reviewed financial history;
- month status;
- focused insights;
- weekly/monthly reflection;
- optional user-selected long-term financial goals;
- progressive disclosure of deeper planning;
- Kei contextual assistance;
- paid subscription access.

Long-term goals may include cash buffers, savings, sinking funds, mortgage overpayments, debt reduction, investment contributions, pension contributions and custom goals. Their presence does not make Kakeibo a wealth adviser: the user selects the goal and target, while Kakeibo tracks and explains progress.

The following remain outside the current product boundary:

- personalised investment allocation advice;
- pension optimisation or suitability recommendations;
- recommendations to overpay a mortgage;
- debt-strategy recommendations;
- automatic next-goal selection;
- full personal balance-sheet or portfolio management;
- insurance recommendations;
- personalised tax planning;
- borrowing-against-assets strategies;
- financial-product recommendations;
- household/shared finance unless separately specified;
- open-ended `chat with your finances`.

Do not expand primary navigation merely because a capability exists. Progressive disclosure should deepen the product without weakening the weekly-review centre.

---

## 18. Acceptance criteria

The Product & UX design is correct when:

- a new user understands Kakeibo as a weekly spending-review product rather than a general finance dashboard;
- the weekly workload is understandable in under ten seconds;
- imported spending is prepared before the user sees a long list;
- the user is not forced through every spending individually;
- important decisions can be resolved one at a time;
- coherent spendings can be confirmed as groups without hiding meaningful differences;
- low-attention spendings can be inspected and explicitly confirmed in bulk;
- every spending remains inspectable;
- every confirmed financial mutation clearly belongs to the user;
- the user can understand why attention or a classification was suggested;
- the complete week can be scanned before review closure;
- the weekly summary explains the week rather than only reporting totals;
- reflection remains lightweight and optional;
- Today consistently prioritises one next useful action;
- Plan separates fixed commitments, user-selected goal allocations and flexible Kakeibo envelopes;
- long-term goals are deliberately accessible from the start without competing with the early review habit;
- deeper planning is progressively surfaced without fixed unlocks, nagging or gamification;
- Explore remains secondary to the review habit;
- financial observations stay factual and tied to user-selected targets;
- Kakeibo does not drift into personalised investment, tax, debt or product advice;
- Kei adds clarity without becoming the primary product interface;
- the commercial model does not depend on advertising, selling financial data or charging per assistant message;
- future wealth-management ideas cannot silently expand current product scope.

Core test:

> Can a user turn a normal week of imported spending into a trusted, understandable review without feeling overwhelmed, judged or removed from the decision loop?

---

*Kakeibo — Product & UX Spec v1.1 · 1 September 2026*
