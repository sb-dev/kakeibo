import { describe, expect, it } from "vitest";
import { createImportedEntry } from "../entries/entries.ts";
import { pence } from "../money/pence.ts";
import type { IsoDate } from "../periods/periods.ts";
import { createEmptyStore, savingsGoal } from "./create.ts";
import type { SourceValues, Store } from "./schema.ts";
import { validateStore } from "./validate.ts";

const NOW = "2026-10-28T10:00:00.000Z";

function errorsOf(value: unknown): string[] {
  const result = validateStore(value);
  if (result.ok) {
    throw new Error("expected validation to fail");
  }
  return result.error.map((error) => error.path);
}

describe("validateStore", () => {
  it("accepts a freshly created store and round-trips through JSON", () => {
    const store = createEmptyStore(NOW);
    expect(validateStore(store).ok).toBe(true);
    const roundTripped: unknown = JSON.parse(JSON.stringify(store));
    const result = validateStore(roundTripped);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(store);
      expect(savingsGoal(result.value).name).toBe("Savings");
      expect(result.value.categories).toHaveLength(12);
    }
  });

  it("rejects an unsupported schema version without throwing", () => {
    const store = { ...createEmptyStore(NOW), schema_version: 99 };
    const result = validateStore(store);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0]?.path).toBe("schema_version");
      expect(result.error[0]?.message).toContain("newer");
    }
  });

  it("rejects non-object input and missing collections", () => {
    expect(errorsOf("not a store")).toEqual(["$"]);
    expect(errorsOf(null)).toEqual(["$"]);
    const { entries: _entries, ...withoutEntries } = createEmptyStore(NOW);
    expect(errorsOf(withoutEntries)).toEqual(["entries"]);
  });

  it("rejects fractional pence and unknown goals inside a plan revision", () => {
    const base = createEmptyStore(NOW);
    const store = {
      ...base,
      plans: [
        {
          month: "2026-10",
          revisions: [
            {
              revision: 1,
              planning_income: 500.5,
              fixed_commitments: pence(10000),
              plan_funded_goal_allocations: [{ goal_id: "goal_999", amount: pence(10000) }],
              envelopes: { needs: pence(15000), wants: pence(10000), culture: pence(2500), unexpected: pence(2500) },
              confirmed_at: NOW,
            },
          ],
        },
      ],
    };
    expect(errorsOf(store)).toEqual([
      "plans[0].revisions[0].planning_income",
      "plans[0].revisions[0].plan_funded_goal_allocations[0].goal_id",
    ]);
  });

  it("rejects a stored revision whose envelopes do not balance the flexible budget", () => {
    const base = createEmptyStore(NOW);
    const store = {
      ...base,
      plans: [
        {
          month: "2026-10",
          revisions: [
            {
              revision: 1,
              planning_income: pence(50000),
              fixed_commitments: pence(10000),
              plan_funded_goal_allocations: [{ goal_id: "goal_001", amount: pence(10000) }],
              envelopes: { needs: pence(1), wants: pence(10000), culture: pence(2500), unexpected: pence(2500) },
              confirmed_at: NOW,
            },
          ],
        },
      ],
    };
    const result = validateStore(store);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual([
        {
          path: "plans[0].revisions[0]",
          message: "Envelopes total £150.01 but the flexible budget is £300.00 (£149.99 unallocated).",
        },
      ]);
    }
  });

  it("rejects a stored revision whose totals leave the safe integer range", () => {
    const base = createEmptyStore(NOW);
    const store = {
      ...base,
      plans: [
        {
          month: "2026-10",
          revisions: [
            {
              revision: 1,
              planning_income: pence(0),
              fixed_commitments: pence(Number.MAX_SAFE_INTEGER),
              plan_funded_goal_allocations: [{ goal_id: "goal_001", amount: pence(Number.MAX_SAFE_INTEGER) }],
              envelopes: { needs: pence(0), wants: pence(0), culture: pence(0), unexpected: pence(0) },
              confirmed_at: NOW,
            },
          ],
        },
      ],
    };
    const result = validateStore(store);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0]?.path).toBe("plans[0].revisions[0]");
      expect(result.error[0]?.message).toContain("safe integer");
    }
  });

  it("ignores unknown keys so later additions stay readable", () => {
    const store = { ...createEmptyStore(NOW), future_collection: [] };
    expect(validateStore(store).ok).toBe(true);
  });
});

