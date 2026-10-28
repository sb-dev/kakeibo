import {
  ENVELOPES,
  TREATMENTS,
  TREATMENT_LABELS,
  addCategory,
  addDays,
  allowedTreatments,
  applyDuplicateDecisions,
  applyEntryCorrection,
  closeReview,
  confirmEntries,
  entryTypeOf,
  entryTypesFor,
  findEntry,
  findReview,
  isDuplicateCandidate,
  isExcludedDuplicate,
  linkFor,
  restoreDuplicates,
  saveReflection,
  weekEntries,
  type Classification,
  type DuplicateDecision,
  type Entry,
  type EntryCorrection,
  type IsoDate,
  type Result,
  type SourceRecord,
  type Store,
  type Treatment,
} from "@kakeibo/domain";
import type { CommandContext } from "../context.ts";
import { CliError } from "../errors.ts";
import { renderGrid } from "../format/table.ts";
import { signedDisplay } from "../import/mapping.ts";
import { reverseSourceReuse } from "../import/reconcile.ts";
import type { Choice } from "../prompts/prompter.ts";
import { updateStore } from "../storage/store-file.ts";
import { classificationLabel, describeEntry, entryGrid, selectionTotal, typeLabel } from "./render.ts";

/**
 * Interactive review actions shared by `review` and `edit` (PRD §4.4). Each action previews its
 * effect, asks for confirmation and saves at once, so an interrupted session loses nothing that
 * was confirmed. Domain rules run before the preview and again inside the locked save.
 * Each action returns whether it saved.
 */

const NEW_CATEGORY = "__new__";
const NO_COUNTERPART = "";
/** How far apart the two account sides of one transfer may be posted to be offered as a pair. */
const COUNTERPART_DAYS = 7;
const REUSE_BASES = new Set(["source_id", "occurrence_count", "user_reuse"]);

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function entryChoice(store: Store, entry: Entry): Choice {
  return { value: entry.id, name: describeEntry(store, entry) };
}

/** The entries, and the Savings-goal links that hold them, exactly as the user saw them. */
function snapshot(store: Store, entryIds: readonly string[]): string {
  return JSON.stringify(entryIds.map((id) => [findEntry(store, id) ?? null, linkFor(store, id) ?? null]));
}

/**
 * Save through the store lock. Refuses when any previewed entry changed since the preview,
 * as `plan` and `import` do, and reports domain rule failures without saving.
 */
async function save<T>(
  context: CommandContext,
  previewed: Store,
  entryIds: readonly string[],
  apply: (current: Store) => Result<{ readonly store: Store } & T, readonly string[]>,
): Promise<T> {
  return updateStore(context.paths, (current) => {
    if (snapshot(current, entryIds) !== snapshot(previewed, entryIds)) {
      throw new CliError(`${entryIds.join(", ")} changed while you were deciding. Nothing was saved from this action; run the command again to see the current state.`);
    }
    const result = apply(current);
    if (!result.ok) throw new CliError(`Not saved:\n  ${result.error.join("\n  ")}`);
    return { store: result.value.store, result: result.value };
  });
}

function reportProblems(context: CommandContext, problems: readonly string[]): void {
  for (const problem of problems) context.err(problem);
  context.out("Nothing was saved.");
}

// ---------------------------------------------------------------------------------------------
// Classification

type PendingCategory = { readonly treatment: Treatment; readonly name: string };
type Target = { readonly id: string; readonly classification: Classification; readonly newCategory?: PendingCategory };

/** Ask for a category within a treatment, or a new one. A new category is created with the save. */
async function askCategory(context: CommandContext, store: Store, treatment: Treatment, current: string | undefined): Promise<{ readonly categoryId: string; readonly newCategory?: PendingCategory }> {
  const categories = store.categories.filter((category) => category.treatment === treatment);
  const choices: Choice[] = categories.map((category) => ({ value: category.id, name: category.name }));
  if (treatment !== "unclassified") choices.push({ value: NEW_CATEGORY, name: `New ${TREATMENT_LABELS[treatment]} category…` });
  const defaultValue = categories.some((category) => category.id === current) ? current : choices[0]?.value;
  const answer = choices.length === 1 ? (choices[0] as Choice).value : await context.prompter.select(`${TREATMENT_LABELS[treatment]} category`, choices, defaultValue);
  if (answer !== NEW_CATEGORY) return { categoryId: answer };
  for (;;) {
    const name = await context.prompter.askText(`New ${TREATMENT_LABELS[treatment]} category name`);
    const checked = addCategory(store, treatment, name, new Date(0).toISOString());
    if (checked.ok) return { categoryId: checked.value.category.id, newCategory: { treatment, name: checked.value.category.name } };
    context.err(checked.error);
  }
}

