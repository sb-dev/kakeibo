import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CommandContext } from "../context.ts";
import { CliError, NotInteractiveError, StoreMissingError, UsageError } from "../errors.ts";
import { scriptedPrompter, type ScriptedAnswer } from "../prompts/plan-prompter.ts";
import { storePaths, type StorePaths } from "../storage/paths.ts";
import { initStore, loadStore } from "../storage/store-file.ts";
import { runPlan } from "./plan.ts";

const NOW = new Date("2026-10-28T10:00:00.000Z");
const PRD_ANSWERS: ScriptedAnswer[] = ["500", "100", "100", "150", "100", "25", "25", "Cook at home", true];

let root: string;
let paths: StorePaths;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "kakeibo-plan-"));
  paths = storePaths(root);
  await initStore(paths, NOW.toISOString());
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

function makeContext(answers: readonly ScriptedAnswer[], interactive = true) {
  const out: string[] = [];
  const err: string[] = [];
  const prompter = scriptedPrompter(answers);
  const context: CommandContext = {
    paths,
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    now: () => NOW,
    interactive,
    prompter,
  };
  return { context, out, err, prompter };
}

describe("plan (interactive)", () => {
  it("saves the PRD £500 plan and shows it after a fresh load", async () => {
    const { context, out } = makeContext(PRD_ANSWERS);
    await runPlan(context, { month: "2026-10" });
    expect(out.join("\n")).toContain("Flexible budget to allocate across the four envelopes: £300.00");
    expect(out.join("\n")).toContain("Saved plan revision 1 for 2026-10");

    const store = await loadStore(paths);
    expect(store.plans).toHaveLength(1);
    expect(store.plans[0]?.revisions[0]).toMatchObject({
      revision: 1,
      planning_income: 50000,
      fixed_commitments: 10000,
      plan_funded_goal_allocations: [{ goal_id: "goal_001", amount: 10000 }],
      envelopes: { needs: 15000, wants: 10000, culture: 2500, unexpected: 2500 },
      intention: "Cook at home",
    });
    expect(store.history).toHaveLength(1);

    const shown = makeContext([]);
    await runPlan(shown.context, { month: "2026-10", show: true });
    const text = shown.out.join("\n");
    expect(text).toContain("Plan for 2026-10 (revision 1");
    expect(text).toContain("Planned income");
    expect(text).toContain("£500.00");
    expect(text).toContain("Flexible budget");
    expect(text).toContain("£300.00");
    expect(text).toContain("Intention: Cook at home");
  });

  it("rejects envelopes totalling £299 and saves nothing", async () => {
    const { context, err } = makeContext(["500", "100", "100", "150", "100", "25", "24", ""]);
    await expect(runPlan(context, { month: "2026-10" })).rejects.toBeInstanceOf(CliError);
    expect(err.join("\n")).toContain("Envelopes total £299.00 but the flexible budget is £300.00 (£1.00 unallocated).");
    const store = await loadStore(paths);
    expect(store.plans).toHaveLength(0);
    expect(store.history).toHaveLength(0);
    expect(await fs.readdir(paths.dir)).toEqual(["store.json"]);
  });

  it("re-asks on negative amounts, excess precision, unsafe integers and malformed text", async () => {
    const { context, err, prompter } = makeContext([
      "-5", "500",
      "1.005", "100",
      "99999999999999999", "100",
      "abc", "150",
      "", "100",
      "25", "25", "", true,
    ]);
    await runPlan(context, { month: "2026-10" });
    expect(err).toEqual([
      "-5 is negative. Plan amounts must be zero or more.",
      "'1.005' has more than two decimal places. Amounts are exact pence.",
      "'99999999999999999' is too large to store exactly.",
      "'abc' is not an amount. Use pounds with an optional decimal point, for example 150 or 149.99.",
      "Enter an amount, for example 150 or 149.99.",
    ]);
    expect(prompter.asked.filter((message) => message === "Planned income (£)")).toHaveLength(2);
    const store = await loadStore(paths);
    expect(store.plans[0]?.revisions[0]?.intention).toBeUndefined();
  });

  it("reports when fixed commitments and savings exceed income", async () => {
    const { context, err } = makeContext(["500", "450", "100", "0", "0", "0", "0", ""]);
    await expect(runPlan(context, { month: "2026-10" })).rejects.toBeInstanceOf(CliError);
    expect(err.join("\n")).toContain("exceed planned income by £50.00");
    expect((await loadStore(paths)).plans).toHaveLength(0);
  });

  it("saves nothing when the user declines the confirmation", async () => {
    const { context, out } = makeContext([...PRD_ANSWERS.slice(0, -1), false]);
    await runPlan(context, { month: "2026-10" });
    expect(out.at(-1)).toBe("Plan not saved. No data was changed.");
    expect((await loadStore(paths)).plans).toHaveLength(0);
  });

  it("revises an existing plan as revision 2 and keeps revision 1", async () => {
    await runPlan(makeContext(PRD_ANSWERS).context, { month: "2026-10" });
    const { context, out } = makeContext(["600", "100", "100", "200", "150", "25", "25", "Read more", true]);
    await runPlan(context, { month: "2026-10" });
    expect(out.join("\n")).toContain("Revising 2026-10. Current plan:");
    expect(out.join("\n")).toContain("Saved plan revision 2 for 2026-10");
    const store = await loadStore(paths);
    expect(store.plans[0]?.revisions.map((revision) => revision.planning_income)).toEqual([50000, 60000]);
    expect(store.history.map((record) => record.id)).toEqual(["hist_001", "hist_002"]);
  });

  it("refuses without a terminal and changes nothing", async () => {
    const { context } = makeContext(PRD_ANSWERS, false);
    const error = await runPlan(context, { month: "2026-10" }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(NotInteractiveError);
    expect((error as NotInteractiveError).fullMessage).toContain("No data was changed.");
    expect((error as NotInteractiveError).fullMessage).toContain("--show");
    expect((await loadStore(paths)).plans).toHaveLength(0);
  });

  it("rejects an invalid month before touching the store", async () => {
    const { context, prompter } = makeContext(PRD_ANSWERS);
    await expect(runPlan(context, { month: "2026-13" })).rejects.toBeInstanceOf(UsageError);
    expect(prompter.asked).toEqual([]);
  });

  it("defaults to the current local month", async () => {
    const { context, out } = makeContext(PRD_ANSWERS);
    await runPlan(context, {});
    expect(out.join("\n")).toContain("Saved plan revision 1 for 2026-10");
  });
});

describe("plan --show", () => {
  it("explains when no plan exists and needs no terminal", async () => {
    const { context, out } = makeContext([], false);
    await runPlan(context, { month: "2026-11", show: true });
    expect(out).toEqual(["No plan saved for 2026-11. Run `kakeibo plan --month 2026-11` to create one."]);
  });

  it("fails clearly when the store is missing", async () => {
    await fs.rm(paths.store);
    const { context } = makeContext([], false);
    await expect(runPlan(context, { month: "2026-10", show: true })).rejects.toBeInstanceOf(StoreMissingError);
  });
});
