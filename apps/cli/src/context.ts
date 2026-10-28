import type { Prompter } from "./prompts/prompter.ts";
import type { StorePaths } from "./storage/paths.ts";

/** Everything a command needs from the outside world, so tests can substitute each part. */
export type CommandContext = {
  readonly paths: StorePaths;
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
  readonly now: () => Date;
  readonly interactive: boolean;
  readonly prompter: Prompter;
};
