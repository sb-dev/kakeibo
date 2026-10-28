import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createEmptyStore, validateStore, type Entry, type ImportCoverage, type IsoDate, type Store } from "@kakeibo/domain";
import { parseCsv, readCsvFile } from "./csv.ts";
import { describeRowError, normaliseRows, type MappingSettings, type NormalisedRow } from "./mapping.ts";
import { applyImport, findExactFileImport, planImport, reverseSourceReuse, undecidedRows, type Decision, type ImportPlan } from "./reconcile.ts";

const FIXTURES = fileURLToPath(new URL("../../../../fixtures/synthetic-financial-data/csv/", import.meta.url));
const NOW = "2026-10-28T10:00:00.000Z";

const SIGNED: MappingSettings = {
  delimiter: ",",
  header: ["Date", "Description", "Amount"],
  date_column: "Date",
  date_format: "YYYY-MM-DD",
  description_column: "Description",
  amount: { kind: "signed", column: "Amount", money_out_sign: "negative" },
  normalisation_version: 1,
};

const CHANGED: MappingSettings = {
  delimiter: ";",
  header: ["Value", "Posted", "Narrative"],
  date_column: "Posted",
  date_format: "DD/MM/YYYY",
  description_column: "Narrative",
  amount: { kind: "signed", column: "Value", money_out_sign: "negative" },
  normalisation_version: 1,
};

const IDS: MappingSettings = { ...SIGNED, header: ["Id", "Date", "Description", "Amount"], source_id_column: "Id" };

function complete(from: string, to: string): ImportCoverage {
  return { completeness: "complete", from: from as IsoDate, to: to as IsoDate, basis: "user_declaration" };
}
const UNKNOWN: ImportCoverage = { completeness: "unknown" };
const PARTIAL: ImportCoverage = { completeness: "partial" };
const OCTOBER_1_10 = complete("2026-10-01", "2026-10-10");

type Loaded = { readonly sha256: string; readonly rows: readonly NormalisedRow[]; readonly name: string };

async function load(name: string, settings: MappingSettings = SIGNED): Promise<Loaded> {
  const file = await readCsvFile(`${FIXTURES}${name}`);
  const result = normaliseRows(settings, parseCsv(file, settings.delimiter));
  if (!result.ok) throw new Error(result.error.map(describeRowError).join("\n"));
  return { sha256: file.sha256, rows: result.value, name };
}

function accountId(store: Store): string | undefined {
  return store.accounts[0]?.id;
}

function plan(store: Store, loaded: Loaded, coverage: ImportCoverage, settings = SIGNED, decisions = new Map<number, Decision>()): ImportPlan {
  return planImport(store, { accountId: accountId(store), settings, rows: loaded.rows, coverage }, decisions);
}

function apply(store: Store, loaded: Loaded, coverage: ImportCoverage, settings = SIGNED, decisions = new Map<number, Decision>()) {
  const input = { accountId: accountId(store), settings, rows: loaded.rows, coverage };
  const planned = planImport(store, input, decisions);
  const applied = applyImport(store, input, planned, { accountName: "current", fileName: loaded.name, sha256: loaded.sha256, now: NOW });
  const validated = validateStore(applied.store);
  expect(validated.ok ? [] : validated.error).toEqual([]);
  return { ...applied, plan: planned };
}

function kinds(planned: ImportPlan): string[] {
  return planned.rows.map((row) => (row.kind === "reuse" ? `reuse:${row.entry_id}` : row.kind === "new" ? `new${row.duplicate_of === undefined ? "" : `~${row.duplicate_of}`}` : `proposed:${row.entry_id}:${row.reason}`));
}

function entry(store: Store, id: string): Entry {
  return store.entries.find((candidate) => candidate.id === id) as Entry;
}

function withEntry(store: Store, id: string, change: Partial<Entry>): Store {
  return { ...store, entries: store.entries.map((candidate) => (candidate.id === id ? { ...candidate, ...change } : candidate)) };
}

async function storeWithA(coverage: ImportCoverage = OCTOBER_1_10): Promise<Store> {
  return apply(createEmptyStore(NOW), await load("overlap-a.csv"), coverage).store;
}

