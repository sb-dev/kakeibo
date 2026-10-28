import { Command } from "commander";
import { runEdit } from "./commands/edit.ts";
import { runImport } from "./commands/import.ts";
import { runInit } from "./commands/init.ts";
import { runPlan } from "./commands/plan.ts";
import { runReview } from "./commands/review.ts";
import { runSpending } from "./commands/spending.ts";
import { runSummary } from "./commands/summary.ts";
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

  program
    .command("review")
    .description("Open or resume the Monday–Sunday review: confirm and correct entries, resolve duplicates, reflect and close.")
    .option("--week <YYYY-MM-DD>", "the Monday that starts the week (default: the current local week)")
    .option("--show", "display totals, entries, reflection and closure status without prompts")
    .action(async (options: { week?: string; show?: boolean }) => {
      await runReview(context(), options);
    });

  program
    .command("summary")
    .description("Show the month's plan beside observed income and spending, envelope use, category totals and unresolved entries.")
    .option("--month <YYYY-MM>", "calendar month (default: the current local month)")
    .action(async (options: { month?: string }) => {
      await runSummary(context(), options);
    });

  program
    .command("spending")
    .description("Show spending by treatment, then by category within an envelope, then the entries behind one category.")
    .option("--month <YYYY-MM>", "calendar month (default: the current local month)")
    .option("--week <YYYY-MM-DD>", "a Monday–Sunday week instead of a month, given by its Monday")
    .option("--envelope <name>", "Needs, Wants, Culture, Unexpected, Fixed, Outside plan or Unclassified")
    .option("--category <name>", "a category within --envelope; lists its entries")
    .action(async (options: { month?: string; week?: string; envelope?: string; category?: string }) => {
      await runSpending(context(), options);
    });

  program
    .command("edit")
    .description("Correct an entry's type, treatment/category, review state, duplicate decision or source-reuse decision.")
    .argument("<entry-id>", "an entry ID shown by review, for example tx_014")
    .action(async (entryId: string) => {
      await runEdit(context(), entryId);
    });

  return program;
}
