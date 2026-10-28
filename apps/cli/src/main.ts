import { CommanderError } from "commander";
import { CliError, EXIT_CODES } from "./errors.ts";
import { createProgram } from "./program.ts";

const program = createProgram().exitOverride();
// Subcommands copy settings when created, so they need the override too; otherwise their usage
// errors exit directly with code 1 and without the data-change statement.
for (const command of program.commands) {
  command.exitOverride();
}

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (error instanceof CommanderError) {
    // Help and version are not errors. Commander has already printed usage errors.
    if (error.code === "commander.helpDisplayed" || error.code === "commander.version" || error.code === "commander.help") {
      process.exitCode = 0;
    } else {
      process.stderr.write("No data was changed.\n");
      process.exitCode = EXIT_CODES.usage;
    }
  } else if (error instanceof CliError) {
    process.stderr.write(`${error.fullMessage}\n`);
    process.exitCode = error.exitCode;
  } else {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Unexpected error: ${message}\nWhether data changed is unknown; run \`kakeibo plan --show\` to check.\n`);
    process.exitCode = EXIT_CODES.failure;
  }
}
