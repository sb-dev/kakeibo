import { confirm, input } from "@inquirer/prompts";
import { CancelledError } from "../errors.ts";
import type { PlanPrompter } from "./plan-prompter.ts";

function isExitPrompt(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { name?: unknown }).name === "ExitPromptError";
}

async function cancellable<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isExitPrompt(error)) {
      throw new CancelledError();
    }
    throw error;
  }
}

/** Production prompter over @inquirer/prompts. Ctrl+C becomes CancelledError. */
export function inquirerPlanPrompter(): PlanPrompter {
  return {
    askMoney: (message, defaultText) =>
      cancellable(() => input(defaultText === undefined ? { message } : { message, default: defaultText })),
    askText: (message, defaultText) =>
      cancellable(() => input(defaultText === undefined ? { message } : { message, default: defaultText })),
    confirm: (message, defaultValue) => cancellable(() => confirm({ message, default: defaultValue })),
  };
}
