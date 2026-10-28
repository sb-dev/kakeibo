import type { IdPrefix, Store } from "./schema.ts";

/**
 * Sequential IDs per prefix, e.g. tx_014. The store has a single writer, so a counter is safe,
 * and short IDs are what the user types into `kakeibo edit`.
 * Returns the ID and the store with its counter advanced.
 */
export function nextId(store: Store, prefix: IdPrefix): { readonly id: string; readonly store: Store } {
  const next = (store.counters[prefix] ?? 0) + 1;
  const id = `${prefix}_${next.toString().padStart(3, "0")}`;
  return { id, store: { ...store, counters: { ...store.counters, [prefix]: next } } };
}