/** Entries in another account that could be the other side of the same transfer. Offered, never assumed. */
function counterpartCandidates(store: Store, entry: Entry): Entry[] {
  const from = addDays(entry.source.posted_date, -COUNTERPART_DAYS);
  const to = addDays(entry.source.posted_date, COUNTERPART_DAYS);
  return store.entries.filter((candidate) => {
    const link = linkFor(store, candidate.id);
    return (
      candidate.account_id !== entry.account_id &&
      candidate.source.source_movement !== entry.source.source_movement &&
      candidate.source.amount === entry.source.amount &&
      from <= candidate.source.posted_date &&
      candidate.source.posted_date <= to &&
      !isExcludedDuplicate(candidate) &&
      (link === undefined || link.entry_ids.length === 1)
    );
  });
}

function withCategory(store: Store, target: Target, created: ReadonlyMap<string, string>): { readonly id: string; readonly classification: Classification } {
  if (target.newCategory === undefined) return target;
  const key = `${target.newCategory.treatment}#${target.newCategory.name.toLowerCase()}`;
  return { id: target.id, classification: { ...target.classification, category_id: created.get(key) ?? target.classification.category_id } };
}

/** Create any new categories, then apply the correction, in one save. */
function applyClassification(store: Store, targets: readonly Target[], correction: Omit<EntryCorrection, "entries">, now: string) {
  let next = store;
  const created = new Map<string, string>();
  for (const target of targets) {
    const pending = target.newCategory;
    if (pending === undefined) continue;
    const key = `${pending.treatment}#${pending.name.toLowerCase()}`;
    if (created.has(key)) continue;
    const added = addCategory(next, pending.treatment, pending.name, now);
    if (!added.ok) return { ok: false as const, error: [added.error] };
    next = added.value.store;
    created.set(key, added.value.category.id);
  }
  return applyEntryCorrection(next, { ...correction, entries: targets.map((target) => withCategory(next, target, created)) }, now);
}

function describeAfter(store: Store, target: Target): string {
  const category = target.newCategory === undefined ? classificationLabel(store, target.classification) : `${TREATMENT_LABELS[target.newCategory.treatment]} / ${target.newCategory.name} (new)`;
  return `${typeLabel(target.classification)}, ${category}`;
}

/**
 * Correct an entry's type, treatment and category (PRD §§4.3–4.4): refunds, transfers, card
 * settlements and explicit Savings-goal contributions. A reviewed entry stays reviewed only when
 * the user confirms the new classification; otherwise it becomes unreviewed.
 */
