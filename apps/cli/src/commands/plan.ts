import {
  ENVELOPES,
  TREATMENT_LABELS,
  addPlanRevision,
  currentMonth,
  currentPlanRevision,
  describePlanError,
  envelopeTotal,
  flexibleBudget,
  formatPence,
  formatPencePlain,
  goalAllocationTotal,
  parseMoney,
  parseMonth,
  savingsGoal,
  validatePlan,
  type EnvelopeLimits,
  type Month,
  type Pence,
  type PlanInput,
  type PlanRevision,
  type Store,
} from "@kakeibo/domain";
import type { CommandContext } from "../context.ts";
import { CliError, NotInteractiveError, UsageError } from "../errors.ts";
import { renderTable, type Row } from "../format/table.ts";
import { loadStore, updateStore } from "../storage/store-file.ts";

export type PlanOptions = {
  readonly month?: string;
  readonly show?: boolean;
};

export function resolveMonth(flag: string | undefined, now: Date): Month {
  if (flag === undefined) {
    return currentMonth(now);
  }
  const parsed = parseMonth(flag);
  if (!parsed.ok) {
    throw new UsageError(`Invalid --month '${flag}'. Use YYYY-MM, for example 2026-10.`);
  }
  return parsed.value;
}

function planRows(plan: PlanInput): Row[] {
  const rows: Row[] = [
    ["Planned income", formatPence(plan.planning_income)],
    ["Fixed commitments", formatPence(plan.fixed_commitments)],
    ["Savings allocation", formatPence(goalAllocationTotal(plan))],
    ["Flexible budget", formatPence(flexibleBudget(plan))],
  ];
  for (const envelope of ENVELOPES) {
    rows.push([`  ${TREATMENT_LABELS[envelope]}`, formatPence(plan.envelopes[envelope])]);
  }
  rows.push(["Envelopes total", formatPence(envelopeTotal(plan.envelopes))]);
  return rows;
}

function renderPlan(month: Month, revision: PlanRevision): string {
  const lines = [`Plan for ${month} (revision ${revision.revision}, confirmed ${revision.confirmed_at})`, renderTable(planRows(revision))];
  lines.push(`Intention: ${revision.intention ?? "(none)"}`);
  return lines.join("\n");
}

/** Describe the balance of unvalidated input without throwing on arithmetic overflow. */
function renderProposal(month: Month, plan: PlanInput, revisionNumber: number): string {
  return [`Proposed plan for ${month} (will save revision ${revisionNumber})`, renderTable(planRows(plan)), `Intention: ${plan.intention ?? "(none)"}`].join(
    "\n",
  );
}

async function askAmount(context: CommandContext, message: string, current: Pence | undefined): Promise<Pence> {
  const defaultText = current === undefined ? undefined : formatPencePlain(current);
  for (;;) {
    const answer = await context.prompter.askMoney(message, defaultText);
    const parsed = parseMoney(answer);
    if (!parsed.ok) {
      context.err(describeMoneyError(parsed.error.code, answer));
      continue;
    }
    if (parsed.value < 0) {
      context.err(`${answer.trim()} is negative. Plan amounts must be zero or more.`);
      continue;
    }
    return parsed.value;
  }
}

function describeMoneyError(code: "empty" | "invalid_format" | "excess_precision" | "unsafe_integer", answer: string): string {
  switch (code) {
    case "empty":
      return "Enter an amount, for example 150 or 149.99.";
    case "invalid_format":
      return `'${answer.trim()}' is not an amount. Use pounds with an optional decimal point, for example 150 or 149.99.`;
    case "excess_precision":
      return `'${answer.trim()}' has more than two decimal places. Amounts are exact pence.`;
    case "unsafe_integer":
      return `'${answer.trim()}' is too large to store exactly.`;
  }
}

