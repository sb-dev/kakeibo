# Kakeibo — Mobile Design System Spec

**Version:** 1.0  
**Date:** 2026-09-01  
**Status:** Canonical implementation spec

## 1. Purpose and authority

This spec defines Kakeibo's canonical mobile visual system, interaction patterns, navigation treatment, reusable product components, accessibility requirements and progressive-disclosure patterns.

Kakeibo should feel like a calm weekly money ritual rather than a bank dashboard, trading app or spreadsheet.

Visual character:

```text
warm · clean · spacious · focused · trustworthy · minimal · human
```

Avoid:

```text
neon finance styling · dense chart walls · aggressive warnings
streak gamification · spreadsheet-like tables · mascot overload
feature overload
```

This spec owns mobile presentation, interaction hierarchy, reusable mobile product components, navigation treatment, progressive-disclosure presentation, accessibility and the visual treatment of review, planning, goals and Kei.

Other canonical specs own:
- `01-product-and-ux-spec.md`: product journeys, information architecture and when capabilities are surfaced;
- `02-financial-domain-model-spec.md`: financial meaning, calculations, review truth and goal semantics;
- `03-kei-assistant-spec.md`: Kei-authored language, evidence and advice boundaries;
- `05-system-architecture-and-data-spec.md`: implementation architecture, persistence and API behaviour;
- `06-engineering-delivery-and-operations-spec.md`: testing, delivery and operational requirements.

This document controls **how canonical product concepts are presented on mobile**, not their underlying financial meaning.

---

## 2. Design principles

### 2.1 Weekly review is the visual centre

Review remains the strongest destination. Lead with what needs attention, what looks safe, what remains unresolved, what changed and what to do next. Do not lead with raw volume, transaction tables or dashboard density.

### 2.2 Progressive disclosure over feature exposure

The interface distinguishes:

```text
capability exists
≠
capability needs attention now
```

Long-term goals remain directly accessible but should not dominate early use.

### 2.3 One clear job per surface

A screen or sheet should normally ask the user to review, decide, confirm, inspect, plan, adjust, set a goal or understand progress. Avoid combining unrelated decisions into one card.

### 2.4 Inspectable automation

Show what Kakeibo prepared, why, what the user is about to confirm, how to inspect more and how to change or undo where appropriate.

### 2.5 Calm over gamification

Progress communicates state, not performance. Avoid streaks, points, badges, confetti, shame-based states and competitive savings language.

### 2.6 Product vocabulary over implementation vocabulary

Prefer `spending`, `review`, `goal`, `contribution`, `transfer`, `income`, `plan`, `looks safe` and `needs a decision`. Do not expose `financial entry`, `movement type`, `plan treatment`, confidence scores, pipelines or model outputs.

---

## 3. Visual system

### 3.1 Colour roles

**Paper:** warm off-white background and large surfaces.  
**Ink:** deep charcoal/navy for primary text and navigation.  
**Warm grey:** borders, separators and secondary surfaces.

**Brand orange:** Kakeibo identity, small highlights, Kei's visual family and restrained capability-introduction accents. Orange does not indicate financial risk.

**Review green:** confirmed, reviewed, on-track and primary review actions. Green means confirmed or aligned, not morally good.

**Attention amber:** needs attention, worth checking, slightly at risk and incomplete-but-recoverable states.

**Risk red:** genuine destructive or failure states such as failed imports or critical data problems. Do not use it merely because spending is above pace.

A secondary blue/lilac may support inspect, search and information surfaces but remains subordinate.

Never communicate state with colour alone.

### 3.2 Typography

Use platform system fonts:

```text
iOS      SF Pro
Android  Roboto
```

Use large legible numerals for money values, review workload, goal progress and plan totals. Use plain compact labels for supporting detail. Hierarchy comes primarily from size, weight, spacing and grouping.

### 3.3 Shape and spacing

Recommended geometry:

```text
cards           16–24 px radius
buttons         12–18 px radius or pill
bottom sheets   20–28 px top radius
chips           pill
```

Use generous section spacing, compact card internals, minimal borders and subtle surface separation. Dense rows are reserved for All Spendings, detailed history and contribution history.

