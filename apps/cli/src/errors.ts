/**
 * CLI errors carry an exit code and whether stored data changed, so every message can
 * end with an accurate "No data was changed." or "Data was saved." statement (PRD §3).
 */
export const EXIT_CODES = {
  ok: 0,
  failure: 1,
  usage: 2,
  interrupted: 130,
} as const;

export class CliError extends Error {
  readonly exitCode: number;
  readonly dataChanged: boolean;
  /** Replaces the default data-change statement when more detail is needed. */
  readonly dataStatement: string | undefined;

  constructor(message: string, options: { exitCode?: number; dataChanged?: boolean; dataStatement?: string; cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.exitCode = options.exitCode ?? EXIT_CODES.failure;
    this.dataChanged = options.dataChanged ?? false;
    this.dataStatement = options.dataStatement;
  }

  /** The message with its data-change statement appended. */
  get fullMessage(): string {
    return `${this.message} ${this.dataStatement ?? (this.dataChanged ? "Data was saved." : "No data was changed.")}`;
  }
}

/**
 * An error that ends an interactive session after earlier actions in it were saved, as in `review`
 * and `edit`. Those actions stay saved, so the message must not say that no data changed (PRD §3).
 */
export function afterSavedActions(error: unknown, saved: number): unknown {
  if (saved === 0 || (error instanceof CliError && error.dataChanged)) return error;
  const earlier = saved === 1 ? "1 earlier confirmed action in this session was saved" : `${saved} earlier confirmed actions in this session were saved`;
  if (error instanceof CliError) {
    return new CliError(error.message, { exitCode: error.exitCode, dataChanged: true, dataStatement: `${earlier}; the interrupted action was not.`, cause: error });
  }
  const message = error instanceof Error ? error.message : String(error);
  return new CliError(`Unexpected error: ${message}`, {
    dataChanged: true,
    dataStatement: `${earlier}; whether the interrupted action was saved is unknown.`,
    cause: error,
  });
}

export class UsageError extends CliError {
  constructor(message: string) {
    super(message, { exitCode: EXIT_CODES.usage });
  }
}

export class StoreMissingError extends CliError {
  constructor(storePath: string) {
    super(`No store found at ${storePath}. Run \`kakeibo init\` first.`);
  }
}

export class StoreExistsError extends CliError {
  constructor(storePath: string) {
    super(`A store already exists at ${storePath}. init never replaces an existing store.`);
  }
}

export class CorruptStoreError extends CliError {
  constructor(storePath: string, backupPath: string, problems: readonly string[]) {
    const detail = problems.length > 0 ? `\n  ${problems.join("\n  ")}` : "";
    super(
      `The store at ${storePath} is corrupt or unsupported and was not modified.${detail}\n` +
        `The previous valid store may be at ${backupPath}; see apps/cli/README.md for recovery.`,
    );
  }
}

export type LockInfo = {
  readonly pid?: number;
  readonly acquired_at?: string;
  readonly hostname?: string;
};

export class LockHeldError extends CliError {
  constructor(lockPath: string, info: LockInfo) {
    const holder = [
      info.pid !== undefined ? `pid ${info.pid}` : undefined,
      info.hostname !== undefined ? `on ${info.hostname}` : undefined,
      info.acquired_at !== undefined ? `since ${info.acquired_at}` : undefined,
    ]
      .filter((part) => part !== undefined)
      .join(" ");
    super(
      `Another kakeibo process${holder === "" ? "" : ` (${holder})`} holds ${lockPath}. ` +
        `If no kakeibo process is running, delete that file and retry.`,
    );
  }
}

export class NotInteractiveError extends CliError {
  constructor(command: string, alternative: string) {
    super(`\`kakeibo ${command}\` is interactive and needs a terminal. ${alternative}`);
  }
}

export class CancelledError extends CliError {
  constructor() {
    super("Cancelled.", { exitCode: EXIT_CODES.interrupted });
  }
}