export async function classifyFlow(context: CommandContext, store: Store, entry: Entry): Promise<boolean> {
  if (isExcludedDuplicate(entry)) {
    context.out(`${entry.id} is an excluded duplicate. Reverse that decision before changing its classification.`);
    return false;
  }
  const types = entryTypesFor(entry.source.source_movement);
  const typeId = await context.prompter.select(
    `Type of ${entry.id} (${entry.source.description} ${signedDisplay(entry.source)})`,
    types.map((type) => ({ value: type.id, name: type.label })),
    entryTypeOf(entry)?.id,
  );
  const type = types.find((candidate) => candidate.id === typeId) ?? (types[0] as (typeof types)[number]);
  const treatments = allowedTreatments(type.purpose);
  const treatment =
    treatments.length === 1
      ? (treatments[0] as Treatment)
      : ((await context.prompter.select(
          "Kakeibo treatment",
          treatments.map((value) => ({ value, name: TREATMENT_LABELS[value] })),
          treatments.includes(entry.treatment) ? entry.treatment : "unclassified",
        )) as Treatment);
  const category = await askCategory(context, store, treatment, entry.category_id);
  const classification: Classification = { movement: type.movement, purpose: type.purpose, treatment, category_id: category.categoryId };
  const targets: Target[] = [{ id: entry.id, classification, ...(category.newCategory === undefined ? {} : { newCategory: category.newCategory }) }];

  const currentLink = linkFor(store, entry.id);
  let link: string[] | undefined;
  let unlink: string | undefined;
  if (type.purpose === "goal_contribution" && currentLink === undefined) {
    const candidates = counterpartCandidates(store, entry);
    let counterpart: string = NO_COUNTERPART;
    if (candidates.length > 0) {
      counterpart = await context.prompter.select(
        "Is the other account side of this transfer imported? Linking both sides counts the contribution once.",
        [
          {
            value: NO_COUNTERPART,
            name: candidates.some((candidate) => linkFor(store, candidate.id) !== undefined)
              ? "No; link this entry only (it counts as a separate contribution)"
              : "No; link this entry only",
          },
          ...candidates.map((candidate) => entryChoice(store, candidate)),
        ],
        NO_COUNTERPART,
      );
    }
    link = counterpart === NO_COUNTERPART ? [entry.id] : [entry.id, counterpart];
    if (counterpart !== NO_COUNTERPART) targets.push({ ...targets[0], id: counterpart } as Target);
  } else if (type.purpose !== "goal_contribution" && currentLink !== undefined) {
    unlink = currentLink.id;
    for (const otherId of currentLink.entry_ids.filter((id) => id !== entry.id)) {
      context.out(`${otherId} is the other account side of this Savings-goal contribution. It will become a Transfer, Outside plan.`);
      const other = await askCategory(context, store, "outside_plan", undefined);
      targets.push({
        id: otherId,
        classification: { movement: "transfer", purpose: "transfer", treatment: "outside_plan", category_id: other.categoryId },
        ...(other.newCategory === undefined ? {} : { newCategory: other.newCategory }),
      });
    }
  }

  const affected = targets.map((target) => findEntry(store, target.id) as Entry);
  const unchanged = targets.every((target, index) => {
    const before = affected[index] as Entry;
    return (
      target.newCategory === undefined &&
      before.movement === target.classification.movement &&
      before.purpose === target.classification.purpose &&
      before.treatment === target.classification.treatment &&
      before.category_id === target.classification.category_id
    );
  });
  if (unchanged && link === undefined && unlink === undefined) {
    context.out(`No change to ${entry.id}.`);
    return false;
  }

  context.out("Classification change:");
  targets.forEach((target, index) => {
    const before = affected[index] as Entry;
    context.out(`  ${before.id} ${before.source.posted_date} ${before.source.description} ${signedDisplay(before.source)} (${before.review_state})`);
    context.out(`    ${typeLabel(before)}, ${classificationLabel(store, before)} → ${describeAfter(store, target)}`);
  });
  if (link !== undefined) context.out(`  Linked to the Savings goal as one contribution of ${signedDisplay(entry.source).replace(/^[-+]/, "")}.`);
  if (unlink !== undefined) context.out(`  Savings-goal link ${unlink} will be removed.`);

  const anyReviewed = affected.some((candidate) => candidate.review_state === "reviewed");
  const unclassified = targets.some((target) => target.classification.treatment === "unclassified");
  const choices: Choice[] = [];
  if (!affected.some(isDuplicateCandidate)) {
    choices.push({
      value: "reviewed",
      name: anyReviewed
        ? "Save and confirm the new classification (stays reviewed)"
        : unclassified
          ? "Save and accept Unclassified / Uncategorised as reviewed"
          : "Save and mark reviewed",
    });
  } else {
    context.out("A duplicate candidate cannot be marked reviewed until it is resolved.");
  }
  choices.push({ value: "unreviewed", name: anyReviewed ? "Save as unreviewed (needs review again)" : "Save, leave unreviewed" });
  choices.push({ value: "cancel", name: "Cancel (nothing is saved)" });
  const decision = await context.prompter.select("Save this change?", choices, "cancel");
  if (decision === "cancel") {
    context.out("Not saved.");
    return false;
  }

  const correction = {
    review: decision === "reviewed" ? ("reviewed" as const) : ("unreviewed" as const),
    accept_unclassified: decision === "reviewed" && unclassified,
    ...(link === undefined ? {} : { link }),
    ...(unlink === undefined ? {} : { unlink }),
  };
  const now = context.now().toISOString();
  const dryRun = applyClassification(store, targets, correction, now);
  if (!dryRun.ok) {
    reportProblems(context, dryRun.error);
    return false;
  }
  await save(context, store, targets.map((target) => target.id), (current) => applyClassification(current, targets, correction, now));
  context.out(`Saved ${plural(targets.length, "entry", "entries")} as ${correction.review}.`);
  return true;
}