---

## 4. App shell

Canonical navigation:

```text
Today
Review
Plan
Explore
```

**Today:** current state and one useful next action.  
**Review:** weekly review inbox and flow; strongest tab.  
**Plan:** monthly Kakeibo plan plus deliberate access to long-term goals.  
**Explore:** spendings, insights, rules and journal.

Account, billing, privacy and settings remain utility destinations unless Product & UX changes the information architecture.

Preferred navigation depth:

```text
Tab
→ destination
→ focused detail
→ bottom sheet for edit / confirmation
```

Avoid deep stacks of nested finance screens.

---

## 5. Today

Today is a calm status surface, not a dashboard wall.

Recommended hierarchy:

```text
date / greeting
month status
weekly review status
one main signal
one primary action
optional secondary capability prompt
```

Representative state:

```text
Today
Thursday 28 May

May plan
£460 projected savings
£500 target
Slightly at risk

Weekly review
6 decisions
4 groups to check
52 look safe

Kei noticed
Wants is running fast, mostly from food delivery.

[Review this week]
```

Do not show multiple competing charts, raw transaction feeds, every active goal, multiple Kei cards or several equal-weight alerts.

When a review is due, it normally remains the primary action. When no review is due, Product & UX may select the most relevant plan, import or goal action.

---

## 6. Progressive capability introduction

Progressive disclosure is presentation, not feature gating. Long-term goals remain accessible from Plan at any time.

When Product & UX decides to introduce deeper planning, use a restrained secondary card:

```text
Longer-term planning

Kakeibo can also track goals such as building a cash buffer or saving for something specific.

[Explore goals]
Not now
```

Requirements:
- visually secondary to the current core task;
- dismissible;
- no urgency or reward language;
- no claim that anything was unlocked;
- no preselected goal;
- no suggestion that the user is financially ready for a particular goal.

Avoid:

```text
You've completed 4 reviews — Goals unlocked!
Next step: Build a 6-month cash buffer.
```

Product & UX owns the trigger. This spec owns the presentation pattern.

---

## 7. Review tab and Review Brief

The Review tab should feel like a small inbox.

Header:

```text
Weekly Review
20 May — 26 May

6 decisions
4 groups to check
52 look safe
```

Canonical lanes:

```text
Decisions · Groups · Looks Safe · All
```

The user may jump between lanes. `Decisions` is the recommended start when high-attention items exist.

Show progress descriptively, for example `18 of 24 reviewed`. Avoid scores, streaks or performance framing.

The Review Brief should make workload understandable quickly. Show the period, decisions, groups, looks-safe count, duplicate count when relevant, short focus explanation and recommended starting lane.

Example:

```text
Your review is ready

6 need a decision
4 groups are worth checking
52 look safe

Amazon has mixed history.
One possible duplicate needs checking.

[Start with decisions]
```

Avoid long AI summaries, charts, confidence percentages and detailed transaction lists before review starts.

---

## 8. Decision Card

Decision cards should feel focused, not form-like.

```text
Decision 3 of 6

Amazon Marketplace
£24.99
Friday · Barclaycard

Why this needs a decision
Amazon has been used for different categories before.

Most likely
Wants / Shopping

[Accept]
Change · Split · Details
```

Use one strong primary action. Secondary actions remain quieter.

Possible actions: `Accept`, `Change`, `Split`, `Skip`, `Details`.

Do not show the full category tree by default. Category selection normally belongs in a bottom sheet.

Optional swipe gestures may accelerate visible actions but must never be required.

---

## 9. Group Check

Group checks should feel like approving a coherent bundle.

Collapsed:

```text
Pret A Manger
4 spendings · £23.70
Wants / Eating out
Higher than recent reviewed weeks
```

Expanded:

```text
Wed   £4.80
Thu   £6.20
Fri   £5.90
Sun   £6.80
```

Primary actions: `Accept group`, `Change group`. Secondary actions may include `Review individually`, `Create rule` and `Details`.

Grouping must reduce repeated work without hiding meaningful differences. Never group items merely because they share an envelope.

---

## 10. Looks Safe