describe("first import", () => {
  it("creates the account, mapping, import record and one unreviewed entry per row", async () => {
    const { store, created, account, mapping, import: record } = apply(createEmptyStore(NOW), await load("overlap-a.csv"), OCTOBER_1_10);
    expect(account).toMatchObject({ id: "acct_001", name: "current" });
    expect(mapping).toMatchObject({ id: "map_001", account_id: "acct_001", version: 1 });
    expect(record).toMatchObject({ id: "imp_001", row_count: 6, coverage: OCTOBER_1_10, discrepancies: [] });
    expect(created.map((item) => item.id)).toEqual(["tx_001", "tx_002", "tx_003", "tx_004", "tx_005", "tx_006"]);
    expect(store.entries.every((item) => item.review_state === "unreviewed" && item.treatment === "unclassified" && item.duplicate === undefined)).toBe(true);
    expect(entry(store, "tx_001")).toMatchObject({ movement: "inflow", purpose: "income" });
    expect(entry(store, "tx_002")).toMatchObject({ movement: "outflow", purpose: "spending" });
    expect(store.source_records.map((source) => [source.row, source.entry_id, source.match.basis])).toEqual([
      [1, "tx_001", "new"],
      [2, "tx_002", "new"],
      [3, "tx_003", "new"],
      [4, "tx_004", "new"],
      [5, "tx_005", "new"],
      [6, "tx_006", "new"],
    ]);
  });
});

describe("complete overlapping exports", () => {
  it("reuses two identical purchases from a reordered export and adds only new activity", async () => {
    const store = await storeWithA();
    const result = apply(store, await load("overlap-b-reordered.csv"), complete("2026-10-01", "2026-10-15"));
    expect(kinds(result.plan)).toEqual(["new", "reuse:tx_003", "reuse:tx_006", "reuse:tx_001", "new", "reuse:tx_005", "reuse:tx_004", "reuse:tx_002"]);
    expect(result.plan.discrepancies).toEqual([]);
    expect(result.created.map((item) => item.source.description)).toEqual(["Cinema", "Tesco Stores"]);
    expect(result.store.entries).toHaveLength(8);
  });

  it("adds exactly one entry for a third identical purchase, without flagging it as a duplicate", async () => {
    const store = await storeWithA();
    const result = apply(store, await load("overlap-c-third-purchase.csv"), OCTOBER_1_10);
    expect(result.created).toHaveLength(1);
    expect(result.created[0]).toMatchObject({ source: { posted_date: "2026-10-05", description: "Corner Cafe", amount: 320 } });
    expect(result.created[0]?.duplicate).toBeUndefined();
  });

  it("adds nothing when either file is repeated", async () => {
    const a = await load("overlap-a.csv");
    const b = await load("overlap-b-reordered.csv");
    let store = apply(createEmptyStore(NOW), a, OCTOBER_1_10).store;
    store = apply(store, b, complete("2026-10-01", "2026-10-15")).store;
    expect(findExactFileImport(store, accountId(store), a.sha256, a.rows)?.id).toBe("imp_001");
    expect(findExactFileImport(store, accountId(store), b.sha256, b.rows)?.id).toBe("imp_002");
    // Even without the exact-file shortcut, the counted occurrences already cover both files.
    expect(plan(store, a, OCTOBER_1_10).rows.filter((row) => row.kind !== "reuse")).toEqual([]);
    expect(plan(store, b, complete("2026-10-01", "2026-10-15")).rows.filter((row) => row.kind !== "reuse")).toEqual([]);
  });

  it("does not treat the same file in another account or under another mapping as an exact reimport", async () => {
    const a = await load("overlap-a.csv");
    const store = await storeWithA();
    expect(findExactFileImport(store, "acct_999", a.sha256, a.rows)).toBeUndefined();
    const flipped = await load("overlap-a.csv", { ...SIGNED, amount: { kind: "signed", column: "Amount", money_out_sign: "positive" } });
    expect(findExactFileImport(store, accountId(store), flipped.sha256, flipped.rows)).toBeUndefined();
  });

  it("keeps reused entries' IDs, classification and review state and adds source links", async () => {
    let store = await storeWithA();
    store = withEntry(store, "tx_003", { treatment: "wants", review_state: "reviewed" });
    const result = apply(store, await load("overlap-b-reordered.csv"), complete("2026-10-01", "2026-10-15"));
    expect(entry(result.store, "tx_003")).toEqual(entry(store, "tx_003"));
    expect(result.store.source_records.filter((source) => source.entry_id === "tx_003").map((source) => [source.import_id, source.match.basis])).toEqual([
      ["imp_001", "new"],
      ["imp_002", "occurrence_count"],
    ]);
  });
});