/** A store holding one account, mapping, import, source row and unreviewed entry. */
function importedStore(): Store {
  const base = createEmptyStore(NOW);
  const values: SourceValues = {
    posted_date: "2026-10-05" as IsoDate,
    description: "Corner Cafe",
    currency: "GBP",
    source_movement: "outflow",
    amount: pence(320),
  };
  const withAccount: Store = {
    ...base,
    counters: { ...base.counters, acct: 1, map: 1, imp: 1, src: 1 },
    accounts: [{ id: "acct_001", name: "current", created_at: NOW }],
    mappings: [
      {
        id: "map_001",
        account_id: "acct_001",
        version: 1,
        delimiter: ",",
        header: ["Date", "Description", "Amount"],
        date_column: "Date",
        date_format: "YYYY-MM-DD",
        description_column: "Description",
        amount: { kind: "signed", column: "Amount", money_out_sign: "negative" },
        normalisation_version: 1,
        confirmed_at: NOW,
      },
    ],
    imports: [
      {
        id: "imp_001",
        account_id: "acct_001",
        mapping_id: "map_001",
        file_name: "statement.csv",
        file_sha256: "a".repeat(64),
        row_count: 1,
        coverage: { completeness: "unknown" },
        discrepancies: [],
        imported_at: NOW,
      },
    ],
  };
  const { store, entry } = createImportedEntry(withAccount, "acct_001", values, NOW);
  return {
    ...store,
    source_records: [
      {
        id: "src_001",
        import_id: "imp_001",
        account_id: "acct_001",
        row: 1,
        line: 2,
        raw: { Date: "2026-10-05", Description: "Corner Cafe", Amount: "-3.20" },
        values,
        entry_id: entry.id,
        match: { basis: "new" },
      },
    ],
  };
}

describe("validateStore (imports)", () => {
  it("accepts imported records and starts entries unreviewed and unclassified", () => {
    const store = importedStore();
    expect(validateStore(JSON.parse(JSON.stringify(store))).ok).toBe(true);
    expect(store.entries[0]).toMatchObject({
      id: "tx_001",
      movement: "outflow",
      purpose: "spending",
      treatment: "unclassified",
      category_id: store.categories.find((category) => category.name === "Uncategorised")?.id,
      review_state: "unreviewed",
    });
  });

  it("rejects dangling references, duplicate IDs and invalid source values", () => {
    const store = importedStore();
    const [entry] = store.entries;
    const [source] = store.source_records;
    if (entry === undefined || source === undefined) throw new Error("fixture");
    expect(errorsOf({ ...store, source_records: [{ ...source, entry_id: "tx_404" }] })).toEqual(["source_records[0].entry_id"]);
    expect(errorsOf({ ...store, entries: [{ ...entry, account_id: "acct_404" }] })).toEqual(["entries[0].account_id"]);
    expect(errorsOf({ ...store, entries: [entry, entry] })).toEqual(["entries[1].id"]);
    expect(errorsOf({ ...store, entries: [{ ...entry, source: { ...entry.source, amount: -320, currency: "EUR" } }] })).toEqual([
      "entries[0].source.currency",
      "entries[0].source.amount",
    ]);
    expect(errorsOf({ ...store, entries: [{ ...entry, duplicate: { status: "candidate", of_entry_id: entry.id } }] })).toEqual([
      "entries[0].duplicate.of_entry_id",
    ]);
    expect(errorsOf({ ...store, accounts: [...store.accounts, { id: "acct_002", name: "Current", created_at: NOW }] })).toEqual(["accounts[1].name"]);
    const [record] = store.imports;
    if (record === undefined) throw new Error("fixture");
    expect(
      errorsOf({ ...store, imports: [{ ...record, coverage: { completeness: "complete", from: "2026-10-10", to: "2026-10-01", basis: "user_declaration" } }] }),
    ).toEqual(["imports[0].coverage"]);
  });
});