Looks Safe exists to build trust in low-attention automation.

```text
52 spendings look safe

Examples
Tesco     3 · £64.20 · Needs / Groceries
TfL       5 · £38.40 · Needs / Transport
Spotify   1 · £10.99 · Culture / Subscription

Why safe
Matched explicit rules or stable reviewed history.

[Confirm all]
Inspect list
```

Before bulk confirmation, show the exact count, representative scope and a reminder that items remain editable. After confirmation, provide lightweight undo where technically valid.

Never describe these items as already reviewed before confirmation.

---

## 11. All Spendings

All Spendings is the weekly receipt.

Use sticky day headers, compact rows, filter chips, short labels, bottom-sheet detail and search where useful.

```text
All · Flagged · Changed · By group

Monday · £42.10
Tesco       £28.40   Needs
TfL          £8.50   Needs
Pret         £5.20   Wants

Tuesday · £18.99
Spotify     £10.99   Culture   rule
Amazon       £8.00   Culture   changed
```

Avoid raw bank descriptions and spreadsheet columns by default.

Useful labels may include `new`, `changed`, `rule`, `duplicate?`, `skipped`, `goal` and `transfer`.

Use broader labels only when they help the user. Do not expose internal classification fields.

---

## 12. Spending and broader financial activity

The internal financial model is broader than the user-facing spending vocabulary.

For ordinary outflows, prefer **spending**.

Where broader activity matters, use ordinary-language labels:

```text
Income
Transfer
Goal contribution
Credit-card payment
Business spending
```

Do not force every activity into the four Kakeibo envelopes.

Example:

```text
Amex payment
£620
Transfer
Not counted as spending
```

The Financial Domain Model owns the semantics. Mobile presentation should expose only the meaning needed for the current task.

---

## 13. Plan

Plan should feel like setting intent, not completing a spreadsheet.

Default structure:

```text
May Plan

Income
Fixed commitments
Goal allocation
Flexible spending

Needs
Wants
Culture
Unexpected

Monthly intention
```

Representative summary:

```text
May Plan

Income                  £3,200
Fixed commitments       £1,850
Goal allocation           £500
Flexible spending         £850

Needs                     £400
Wants                     £200
Culture                   £100
Unexpected                £150
```

The simple early experience may label a single general goal allocation **Savings goal**.

Fixed commitments remain visible but visually separate from flexible envelopes.

Each envelope may show limit, reviewed spend, unreviewed spend where relevant, remaining and plain-language status.

Editing an envelope or goal allocation must show the trade-off immediately.

---

## 14. Plan hierarchy and long-term goals

Long-term goals belong under Plan, not as another primary tab.

Recommended hierarchy:

```text
Plan

This month
  Current monthly plan
  Kakeibo envelopes
  Monthly intention

Long-term goals
  Secondary destination
```

Early in use, the monthly plan visually dominates.

A deliberate goals entry point may be:

```text
Long-term goals

Track a cash buffer, savings target or another goal.

[View goals]
```

When opened, goals use a dedicated destination rather than being forced into the monthly plan screen.

---

## 15. Long-term Goals destination

The destination should be calm and optional.

```text
Long-term goals

Active
Cash buffer
£2,100 of £6,000

General savings
£800 of £2,000

Explore another goal
```

Do not begin with a large checklist of every possible goal.

Use progressive narrowing:

```text
What do you want to track?

Build cash
Save for something
Reduce a balance
Track a contribution
Create a custom goal
```

Reveal only the relevant next choices.

The user chooses the goal and target. Do not preselect financially consequential options.

---

## 16. Goal Card and Goal Detail

A Goal Card communicates progress without becoming a scorecard.

Recommended content:
- goal name;
- user-selected target;
- reviewed progress;
- remaining amount;
- optional time target;
- current-month allocation when relevant;
- one primary action.

Example:

```text
Cash buffer

£2,100 of £6,000
£3,900 remaining

September allocation
£300

[View goal]
```

Avoid celebratory ranking, arbitrary completion scores, generic motivation and red failure states merely for slow progress.

Goal Detail may show:

```text
goal name and purpose
user-selected target
reviewed progress
remaining
current-month allocation
reviewed contributions
history
edit goal
pause / archive when supported
```

If progress is incomplete because not all accounts are represented, show that limitation near the value it qualifies.

---

## 17. Goal setup

Goal setup should use progressive disclosure rather than a large financial questionnaire.

Preferred sequence:

```text
Choose goal type
→ enter target
→ optional time target
→ optional current-month allocation
→ review
→ confirm
```

Example:

```text
Cash buffer

Target amount
[ £6,000 ]

Monthly allocation
[ £300 ]   Optional

[Create goal]
```

Use neutral language:

```text
Your target
Amount you want to track
Allocation you want to plan
```

Avoid:

```text
Recommended target
Optimal contribution
Best debt strategy
```

For advice-sensitive goals, presentation remains tracking-oriented and user-controlled.

---

## 18. Goal contribution treatment

When reviewed activity contributes to a goal, show that relationship clearly without presenting it as ordinary flexible spending.

```text
Transfer to savings
£300

Cash buffer contribution
Reviewed
```

A contribution may appear in goal history, the weekly scan, a relevant summary or Month Status.

Do not visually count it as Needs, Wants, Culture or Unexpected unless the Financial Domain Model explicitly gives it that role.

---

## 19. Month Status

Month Status remains focused rather than becoming a financial dashboard.

Show:
- projected savings or equivalent plan outcome;
- fixed commitments;
- reviewed and unreviewed flexible spending;
- Kakeibo envelope status;
- current goal allocation when useful;
- one main insight;
- one relevant action.

Example:

```text
September plan

Flexible spending
£412 reviewed / £850 planned
£86 unreviewed

Needs        £220 / £400   on track
Wants        £126 / £200   running fast
Culture       £36 / £100   on track
Unexpected    £30 / £150   low

Goal allocation
£300 to Cash buffer
```

Do not expand this into full balance-sheet or investment reporting.

---

## 20. Explore

Explore remains a small library for specific questions.

Canonical destinations:

```text
Spendings
Insights
Rules
Journal
```

**Spendings:** search and inspect history using user-facing dimensions.  
**Insights:** small list of meaningful patterns with relevant actions.  
**Rules:** inspect, create, edit and disable user-approved automation.  
**Journal:** revisit weekly and monthly reflections.

Long-term goals belong primarily under Plan rather than being duplicated in Explore.

---

## 21. Kei visual treatment

Kei should be recognisable without becoming a mascot.

Use a small rounded avatar, warm cream/peach treatment, restrained orange detail, short assistant card and brief attribution such as `Kei noticed` or `Kei suggests`.

```text
[small Kei avatar]  Kei noticed

Wants is running fast, mostly from food delivery.
```

Avoid large persistent mascot art, speech bubbles on every screen, constant animation, celebration states, multiple unsolicited assistant cards and assistant UI that competes with the current task.

When Kei introduces long-term goals, the visual treatment remains secondary and dismissible.

---

## 22. Reusable product components

Canonical patterns:

```text
StatusCard
ReviewWorkloadCard
KeiNote
DecisionCard
GroupCheckCard
EnvelopeCard
GoalCard
GoalProgress
CapabilityPrompt
SpendingRow
FinancialActivityRow
DayGroup
FilterChip
BottomSheet
PrimaryButton
SecondaryAction
ProgressPill
StatusLabel
UndoToast
EmptyState
ErrorState
```

Components preserve Kakeibo's information hierarchy rather than forming a generic card framework with excessive variants.

Add a new component only when the interaction is meaningfully different.

---

## 23. Action hierarchy and bottom sheets

Use one obvious primary action per focused surface.

Examples:

```text
Review this week
Accept
Confirm all
Save plan
Create goal
Adjust allocation
```

Secondary actions use quieter controls.

Destructive actions must be clearly labelled, visually distinct and confirmed where consequences are substantial.

Bottom sheets are appropriate for focused reversible edits such as category changes, spending details, splits, rule creation, bulk confirmation, small plan adjustments, goal targets and short explanations.

Use a full screen when the task contains several sequential decisions, substantial history or context that would be cramped in a sheet.

