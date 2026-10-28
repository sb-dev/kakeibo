/**
 * The questions the plan command asks. The command owns parsing and validation;
 * a prompter only collects raw answers, so tests can script them without a terminal.
 */
export type PlanPrompter = {
  askMoney(message: string, defaultText?: string): Promise<string>;
  askText(message: string, defaultText?: string): Promise<string>;
  confirm(message: string, defaultValue: boolean): Promise<boolean>;
};

/** `null` accepts the prompt default, as pressing Enter does in a terminal. */
export type ScriptedAnswer = string | boolean | null;

/** Replays a fixed list of answers in order. Throws when the script runs out. */
export function scriptedPrompter(answers: readonly ScriptedAnswer[]): PlanPrompter & { readonly asked: string[] } {
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
  };
}
