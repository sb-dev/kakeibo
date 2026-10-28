import { checkbox, confirm, input, select } from "@inquirer/prompts";
import { CancelledError } from "../errors.ts";
import type { Prompter } from "./prompter.ts";

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
export function inquirerPrompter(): Prompter {
  return {
    askMoney: (message, defaultText) =>
      cancellable(() => input(defaultText === undefined ? { message } : { message, default: defaultText })),
    askText: (message, defaultText) =>
      cancellable(() => input(defaultText === undefined ? { message } : { message, default: defaultText })),
    confirm: (message, defaultValue) => cancellable(() => confirm({ message, default: defaultValue })),
    select: (message, choices, defaultValue) =>
      cancellable(() =>
        select(defaultValue === undefined ? { message, choices: [...choices] } : { message, choices: [...choices], default: defaultValue }),
      ),
    checkbox: (message, choices) => cancellable(() => checkbox({ message, choices: [...choices] })),
  };
}