---

## 24. Interaction feel

Use:
- inline expansion for compact detail;
- bottom sheets for focused edits;
- subtle haptic feedback on confirmation;
- small progress transitions;
- clear undo after eligible bulk actions;
- predictable back navigation.

Avoid:
- modal overload;
- confirmation for every trivial action;
- hidden swipe-only actions;
- heavy chart animation;
- celebratory gamification;
- long chained forms.

The weekly review should remain practical for mostly one-handed use.

---

## 25. Long-running work and recovery

Long-running imports or review preparation should communicate state clearly:

```text
Uploading file
Preparing review
Checking existing rules and history
Review ready
```

Show what is happening, whether the user may leave, whether progress is saved and what happens next.

Do not fabricate exact percentages where duration cannot be estimated reliably.

If the user leaves, returning should land on a stable status surface.

Errors should answer:

```text
What happened?
Why does it matter?
What changed?
What can I do next?
```

Empty states point to the next useful action without pressure.

Example:

```text
No spending imported yet.

Import a bank or credit-card CSV to prepare your first weekly review.

[Import spending]
```

Goal empty state:

```text
No long-term goals yet.

You can create one when you want to track something beyond the monthly plan.

[Explore goal types]
```

---

## 26. Accessibility

The mobile product must:
- never communicate state with colour alone;
- maintain platform-appropriate contrast;
- support dynamic text sizes without hiding primary actions;
- keep tap targets at platform minimum or larger;
- not require swipe gestures;
- provide accessible names for money values and state labels;
- respect reduced-motion preferences;
- preserve logical screen-reader order.

For grouped financial values, read label, value, state and action.

Example:

```text
Wants. £126 of £200. Running fast. Button: View details.
```

Goal progress must not rely on a progress bar alone.

---

## 27. Motion and responsive behaviour

Motion communicates state change, not decoration.

Suitable:
- subtle card transition;
- bottom-sheet movement;
- confirmation feedback;
- progress update;
- undo toast.

Avoid bouncing money values, confetti, animated warnings, looping Kei animations and attention-grabbing goal-completion effects.

The canonical experience targets phones first. Design for narrow Android devices, current iPhone sizes, safe-area variation and large accessibility text.

Tablet layouts may use additional width for summary/detail combinations but must not introduce tablet-only workflows.

---

## 28. Consistency rules

Across Today, Review, Plan and Explore:
- primary financial values use consistent hierarchy;
- confirmed and attention states use consistent semantics;
- Kei content is clearly attributable;
- goal progress uses consistent factual language;
- bottom-sheet actions follow the same hierarchy;
- inspection remains visually quieter than the primary task.

Do not invent a separate visual language for long-term goals.

Goals should feel like a natural extension of Kakeibo, not a second application.

---

## 29. Acceptance criteria

The mobile design is correct when:
- Today makes the next useful action obvious;
- Review feels like clearing a small inbox;
- decision cards can be resolved quickly;
- group checks reduce repeated work;
- Looks Safe makes automation inspectable;
- the weekly scan remains calm at normal financial-activity volumes;
- ordinary outflows are presented naturally as spending;
- broader financial activity is represented without implementation vocabulary;
- Plan feels intentional rather than spreadsheet-like;
- fixed commitments remain visually distinct from flexible envelopes;
- long-term goals are deliberately accessible from Plan;
- progressive disclosure introduces goals without gating or rewarding them;
- goal setup is understandable without financial expertise;
- goal progress is factual and tied to user-selected targets;
- advice-sensitive goals are not presented as recommendations;
- Today does not become a goal dashboard;
- Explore remains secondary and searchable;
- Kei is recognisable without dominating the app;
- interactions remain usable one-handed;
- accessibility does not depend on colour, gesture or motion;
- failures and long-running work have clear recovery states;
- the system remains consistent with Kakeibo's warm, calm visual direction.

Core test:

> Can a user complete a normal weekly review quickly and confidently, while deeper planning remains easy to find when wanted but quiet when it is not yet relevant?

---

**Version:** 1.0  
**Date:** 2026-09-01  
**Status:** Canonical implementation spec