// ---------------------------------------------------------------------------------------------
// Confirmation

/**
 * Bulk or individual confirmation (PRD §4.4 step 3): show the selected entries, their count and
 * total; Unclassified entries need explicit acceptance; duplicate candidates are blocked.
 */
export async function confirmFlow(context: CommandContext, store: Store, entries: readonly Entry[]): Promise<boolean> {
  const unreviewed = entries.filter((entry) => entry.review_state === "unreviewed");
  const blocked = unreviewed.filter(isDuplicateCandidate);
  const eligible = unreviewed.filter((entry) => !isDuplicateCandidate(entry));
  if (blocked.length > 0) {
    context.out(`Not offered: ${blocked.map((entry) => entry.id).join(", ")} ${blocked.length === 1 ? "is a duplicate candidate" : "are duplicate candidates"}. Resolve them first.`);
  }
  if (eligible.length === 0) {
    context.out("Nothing to confirm.");
    return false;
  }
  const selectedIds = await context.prompter.checkbox(
    "Select entries to confirm as reviewed",
    eligible.map((entry) => entryChoice(store, entry)),
  );
  let selected = eligible.filter((entry) => selectedIds.includes(entry.id));
  if (selected.length === 0) {
    context.out("Nothing selected. Nothing was saved.");
    return false;
  }
  context.out(`Selected ${plural(selected.length, "entry", "entries")} · ${selectionTotal(selected)}`);
  context.out(entryGrid(store, selected));

  const unclassified = selected.filter((entry) => entry.treatment === "unclassified");
  let acceptUnclassified = false;
  if (unclassified.length > 0) {
    acceptUnclassified = await context.prompter.confirm(
      `${unclassified.map((entry) => entry.id).join(", ")} ${unclassified.length === 1 ? "is" : "are"} Unclassified / Uncategorised. Confirm ${unclassified.length === 1 ? "it" : "them"} as reviewed with that classification?`,
      false,
    );
    if (!acceptUnclassified) {
      selected = selected.filter((entry) => entry.treatment !== "unclassified");
      if (selected.length === 0) {
        context.out("Nothing left to confirm. Nothing was saved.");
        return false;
      }
      context.out(`Still selected: ${plural(selected.length, "entry", "entries")} · ${selectionTotal(selected)}`);
    }
  }
  const confirmed = await context.prompter.confirm(`Mark ${plural(selected.length, "entry", "entries")} (${selectionTotal(selected)}) reviewed?`, false);
  if (!confirmed) {
    context.out("Not saved.");
    return false;
  }
  const ids = selected.map((entry) => entry.id);
  const now = context.now().toISOString();
  await save(context, store, ids, (current) => confirmEntries(current, ids, { acceptUnclassified }, now));
  context.out(`Saved: ${plural(ids.length, "entry", "entries")} marked reviewed.`);
  return true;
}

// ---------------------------------------------------------------------------------------------
// Duplicates

function retainedLabel(store: Store, retainedId: string): string {
  const retained = findEntry(store, retainedId);
  return retained === undefined ? retainedId : `${retained.id} ${retained.source.posted_date} ${retained.source.description} ${signedDisplay(retained.source)}`;
}

function renderDecisions(context: CommandContext, store: Store, decisions: readonly DuplicateDecision[]): void {
  const groups = [
    { action: "exclude", title: "Exclude as duplicates (contribute zero; marked reviewed)" },
    { action: "keep_both", title: "Keep both (still counted; review state unchanged)" },
  ] as const;
  for (const group of groups) {
    const chosen = decisions.filter((decision) => decision.action === group.action);
    if (chosen.length === 0) continue;
    const entries = chosen.map((decision) => findEntry(store, decision.entry_id) as Entry);
    context.out(`${group.title}: ${plural(entries.length, "entry", "entries")} · ${selectionTotal(entries)}`);
    context.out(
      renderGrid(
        ["ID", "Date", "Description", "Amount", "Retained entry"],
        chosen.map((decision, index) => {
          const entry = entries[index] as Entry;
          return [entry.id, entry.source.posted_date, entry.source.description, signedDisplay(entry.source), retainedLabel(store, decision.of_entry_id ?? entry.duplicate?.of_entry_id ?? "")];
        }),
        [3],
      ),
    );
  }
}

