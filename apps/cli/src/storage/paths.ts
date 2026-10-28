import { randomBytes } from "node:crypto";
import os from "node:os";
import path from "node:path";

export const DEFAULT_DATA_DIR_NAME = ".kakeibo";
export const STORE_FILE = "store.json";
export const BACKUP_FILE = "store.json.bak";
export const LOCK_FILE = "store.lock";
export const TEMP_PREFIX = "store.json.tmp-";

export type StorePaths = {
  readonly dir: string;
  readonly store: string;
  readonly backup: string;
  readonly lock: string;
  /** A fresh temporary file name inside the data directory (same filesystem as the store). */
  tmp(): string;
};

/** `--data-dir` wins; otherwise `~/.kakeibo`. Always absolute. */
export function resolveDataDir(flag: string | undefined): string {
  if (flag !== undefined && flag !== "") {
    return path.resolve(flag);
  }
  return path.join(os.homedir(), DEFAULT_DATA_DIR_NAME);
}

export function storePaths(dir: string): StorePaths {
  const absolute = path.resolve(dir);
  return {
    dir: absolute,
    store: path.join(absolute, STORE_FILE),
    backup: path.join(absolute, BACKUP_FILE),
    lock: path.join(absolute, LOCK_FILE),
    tmp: () => path.join(absolute, `${TEMP_PREFIX}${process.pid}-${randomBytes(4).toString("hex")}`),
  };
}