async function collectPlan(context: CommandContext, store: Store, previous: PlanRevision | undefined): Promise<PlanInput> {
  const goal = savingsGoal(store);
  const previousAllocation = previous?.plan_funded_goal_allocations.find((allocation) => allocation.goal_id === goal.id)?.amount;

  const planning_income = await askAmount(context, "Planned income (£)", previous?.planning_income);
  const fixed_commitments = await askAmount(context, "Fixed commitments (£)", previous?.fixed_commitments);
  const savings = await askAmount(context, `${goal.name} allocation this month (£)`, previousAllocation);

  const partial: PlanInput = {
    planning_income,
    fixed_commitments,
    plan_funded_goal_allocations: [{ goal_id: goal.id, amount: savings }],
    envelopes: { needs: 0 as Pence, wants: 0 as Pence, culture: 0 as Pence, unexpected: 0 as Pence },
  };
  const flexible = flexibleBudget(partial);
  if (flexible < 0) {
    context.err(describePlanError({ code: "flexible_budget_negative", flexible_budget: flexible }));
  } else {
    context.out(`Flexible budget to allocate across the four envelopes: ${formatPence(flexible)}`);
  }

  const envelopes = {} as { -readonly [K in keyof EnvelopeLimits]: Pence };
  for (const envelope of ENVELOPES) {
    envelopes[envelope] = await askAmount(context, `${TREATMENT_LABELS[envelope]} limit (£)`, previous?.envelopes[envelope]);
  }

  const intention = (await context.prompter.askText("Monthly intention (optional)", previous?.intention)).trim();

  return {
    ...partial,
    envelopes,
    ...(intention === "" ? {} : { intention }),
  };
}

export async function runPlan(context: CommandContext, options: PlanOptions): Promise<void> {
  const month = resolveMonth(options.month, context.now());

  if (options.show === true) {
    const store = await loadStore(context.paths);
    const revision = currentPlanRevision(store, month);
    if (revision === undefined) {
      context.out(`No plan saved for ${month}. Run \`kakeibo plan --month ${month}\` to create one.`);
      return;
    }
    context.out(renderPlan(month, revision));
    return;
  }

  if (!context.interactive) {
    throw new NotInteractiveError("plan", `Use \`kakeibo plan --month ${month} --show\` to display the saved plan.`);
  }

  const store = await loadStore(context.paths);
  const previous = currentPlanRevision(store, month);
  if (previous === undefined) {
    context.out(`Planning ${month}. No plan is saved yet.`);
  } else {
    context.out(`Revising ${month}. Current plan:`);
    context.out(renderPlan(month, previous));
    context.out("Press Enter to keep a current value.");
  }

  const input = await collectPlan(context, store, previous);
  const validated = validatePlan(input);
  if (!validated.ok) {
    for (const error of validated.error) {
      context.err(describePlanError(error));
    }
    throw new CliError("Plan not saved: the plan does not balance.");
  }

  const nextRevision = (previous?.revision ?? 0) + 1;
  context.out(renderProposal(month, validated.value, nextRevision));
  const confirmed = await context.prompter.confirm(`Save this plan for ${month}?`, false);
  if (!confirmed) {
    context.out("Plan not saved. No data was changed.");
    return;
  }

  const saved = await updateStore(context.paths, (current) => {
    // The preview compared the proposal with `previous`. If another process saved a revision
    // since then, the user has not seen the effect of this change (PRD §4.2): refuse to save.
    const latest = currentPlanRevision(current, month);
    const latestNumber = latest?.revision ?? 0;
    const previewedNumber = previous?.revision ?? 0;
    if (latestNumber !== previewedNumber) {
      throw new CliError(
        `The plan for ${month} changed while you were editing (revision ${latestNumber} is now saved; you saw ` +
          `${previewedNumber === 0 ? "no plan" : `revision ${previewedNumber}`}). Run the command again to review the current plan.`,
      );
    }
    const result = addPlanRevision(current, month, validated.value, context.now().toISOString());
    return { store: result.store, result: result.revision };
  });
  context.out(`Saved plan revision ${saved.revision} for ${month} to ${context.paths.store}`);
}