async function confirmDecisions(context: CommandContext, store: Store, decisions: readonly DuplicateDecision[]): Promise<boolean> {
  renderDecisions(context, store, decisions);
  const now = context.now().toISOString();
  const dryRun = applyDuplicateDecisions(store, decisions, now);
  if (!dryRun.ok) {
    reportProblems(context, dryRun.error);
    return false;
  }
  if (!(await context.prompter.confirm(`Apply ${plural(decisions.length, "duplicate decision")}?`, false))) {
    context.out("Not saved.");
    return false;
  }
  // The preview showed each retained entry too, so a change to one of them also invalidates the decision.
  const retained = decisions.map((decision) => decision.of_entry_id ?? findEntry(store, decision.entry_id)?.duplicate?.of_entry_id);
  const ids = [...new Set([...decisions.map((decision) => decision.entry_id), ...retained.filter((id): id is string => id !== undefined)])];
  await save(context, store, ids, (current) => applyDuplicateDecisions(current, decisions, now));
  context.out(`Saved ${plural(decisions.length, "duplicate decision")}.`);
  return true;
}

/** Bulk keep-both or exclude for the week's candidates, with per-row overrides (PRD §4.1). */
export async function duplicatesFlow(context: CommandContext, store: Store, entries: readonly Entry[]): Promise<boolean> {
  const candidates = entries.filter(isDuplicateCandidate);
  if (candidates.length === 0) {
    context.out("No duplicate candidates in this week.");
    return false;
  }
  const chosenIds = await context.prompter.checkbox(
    "Select duplicate candidates to resolve now (unselected ones stay unresolved)",
    candidates.map((entry) => ({ value: entry.id, name: `${describeEntry(store, entry)} → retained ${retainedLabel(store, entry.duplicate?.of_entry_id ?? "")}` })),
  );
  const chosen = candidates.filter((entry) => chosenIds.includes(entry.id));
  if (chosen.length === 0) {
    context.out("Nothing selected. Nothing was saved.");
    return false;
  }
  const bulk = (await context.prompter.select(`Decision for the ${plural(chosen.length, "selected entry", "selected entries")}`, [
    { value: "exclude", name: "Exclude as duplicates of their retained entries" },
    { value: "keep_both", name: "Keep both: they are separate real transactions" },
  ])) as DuplicateDecision["action"];
  const opposite: DuplicateDecision["action"] = bulk === "exclude" ? "keep_both" : "exclude";
  const overrides = new Set(
    await context.prompter.checkbox(
      `Select entries to override (they will be ${opposite === "exclude" ? "excluded" : "kept"}); select none to keep the bulk decision`,
      chosen.map((entry) => entryChoice(store, entry)),
    ),
  );
  return confirmDecisions(
    context,
    store,
    chosen.map((entry) => ({ entry_id: entry.id, action: overrides.has(entry.id) ? opposite : bulk })),
  );
}

/** Reverse keep-both or exclude decisions; restored entries become unreviewed candidates. */
export async function restoreFlow(context: CommandContext, store: Store, entries: readonly Entry[]): Promise<boolean> {
  const decided = entries.filter((entry) => entry.duplicate !== undefined && entry.duplicate.status !== "candidate");
  if (decided.length === 0) {
    context.out("No duplicate decisions to reverse in this week.");
    return false;
  }
  const ids = await context.prompter.checkbox("Select duplicate decisions to reverse", decided.map((entry) => entryChoice(store, entry)));
  return confirmRestore(context, store, ids);
}

async function confirmRestore(context: CommandContext, store: Store, ids: readonly string[]): Promise<boolean> {
  if (ids.length === 0) {
    context.out("Nothing selected. Nothing was saved.");
    return false;
  }
  const selected = ids.map((id) => findEntry(store, id) as Entry);
  context.out(`Reverse ${plural(selected.length, "decision")} · ${selectionTotal(selected)}. The entries become unreviewed duplicate candidates again and count in unreviewed totals.`);
  context.out(entryGrid(store, selected));
  if (!(await context.prompter.confirm(`Reverse ${plural(selected.length, "duplicate decision")}?`, false))) {
    context.out("Not saved.");
    return false;
  }
  const now = context.now().toISOString();
  await save(context, store, ids, (current) => restoreDuplicates(current, ids, now));
  context.out(`Saved: ${plural(ids.length, "entry", "entries")} restored as unreviewed duplicate candidates.`);
  return true;
}