describe("reduced counts, missing rows and changed values", () => {
  it("flags a reduced count and a missing row by posted date and keeps both entries", async () => {
    const store = await storeWithA();
    const result = apply(store, await load("overlap-reduced.csv"), OCTOBER_1_10);
    expect(result.created).toEqual([]);
    expect(result.plan.discrepancies).toEqual([
      { posted_date: "2026-10-05", missing_entry_ids: ["tx_004"], replaced_entry_ids: [] },
      { posted_date: "2026-10-07", missing_entry_ids: ["tx_005"], replaced_entry_ids: [] },
    ]);
    expect(result.store.entries).toEqual(store.entries);
    expect(result.import.discrepancies).toEqual(result.plan.discrepancies);
  });

  it("proposes changed descriptions and amounts for an explicit decision instead of substituting them", async () => {
    const store = withEntry(await storeWithA(), "tx_002", { treatment: "needs", review_state: "reviewed" });
    const changed = await load("overlap-changed.csv");
    const undecided = plan(store, changed, OCTOBER_1_10);
    expect(kinds(undecided)).toEqual([
      "reuse:tx_001",
      "proposed:tx_002:changed_value",
      "reuse:tx_003",
      "reuse:tx_004",
      "proposed:tx_005:changed_value",
      "reuse:tx_006",
    ]);
    expect(undecidedRows(undecided)).toHaveLength(2);
    expect(() =>
      applyImport(store, { accountId: "acct_001", settings: SIGNED, rows: changed.rows, coverage: OCTOBER_1_10 }, undecided, {
        accountName: "current",
        fileName: changed.name,
        sha256: changed.sha256,
        now: NOW,
      }),
    ).toThrow(/undecided/);

    const result = apply(store, changed, OCTOBER_1_10, SIGNED, new Map<number, Decision>([[2, "reuse"], [5, "keep_separate"]]));
    expect(entry(result.store, "tx_002")).toMatchObject({ source: { amount: 5500 }, treatment: "needs", review_state: "unreviewed" });
    expect(entry(result.store, "tx_005")).toEqual(entry(store, "tx_005"));
    expect(result.created.map((item) => [item.source.description, item.duplicate])).toEqual([["WATERSTONES LTD", undefined]]);
    expect(result.plan.discrepancies).toEqual([
      { posted_date: "2026-10-02", missing_entry_ids: [], replaced_entry_ids: ["tx_002"] },
      { posted_date: "2026-10-07", missing_entry_ids: ["tx_005"], replaced_entry_ids: [] },
    ]);
    const history = result.store.history.at(-1);
    expect(history).toMatchObject({
      kind: "entry_source_replaced",
      subject_id: "tx_002",
      before: { source: { amount: 5000 }, review_state: "reviewed" },
      after: { source: { amount: 5500 }, review_state: "unreviewed" },
    });
    const replacing = result.store.source_records.find((source) => source.import_id === "imp_002" && source.row === 2);
    expect(replacing?.match).toMatchObject({ basis: "user_reuse", reason: "changed_value", previous_values: { amount: 5000 } });
  });

  it("keeps the review state when only the description changes", async () => {
    const store = withEntry(await storeWithA(), "tx_005", { review_state: "reviewed" });
    const result = apply(store, await load("overlap-changed.csv"), OCTOBER_1_10, SIGNED, new Map<number, Decision>([[2, "keep_separate"], [5, "reuse"]]));
    expect(entry(result.store, "tx_005")).toMatchObject({ source: { description: "WATERSTONES LTD" }, review_state: "reviewed" });
  });
});

