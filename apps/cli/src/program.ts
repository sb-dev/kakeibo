import { Command } from "commander";
import { runInit } from "./commands/init.ts";
import { runPlan } from "./commands/plan.ts";
import type { CommandContext } from "./context.ts";
import { inquirerPlanPrompter } from "./prompts/inquirer-plan-prompter.ts";
import { resolveDataDir, storePaths } from "./storage/paths.ts";
import { isInteractive } from "./terminal.ts";

export const CLI_VERSION = "0.1.0";

export type ContextFactory = (dataDir: string | undefined) => CommandContext;

export function defaultContextFactory(dataDir: string | undefined): CommandContext {
  return {
    paths: storePaths(resolveDataDir(dataDir)),
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`),
    now: () => new Date(),
    interactive: isInteractive(),
    prompter: inquirerPlanPrompter(),
  };
}

type GlobalOptions = { dataDir?: string };

export function createProgram(createContext: ContextFactory = defaultContextFactory): Command {
  const program = new Command("kakeibo")
    .description("Plan the month, import CSVs, review spending and reflect. Data stays in a local JSON store.")
    .version(CLI_VERSION)
    .option("--data-dir <dir>", "store directory (default: ~/.kakeibo)")
    .showHelpAfterError("(run with --help for usage)")
    .configureHelp({ sortSubcommands: true });

  const context = (): CommandContext => createContext(program.opts<GlobalOptions>().dataDir);

  program
    .command("init")
    .description("Create the local store and show its location. Never replaces an existing store.")
    .action(async () => {
      await runInit(context());
    });

  program
    .command("plan")
    .description("Set or revise the monthly plan: income, fixed commitments, savings allocation, envelopes and intention.")
    .option("--month <YYYY-MM>", "calendar month (default: the current local month)")
    .option("--show", "display the saved plan without prompts")
    .action(async (options: { month?: string; show?: boolean }) => {
      await runPlan(context(), options);
    });

  return program;
}