/** The duplicate decision for one entry, from `edit`. */
export async function duplicateEntryFlow(context: CommandContext, store: Store, entry: Entry): Promise<boolean> {
  const status = entry.duplicate?.status;
  if (status === "kept" || status === "excluded") {
    return confirmRestore(context, store, [entry.id]);
  }
  const choices: Choice[] = [];
  if (status === "candidate") {
    const retained = entry.duplicate?.of_entry_id as string;
    choices.push({ value: "keep_both", name: `Keep both: ${entry.id} and ${retained} are separate transactions` });
    choices.push({ value: "exclude", name: `Exclude ${entry.id} as a duplicate of ${retained}` });
  }
  choices.push({ value: "exclude_other", name: `Exclude ${entry.id} as a duplicate of another entry (enter its ID)` });
  choices.push({ value: "back", name: "Back" });
  const action = await context.prompter.select("Duplicate decision", choices, "back");
  if (action === "back") return false;
  let decision: DuplicateDecision;
  if (action === "exclude_other") {
    const retained = (await context.prompter.askText("ID of the entry to keep")).trim().toLowerCase();
    decision = { entry_id: entry.id, action: "exclude", of_entry_id: retained };
  } else {
    decision = { entry_id: entry.id, action: action === "keep_both" ? "keep_both" : "exclude" };
  }
  return confirmDecisions(context, store, [decision]);
}

// ---------------------------------------------------------------------------------------------
// Categories, reflection and closure

export async function addCategoryFlow(context: CommandContext, store: Store): Promise<boolean> {
  const treatments = TREATMENTS.filter((treatment) => treatment !== "unclassified");
  const treatment = (await context.prompter.select(
    "Treatment for the new category (a category never replaces an envelope)",
    treatments.map((value) => ({ value, name: TREATMENT_LABELS[value] })),
    ENVELOPES[0],
  )) as Treatment;
  const name = await context.prompter.askText(`New ${TREATMENT_LABELS[treatment]} category name`);
  const now = context.now().toISOString();
  const checked = addCategory(store, treatment, name, now);
  if (!checked.ok) {
    reportProblems(context, [checked.error]);
    return false;
  }
  const label = `${TREATMENT_LABELS[treatment]} / ${checked.value.category.name}`;
  if (!(await context.prompter.confirm(`Add the category ${label}?`, false))) {
    context.out("Not saved.");
    return false;
  }
  await updateStore(context.paths, (current) => {
    const added = addCategory(current, treatment, name, now);
    if (!added.ok) throw new CliError(`Not saved: ${added.error}`);
    return { store: added.value.store, result: undefined };
  });
  context.out(`Saved category ${label}.`);
  return true;
}

/** The two optional reflection prompts (PRD §4.4 step 5). Saving them never closes the review. */
export async function reflectionFlow(context: CommandContext, store: Store, weekStart: IsoDate): Promise<boolean> {
  const previous = findReview(store, weekStart)?.reflection;
  const stood_out = await context.prompter.askText("What stood out? (optional)", previous?.stood_out);
  const next_change = await context.prompter.askText("What will you change next week? (optional)", previous?.next_change);
  context.out(`What stood out? ${stood_out.trim() === "" ? "(empty)" : stood_out.trim()}`);
  context.out(`What will you change next week? ${next_change.trim() === "" ? "(empty)" : next_change.trim()}`);
  if (!(await context.prompter.confirm("Save the reflection?", false))) {
    context.out("Not saved.");
    return false;
  }
  const now = context.now().toISOString();
  await updateStore(context.paths, (current) => {
    if (JSON.stringify(findReview(current, weekStart)?.reflection) !== JSON.stringify(previous)) {
      throw new CliError("The reflection changed while you were writing it. Run the command again to see the saved version.");
    }
    return { store: saveReflection(current, weekStart, { stood_out, next_change }, now).store, result: undefined };
  });
  context.out("Saved the reflection. The review is not closed until you close it.");
  return true;
}

/**
 * Explicit closure (PRD §4.4 step 4). Unresolved entries stay unreviewed; the closure records the
 * revision of every entry in the week so later changes are detected.
 */