describe("uncertain coverage, filtered exports and incompatible mappings", () => {
  it("requires decisions for a filtered export and applies a bulk decision with per-row overrides", async () => {
    const store = await storeWithA();
    const b = await load("overlap-b-reordered.csv");
    const undecided = plan(store, b, PARTIAL);
    expect(kinds(undecided)).toEqual([
      "new",
      "proposed:tx_003:incoming_not_complete",
      "proposed:tx_006:incoming_not_complete",
      "proposed:tx_001:incoming_not_complete",
      "new",
      "proposed:tx_005:incoming_not_complete",
      "proposed:tx_004:incoming_not_complete",
      "proposed:tx_002:incoming_not_complete",
    ]);
    expect(undecided.discrepancies).toEqual([]);

    const decisions = new Map<number, Decision>(undecidedRows(undecided).map((row) => [row.row.row, "reuse"]));
    decisions.set(7, "keep_separate");
    const result = apply(store, b, PARTIAL, SIGNED, decisions);
    expect(result.created.map((item) => [item.source.description, item.duplicate?.of_entry_id])).toEqual([
      ["Cinema", undefined],
      ["Tesco Stores", undefined],
      ["Corner Cafe", "tx_004"],
    ]);
    const kept = result.store.source_records.find((source) => source.import_id === "imp_002" && source.row === 7);
    expect(kept?.match).toEqual({ basis: "user_keep_separate", reason: "incoming_not_complete", proposed_entry_id: "tx_004" });
  });

  it("requires decisions when earlier coverage is unknown and flags identical excess rows as duplicate candidates", async () => {
    const store = await storeWithA(UNKNOWN);
    const undecided = plan(store, await load("overlap-c-third-purchase.csv"), OCTOBER_1_10);
    expect(kinds(undecided)).toEqual([
      "proposed:tx_001:uncertain_coverage",
      "proposed:tx_002:uncertain_coverage",
      "proposed:tx_003:uncertain_coverage",
      "proposed:tx_004:uncertain_coverage",
      "new~tx_003",
      "proposed:tx_005:uncertain_coverage",
      "proposed:tx_006:uncertain_coverage",
    ]);
  });

  it("does not reconcile across incompatible mappings automatically", async () => {
    const store = await storeWithA();
    const changed = await load("changed-mapping.csv", CHANGED);
    const undecided = plan(store, changed, OCTOBER_1_10, CHANGED);
    expect(undecided.rows.every((row) => row.kind === "proposed" && row.reason === "incompatible_mapping")).toBe(true);
    const decisions = new Map<number, Decision>(undecided.rows.map((row) => [row.row.row, "keep_separate"]));
    const result = apply(store, changed, OCTOBER_1_10, CHANGED, decisions);
    expect(result.mapping).toMatchObject({ id: "map_002", version: 2 });
    expect(result.created).toHaveLength(6);
    expect(result.created.every((item) => item.duplicate !== undefined)).toBe(true);
    // Every earlier entry was kept separate, so the complete export does not contain them.
    expect(result.plan.discrepancies.flatMap((discrepancy) => discrepancy.missing_entry_ids)).toEqual(["tx_001", "tx_002", "tx_003", "tx_004", "tx_005", "tx_006"]);
  });

  it("reuses an existing mapping version when the settings are unchanged", async () => {
    const store = await storeWithA();
    const result = apply(store, await load("overlap-reduced.csv"), OCTOBER_1_10);
    expect(result.mapping.id).toBe("map_001");
    expect(result.store.mappings).toHaveLength(1);
  });
});

describe("source IDs", () => {
  it("reuses unchanged source IDs and stops on conflicting data", async () => {
    const withIds = await load("with-ids.csv", IDS);
    const { store } = apply(createEmptyStore(NOW), withIds, UNKNOWN, IDS);
    expect(store.entries).toHaveLength(3);
    expect(kinds(plan(store, withIds, UNKNOWN, IDS))).toEqual(["reuse:tx_001", "reuse:tx_002", "reuse:tx_003"]);

    const conflicting = plan(store, await load("with-ids-conflict.csv", IDS), UNKNOWN, IDS);
    expect(conflicting.conflicts.map((conflict) => [conflict.row.row, conflict.row.values.source_id, conflict.source_record.entry_id, conflict.fields])).toEqual([
      [2, "T-1002", "tx_002", ["amount"]],
    ]);
    expect(kinds(conflicting)).toEqual(["reuse:tx_001", "new"]);
  });

  it("keeps two same-day identical purchases with different IDs as two entries", async () => {
    const { store } = apply(createEmptyStore(NOW), await load("with-ids.csv", IDS), complete("2026-10-01", "2026-10-02"), IDS);
    expect(store.entries.filter((item) => item.source.description === "Coffee").map((item) => item.duplicate)).toEqual([undefined, undefined]);
  });
});

