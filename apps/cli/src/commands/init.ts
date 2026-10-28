import type { CommandContext } from "../context.ts";
import { initStore } from "../storage/store-file.ts";

export async function runInit(context: CommandContext): Promise<void> {
  await initStore(context.paths, context.now().toISOString());
  context.out(`Created store at ${context.paths.store}`);
  context.out("Data stays on this device as plain-text JSON (GBP only). Keep the directory private.");
}