export async function closeFlow(context: CommandContext, store: Store, weekStart: IsoDate): Promise<boolean> {
  const entries = weekEntries(store, weekStart);
  const excluded = entries.filter(isExcludedDuplicate);
  const counted = entries.filter((entry) => !isExcludedDuplicate(entry));
  const reviewed = counted.filter((entry) => entry.review_state === "reviewed");
  const unresolved = counted.filter((entry) => entry.review_state === "unreviewed");
  context.out(`Closing ${weekStart}: ${plural(entries.length, "entry", "entries")} · reviewed ${reviewed.length} · unresolved ${unresolved.length} · excluded duplicates ${excluded.length}`);
  if (unresolved.length > 0) {
    context.out(`Unresolved entries stay unreviewed and visible: ${unresolved.map((entry) => entry.id).join(", ")} (${selectionTotal(unresolved)}).`);
  }
  if (!(await context.prompter.confirm(`Close the review for ${weekStart}?`, false))) {
    context.out("Not closed.");
    return false;
  }
  const now = context.now().toISOString();
  const ids = entries.map((entry) => entry.id);
  await updateStore(context.paths, (current) => {
    const currentIds = weekEntries(current, weekStart).map((entry) => entry.id);
    if (JSON.stringify(currentIds) !== JSON.stringify(ids) || snapshot(current, ids) !== snapshot(store, ids)) {
      throw new CliError("The week changed while you were closing it. Run the command again to review the current entries.");
    }
    return { store: closeReview(current, weekStart, now).store, result: undefined };
  });
  context.out(`Closed the review for ${weekStart}. Later imports or corrections in this week will show it as changed since review.`);
  return true;
}

// ---------------------------------------------------------------------------------------------
// Source reuse

function describeSource(store: Store, source: SourceRecord): string {
  const record = store.imports.find((candidate) => candidate.id === source.import_id);
  return `${source.id} from ${source.import_id} ${record?.file_name ?? ""} row ${source.row} (line ${source.line}): ${source.values.posted_date} ${source.values.description} ${signedDisplay(source.values)}`;
}

/** Source rows that reused this entry and can be split off into their own entry. */
export function reusedSources(store: Store, entry: Entry): SourceRecord[] {
  return store.source_records.filter((source) => source.entry_id === entry.id && REUSE_BASES.has(source.match.basis));
}

/**
 * Reverse an incorrect reuse decision (Financial Model §10.3): the source row gets a separate
 * unreviewed entry; the retained entry keeps its ID, classification and review state.
 */
export async function reverseReuseFlow(context: CommandContext, store: Store, entry: Entry): Promise<boolean> {
  const sources = reusedSources(store, entry);
  if (sources.length === 0) {
    context.out(`No source row reused ${entry.id}, so there is no reuse to reverse.`);
    return false;
  }
  const sourceId = await context.prompter.select(
    "Which source row was wrongly matched to this entry?",
    sources.map((source) => ({ value: source.id, name: describeSource(store, source) })),
  );
  const source = sources.find((candidate) => candidate.id === sourceId) as SourceRecord;
  context.out(`${source.id} will get its own new unreviewed entry. ${entry.id} keeps its ID, classification and review state.`);
  if (source.match.previous_values !== undefined) {
    const previous = source.match.previous_values;
    context.out(
      `${entry.id}'s values return to ${previous.posted_date} ${previous.description} ${signedDisplay(previous)}` +
        (previous.amount === entry.source.amount ? "." : "; the amount differs, so it becomes unreviewed."),
    );
  }
  if (!(await context.prompter.confirm(`Reverse the reuse of ${source.id}?`, false))) {
    context.out("Not saved.");
    return false;
  }
  const now = context.now().toISOString();
  const created = await updateStore(context.paths, (current) => {
    const currentSource = current.source_records.find((candidate) => candidate.id === source.id);
    if (snapshot(current, [entry.id]) !== snapshot(store, [entry.id]) || JSON.stringify(currentSource) !== JSON.stringify(source)) {
      throw new CliError(`${entry.id} or ${source.id} changed while you were deciding. Run the command again to see the current state.`);
    }
    const result = reverseSourceReuse(current, source.id, now);
    return { store: result.store, result: result.entry };
  });
  context.out(`Saved: ${source.id} now belongs to new unreviewed entry ${created.id}.`);
  return true;
}