describe("source-ID transitions", () => {
  const { source_id_column: _ids, ...NO_IDS } = IDS;

  function withIds(loaded: Loaded, ids: readonly string[]): Loaded {
    return { ...loaded, sha256: `${loaded.sha256.slice(0, 60)}beef`, rows: loaded.rows.map((row, index) => ({ ...row, values: { ...row.values, source_id: ids[index] as string } })) };
  }

  it("proposes, rather than adds, ID-less rows that match entries with known source IDs", async () => {
    const { store } = apply(createEmptyStore(NOW), await load("with-ids.csv", IDS), complete("2026-10-01", "2026-10-02"), IDS);
    const withoutIds = await load("with-ids.csv", NO_IDS);
    expect(kinds(plan(store, withoutIds, complete("2026-10-01", "2026-10-02"), NO_IDS))).toEqual([
      "proposed:tx_001:source_id_missing",
      "proposed:tx_002:source_id_missing",
      "proposed:tx_003:source_id_missing",
    ]);
  });

  function coffee(row: number, sourceId?: string): NormalisedRow {
    return {
      row,
      line: row + 1,
      raw: {},
      values: {
        posted_date: "2026-10-01" as IsoDate,
        description: "Coffee",
        currency: "GBP",
        source_movement: "outflow",
        amount: 1000 as NormalisedRow["values"]["amount"],
        ...(sourceId === undefined ? {} : { source_id: sourceId }),
      },
    };
  }

  it.each([
    ["ID-less row first", [coffee(1), coffee(2, "Y")]],
    ["ID row first", [coffee(1, "Y"), coffee(2)]],
  ])("matches mixed ID and ID-less rows independently of row order (%s)", (_order, rows) => {
    const day = complete("2026-10-01", "2026-10-01");
    const first: Loaded = { name: "first.csv", sha256: "1".repeat(64), rows: [coffee(1, "X"), coffee(2)] };
    const { store } = apply(createEmptyStore(NOW), first, day, IDS);
    const second: Loaded = { name: "second.csv", sha256: "2".repeat(64), rows };
    const blankRow = rows.find((row) => row.values.source_id === undefined) as NormalisedRow;
    const planned = plan(store, second, day, IDS);
    const byId = (id: string | undefined) => planned.rows.find((row) => row.row.values.source_id === id);
    expect(byId("Y")).toMatchObject({ kind: "reuse", basis: "occurrence_count", entry_id: "tx_002" });
    expect(byId(undefined)).toMatchObject({ kind: "proposed", entry_id: "tx_001", reason: "source_id_missing" });

    const result = apply(store, second, day, IDS, new Map<number, Decision>([[blankRow.row, "reuse"]]));
    expect(result.store.entries).toHaveLength(2);
    expect(result.plan.discrepancies).toEqual([]);
    const links = result.store.source_records.filter((source) => source.import_id === "imp_002").map((source) => [source.values.source_id ?? null, source.entry_id]);
    expect(links.sort()).toEqual([[null, "tx_001"], ["Y", "tx_002"]].sort());
  });

  it.each([
    ["ID-less row first", [{ ...coffee(1), values: { ...coffee(1).values, amount: 1100 } }, { ...coffee(2, "Y"), values: { ...coffee(2, "Y").values, amount: 1200 } }]],
    ["ID row first", [{ ...coffee(1, "Y"), values: { ...coffee(1, "Y").values, amount: 1200 } }, { ...coffee(2), values: { ...coffee(2).values, amount: 1100 } }]],
  ])("pairs changed values for ID rows before ID-less rows (%s)", (_order, rows) => {
    const day = complete("2026-10-01", "2026-10-01");
    const { store } = apply(createEmptyStore(NOW), { name: "first.csv", sha256: "1".repeat(64), rows: [coffee(1)] }, day, IDS);
    const planned = plan(store, { name: "second.csv", sha256: "2".repeat(64), rows: rows as NormalisedRow[] }, day, IDS);
    expect(planned.rows.find((row) => row.row.values.source_id === "Y")).toMatchObject({ kind: "proposed", entry_id: "tx_001", reason: "changed_value" });
    expect(planned.rows.find((row) => row.row.values.source_id === undefined)).toMatchObject({ kind: "new" });
  });

  it("never count-matches a row with one source ID to an entry already linked to another", async () => {
    let store = await storeWithA();
    const a = await load("overlap-a.csv");
    const ids = withIds(a, ["X1", "X2", "X3", "X4", "X5", "X6"]);
    const linking = plan(store, ids, OCTOBER_1_10, IDS);
    expect(linking.rows.every((row) => row.kind === "proposed" && row.reason === "incompatible_mapping")).toBe(true);
    store = apply(store, ids, OCTOBER_1_10, IDS, new Map(linking.rows.map((row) => [row.row.row, "reuse" as Decision]))).store;

    const distinct: Loaded = { ...withIds(a, ["Y"]), rows: [{ ...(a.rows[2] as NormalisedRow), row: 1, values: { ...(a.rows[2] as NormalisedRow).values, source_id: "Y" } }] };
    const result = apply(store, distinct, complete("2026-10-05", "2026-10-05"), IDS);
    expect(kinds(result.plan)).toEqual(["new"]);
    expect(result.plan.discrepancies).toEqual([{ posted_date: "2026-10-05", missing_entry_ids: ["tx_003", "tx_004"], replaced_entry_ids: [] }]);
  });
});

