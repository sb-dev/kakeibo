export type Choice = {
  readonly value: string;
  readonly name: string;
};

/**
 * The questions commands ask. Commands own parsing and validation;
 * a prompter only collects raw answers, so tests can script them without a terminal.
 */
export type Prompter = {
  askMoney(message: string, defaultText?: string): Promise<string>;
  askText(message: string, defaultText?: string): Promise<string>;
  confirm(message: string, defaultValue: boolean): Promise<boolean>;
  /** One choice; returns its value. */
  select(message: string, choices: readonly Choice[], defaultValue?: string): Promise<string>;
  /** Any number of choices, none selected initially; returns their values. */
  checkbox(message: string, choices: readonly Choice[]): Promise<string[]>;
};

/** `null` accepts the prompt default, as pressing Enter does in a terminal. */
export type ScriptedAnswer = string | boolean | null | readonly string[];

/** Replays a fixed list of answers in order. Throws when the script runs out. */
export function scriptedPrompter(answers: readonly ScriptedAnswer[]): Prompter & { readonly asked: string[] } {
  const queue = [...answers];
  const asked: string[] = [];
  const next = (message: string): ScriptedAnswer => {
    asked.push(message);
    if (queue.length === 0) {
      throw new Error(`scripted prompter has no answer for: ${message}`);
    }
    return queue.shift() as ScriptedAnswer;
  };
  return {
    asked,
    async askMoney(message, defaultText) {
      const answer = next(message);
      if (answer === null) return defaultText ?? "";
      if (typeof answer !== "string") throw new Error(`expected text answer for: ${message}`);
      return answer;
    },
    async askText(message, defaultText) {
      const answer = next(message);
      if (answer === null) return defaultText ?? "";
      if (typeof answer !== "string") throw new Error(`expected text answer for: ${message}`);
      return answer;
    },
    async confirm(message) {
      const answer = next(message);
      if (typeof answer !== "boolean") throw new Error(`expected yes/no answer for: ${message}`);
      return answer;
    },
    async select(message, choices, defaultValue) {
      const answer = next(message);
      const value = answer === null ? defaultValue : answer;
      if (typeof value !== "string" || !choices.some((choice) => choice.value === value)) {
        throw new Error(`expected one of ${choices.map((choice) => choice.value).join(", ")} for: ${message}`);
      }
      return value;
    },
    async checkbox(message, choices) {
      const answer = next(message);
      if (!Array.isArray(answer) || !answer.every((value) => choices.some((choice) => choice.value === value))) {
        throw new Error(`expected a list of choice values for: ${message}`);
      }
      return [...answer];
    },
  };
}
