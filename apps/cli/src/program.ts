import { Command } from "commander";
import { runImport } from "./commands/import.ts";
import { runInit } from "./commands/init.ts";
import { runPlan } from "./commands/plan.ts";
import type { CommandContext } from "./context.ts";
import { inquirerPrompter } from "./prompts/inquirer-prompter.ts";
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
    prompter: inquirerPrompter(),
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

  program
    .command("import")
    .description("Import posted transactions from a CSV file: map columns when needed, preview the rows, then confirm.")
    .argument("<file>", "UTF-8 CSV file with a header row")
    .requiredOption("--account <name>", "named personal account; a new name is created by the confirmed import")
    .option("--remap", "ask for the column mapping again, for example after the export format changed")
    .action(async (file: string, options: { account: string; remap?: boolean }) => {
      await runImport(context(), file, options);
    });

  return program;
}