describe("reversing incorrect reuse", () => {
  it("moves the source row to a new unreviewed entry and preserves the retained entry", async () => {
    let store = withEntry(await storeWithA(), "tx_004", { treatment: "wants", review_state: "reviewed" });
    store = apply(store, await load("overlap-b-reordered.csv"), complete("2026-10-01", "2026-10-15")).store;
    const reused = store.source_records.find((source) => source.import_id === "imp_002" && source.entry_id === "tx_004");
    expect(reused?.match.basis).toBe("occurrence_count");

    const reversed = reverseSourceReuse(store, reused?.id as string, NOW);
    expect(validateStore(reversed.store).ok).toBe(true);
    expect(reversed.entry).toMatchObject({ id: "tx_009", review_state: "unreviewed", treatment: "unclassified", source: reused?.values });
    expect(entry(reversed.store, "tx_004")).toEqual(entry(store, "tx_004"));
    expect(reversed.store.source_records.find((source) => source.id === reused?.id)).toMatchObject({
      entry_id: "tx_009",
      match: { basis: "reuse_reversed", reversed_from_entry_id: "tx_004" },
    });
    expect(reversed.store.history.at(-1)).toMatchObject({ kind: "source_reuse_reversed", subject_id: reused?.id, before: { entry_id: "tx_004" }, after: { entry_id: "tx_009" } });
    expect(() => reverseSourceReuse(reversed.store, reused?.id as string, NOW)).toThrow(/nothing to reverse/);
    expect(() => reverseSourceReuse(reversed.store, "src_001", NOW)).toThrow(/nothing to reverse/);
  });

  it("restores the retained entry's earlier values when reversing a changed-value replacement", async () => {
    const store = await storeWithA();
    const { store: replaced } = apply(store, await load("overlap-changed.csv"), OCTOBER_1_10, SIGNED, new Map<number, Decision>([[2, "reuse"], [5, "reuse"]]));
    const source = replaced.source_records.find((candidate) => candidate.import_id === "imp_002" && candidate.row === 2);
    const reversed = reverseSourceReuse(replaced, source?.id as string, NOW);
    expect(entry(reversed.store, "tx_002").source).toEqual(entry(store, "tx_002").source);
    expect(reversed.entry.source.amount).toBe(5500);
  });

  it("makes a reviewed entry unreviewed when reversal restores a different amount, and records it", async () => {
    const store = await storeWithA();
    const { store: replaced } = apply(store, await load("overlap-changed.csv"), OCTOBER_1_10, SIGNED, new Map<number, Decision>([[2, "reuse"], [5, "keep_separate"]]));
    const reviewed = withEntry(replaced, "tx_002", { review_state: "reviewed" });
    const source = reviewed.source_records.find((candidate) => candidate.import_id === "imp_002" && candidate.row === 2);
    const reversed = reverseSourceReuse(reviewed, source?.id as string, NOW);
    expect(entry(reversed.store, "tx_002")).toMatchObject({ source: { amount: 5000 }, review_state: "unreviewed" });
    expect(reversed.store.history.map((record) => record.kind).slice(-2)).toEqual(["entry_source_restored", "source_reuse_reversed"]);
    expect(reversed.store.history.at(-2)).toMatchObject({
      subject_id: "tx_002",
      before: { source: { amount: 5500 }, review_state: "reviewed" },
      after: { source: { amount: 5000 }, review_state: "unreviewed" },
    });
  });
});
