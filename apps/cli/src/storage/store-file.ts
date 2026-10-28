import fs from "node:fs/promises";
import path from "node:path";
import { createEmptyStore, validateStore, type Store, type Timestamp } from "@kakeibo/domain";
import { CliError, CorruptStoreError, StoreExistsError, StoreMissingError } from "../errors.ts";
import { acquireLock } from "./lock.ts";
import { TEMP_PREFIX, type StorePaths } from "./paths.ts";

const FILE_MODE = 0o600;
const DIR_MODE = 0o700;
const MAX_REPORTED_PROBLEMS = 5;

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}

function serialise(store: Store): string {
  return `${JSON.stringify(store, null, 2)}\n`;
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function fsyncDirectory(dir: string): Promise<void> {
  // Best effort: some platforms (Windows) cannot fsync a directory.
  try {
    const handle = await fs.open(dir, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch {
    // ignored
  }
}

async function removeOrphanTempFiles(paths: StorePaths): Promise<void> {
  const names = await fs.readdir(paths.dir);
  await Promise.all(
    names.filter((name) => name.startsWith(TEMP_PREFIX)).map((name) => fs.rm(path.join(paths.dir, name), { force: true })),
  );
}

/** Write to a fresh temporary file in the data directory, fsync, then atomically rename over the store. */
async function writeStoreAtomically(paths: StorePaths, store: Store): Promise<void> {
  const tmp = paths.tmp();
  const handle = await fs.open(tmp, "wx", FILE_MODE);
  try {
    await handle.writeFile(serialise(store), "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(tmp, paths.store);
  await fsyncDirectory(paths.dir);
}

/** Copy the current (already validated) store to `store.json.bak` before it is replaced. */
async function backupCurrentStore(paths: StorePaths): Promise<void> {
  await fs.copyFile(paths.store, paths.backup);
  try {
    await fs.chmod(paths.backup, FILE_MODE);
  } catch {
    // Permissions are best effort where the platform supports them.
  }
}

/** Read and validate the store without taking the lock. Used by read-only commands. */
export async function loadStore(paths: StorePaths): Promise<Store> {
  let text: string;
  try {
    text = await fs.readFile(paths.store, "utf8");
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      throw new StoreMissingError(paths.store);
    }
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new CorruptStoreError(paths.store, paths.backup, [`invalid JSON: ${(error as Error).message}`]);
  }
  const validated = validateStore(parsed);
  if (!validated.ok) {
    const problems = validated.error.slice(0, MAX_REPORTED_PROBLEMS).map((problem) => `${problem.path}: ${problem.message}`);
    if (validated.error.length > MAX_REPORTED_PROBLEMS) {
      problems.push(`… and ${validated.error.length - MAX_REPORTED_PROBLEMS} more`);
    }
    throw new CorruptStoreError(paths.store, paths.backup, problems);
  }
  return validated.value;
}

/**
 * Create the data directory and an empty store. Never replaces an existing store,
 * whatever its state. Holds the lock so two concurrent inits cannot both succeed.
 */
export async function initStore(paths: StorePaths, now: Timestamp): Promise<Store> {
  await fs.mkdir(paths.dir, { recursive: true, mode: DIR_MODE });
  const lock = await acquireLock(paths);
  try {
    if (await fileExists(paths.store)) {
      throw new StoreExistsError(paths.store);
    }
    const store = createEmptyStore(now);
    await writeStoreAtomically(paths, store);
    return store;
  } finally {
    await lock.release();
  }
}

/**
 * Lock → load and validate → mutate → validate → write temp → back up previous → rename → unlock.
 * Any failure before the rename leaves the store untouched. The mutation returns the new store
 * (stores are treated as immutable values) and an optional result for the caller.
 */
export async function updateStore<T>(
  paths: StorePaths,
  mutate: (store: Store) => { readonly store: Store; readonly result: T },
): Promise<T> {
  if (!(await fileExists(paths.store))) {
    throw new StoreMissingError(paths.store);
  }
  const lock = await acquireLock(paths);
  let committed = false;
  try {
    await removeOrphanTempFiles(paths);
    const current = await loadStore(paths);
    const next = mutate(current);
    const validated = validateStore(next.store);
    if (!validated.ok) {
      const problems = validated.error.map((problem) => `${problem.path}: ${problem.message}`);
      throw new CliError(`Refusing to save an invalid store:\n  ${problems.join("\n  ")}`);
    }
    const tmp = paths.tmp();
    const handle = await fs.open(tmp, "wx", FILE_MODE);
    try {
      await handle.writeFile(serialise(validated.value), "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await backupCurrentStore(paths);
    await fs.rename(tmp, paths.store);
    committed = true;
    await fsyncDirectory(paths.dir);
    return next.result;
  } finally {
    try {
      await lock.release();
    } catch (error) {
      if (committed) {
        throw new CliError(`Saved, but could not remove ${paths.lock}; delete it manually.`, {
          dataChanged: true,
          cause: error,
        });
      }
    }
  }
}
