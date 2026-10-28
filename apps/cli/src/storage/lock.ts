import fs from "node:fs/promises";
import os from "node:os";
import { LockHeldError, type LockInfo } from "../errors.ts";
import type { StorePaths } from "./paths.ts";

export type LockHandle = {
  /** Remove the lock file. Safe to call once. */
  release(): Promise<void>;
};

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}

async function readLockInfo(lockPath: string): Promise<LockInfo> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(lockPath, "utf8"));
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }
    const record = parsed as Record<string, unknown>;
    return {
      ...(typeof record["pid"] === "number" ? { pid: record["pid"] } : {}),
      ...(typeof record["acquired_at"] === "string" ? { acquired_at: record["acquired_at"] } : {}),
      ...(typeof record["hostname"] === "string" ? { hostname: record["hostname"] } : {}),
    };
  } catch {
    return {};
  }
}

/**
 * Create `store.lock` exclusively. A second writer is rejected immediately with LockHeldError.
 * The lock is never broken automatically: a stale lock after a crash is removed by the user
 * (see apps/cli/README.md).
 */
export async function acquireLock(paths: StorePaths, now: () => Date = () => new Date()): Promise<LockHandle> {
  let handle: fs.FileHandle;
  try {
    handle = await fs.open(paths.lock, "wx", 0o600);
  } catch (error) {
    if (isErrnoException(error) && error.code === "EEXIST") {
      throw new LockHeldError(paths.lock, await readLockInfo(paths.lock));
    }
    throw error;
  }
  try {
    const body = JSON.stringify({ pid: process.pid, acquired_at: now().toISOString(), hostname: os.hostname() });
    await handle.writeFile(`${body}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }

  let released = false;
  return {
    async release(): Promise<void> {
      if (released) {
        return;
      }
      released = true;
      await fs.unlink(paths.lock);
    },
  };
}
