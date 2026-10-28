import {
  createImportedEntry,
  nextId,
  type Account,
  type CsvMapping,
  type Entry,
  type HistoryRecord,
  type ImportCoverage,
  type ImportDiscrepancy,
  type ImportRecord,
  type IsoDate,
  type ProposalReason,
  type SourceMatch,
  type SourceRecord,
  type SourceValues,
  type Store,
  type Timestamp,
} from "@kakeibo/domain";
import { CliError } from "../errors.ts";
import { mappingsCompatible, sameSettings, settingsOf, type MappingSettings, type NormalisedRow } from "./mapping.ts";

/**
 * Source reconciliation (Financial Model §§10.2–10.3). Pure functions over the store:
 * plan which incoming rows reuse existing entries, which are new and which need a decision,
 * then apply a fully decided plan. Nothing here reads files or prompts.
 */

export type ImportInput = {
  /** Undefined when the import will create the account. */
  readonly accountId: string | undefined;
  readonly settings: MappingSettings;
  readonly rows: readonly NormalisedRow[];
  readonly coverage: ImportCoverage;
};

export type Decision = "reuse" | "keep_separate";
/** Decisions keyed by data row number. */
export type Decisions = ReadonlyMap<number, Decision>;

export type RowPlan =
  | { readonly kind: "reuse"; readonly row: NormalisedRow; readonly basis: "source_id" | "occurrence_count"; readonly entry_id: string }
  | { readonly kind: "new"; readonly row: NormalisedRow; readonly duplicate_of?: string }
  | {
      readonly kind: "proposed";
      readonly row: NormalisedRow;
      readonly entry_id: string;
      readonly reason: ProposalReason;
      readonly decision?: Decision;
    };

export type SourceIdConflict = {
  readonly row: NormalisedRow;
  readonly source_record: SourceRecord;
  readonly fields: readonly string[];
};

export type ImportPlan = {
  readonly rows: readonly RowPlan[];
  readonly conflicts: readonly SourceIdConflict[];
  readonly discrepancies: readonly ImportDiscrepancy[];
};

const VALUE_FIELDS = ["posted_date", "description", "currency", "source_movement", "amount", "reference", "source_id"] as const;

export function differingFields(a: SourceValues, b: SourceValues): string[] {
  return VALUE_FIELDS.filter((field) => a[field] !== b[field]);
}

/** The matching group of Financial Model §10.3. The account is implied by the caller. */
function groupKey(values: SourceValues): string {
  return JSON.stringify([values.posted_date, values.currency, values.source_movement, values.amount, values.description, values.reference ?? null]);
}

function mappingById(store: Store, id: string): CsvMapping | undefined {
  return store.mappings.find((mapping) => mapping.id === id);
}

function covers(coverage: ImportCoverage, date: IsoDate): boolean {
  return coverage.completeness === "complete" && coverage.from <= date && date <= coverage.to;
}

/** Earlier complete coverage of a date in this account, and whether its mapping is compatible. */
function previousCoverage(store: Store, accountId: string, settings: MappingSettings, date: IsoDate): "compatible" | "incompatible" | "none" {
  let found: "incompatible" | "none" = "none";
  for (const record of store.imports) {
    if (record.account_id !== accountId || !covers(record.coverage, date)) continue;
    const mapping = mappingById(store, record.mapping_id);
    if (mapping !== undefined && mappingsCompatible(settingsOf(mapping), settings)) return "compatible";
    found = "incompatible";
  }
  return found;
}

/** An earlier import of the same bytes into the account whose rows normalise identically, if any. */
export function findExactFileImport(store: Store, accountId: string | undefined, sha256: string, rows: readonly NormalisedRow[]): ImportRecord | undefined {
  if (accountId === undefined) return undefined;
  return store.imports.find((record) => {
    if (record.account_id !== accountId || record.file_sha256 !== sha256 || record.row_count !== rows.length) return false;
    const sources = new Map(store.source_records.filter((source) => source.import_id === record.id).map((source) => [source.row, source]));
    return rows.every((row) => {
      const source = sources.get(row.row);
      return source !== undefined && differingFields(source.values, row.values).length === 0;
    });
  });
}

/**
 * Plan an import against the store. Rows with a known source ID reuse its entry or conflict.
 * Other rows are counted within matching groups: automatic reuse needs complete, compatible
 * coverage of the date on both sides; otherwise matches are proposals that need a decision.
 */
export function planImport(store: Store, input: ImportInput, decisions: Decisions = new Map()): ImportPlan {
  const accountId = input.accountId;
  const entries = accountId === undefined ? [] : store.entries.filter((entry) => entry.account_id === accountId);
  const sources = accountId === undefined ? [] : store.source_records.filter((source) => source.account_id === accountId);
  const plans = new Map<number, RowPlan>();
  const conflicts: SourceIdConflict[] = [];
  const linked = new Set<string>();

  // 1. Stable source IDs within the account (Financial Model §10.2).
  const bySourceId = new Map<string, SourceRecord>();
  for (const source of sources) {
    const id = source.values.source_id;
    if (id !== undefined && !bySourceId.has(id)) bySourceId.set(id, source);
  }
  for (const row of input.rows) {
    const id = row.values.source_id;
    const existing = id === undefined ? undefined : bySourceId.get(id);
    if (existing === undefined) continue;
    const fields = differingFields(existing.values, row.values);
    if (fields.length > 0) {
      conflicts.push({ row, source_record: existing, fields });
    } else {
      plans.set(row.row, { kind: "reuse", row, basis: "source_id", entry_id: existing.entry_id });
      linked.add(existing.entry_id);
    }
  }
  const conflicted = new Set(conflicts.map((conflict) => conflict.row.row));

  const autoReason = (date: IsoDate): ProposalReason | "auto" => {
    if (!covers(input.coverage, date)) return "incoming_not_complete";
    const previous = accountId === undefined ? "none" : previousCoverage(store, accountId, input.settings, date);
    if (previous === "compatible") return "auto";
    return previous === "incompatible" ? "incompatible_mapping" : "uncertain_coverage";
  };

  // 2. Counted occurrences within matching groups, independent of row order.
  const pool = new Map<string, Entry[]>();
  for (const entry of entries) {
    if (entry.source.source_id !== undefined || linked.has(entry.id)) continue;
    const key = groupKey(entry.source);
    pool.set(key, [...(pool.get(key) ?? []), entry]);
  }
  const pending = new Map<string, NormalisedRow[]>();
  for (const row of input.rows) {
    if (plans.has(row.row) || conflicted.has(row.row)) continue;
    const key = groupKey(row.values);
    pending.set(key, [...(pending.get(key) ?? []), row]);
  }
  const proposedEntries = new Set<string>();
  const unmatched: NormalisedRow[] = [];
  for (const [key, rows] of pending) {
    const existing = pool.get(key) ?? [];
    rows.forEach((row, index) => {
      const reason = autoReason(row.values.posted_date);
      const entry = existing[index];
      if (entry !== undefined) {
        if (reason === "auto") {
          plans.set(row.row, { kind: "reuse", row, basis: "occurrence_count", entry_id: entry.id });
          linked.add(entry.id);
        } else {
          const decision = decisions.get(row.row);
          plans.set(row.row, { kind: "proposed", row, entry_id: entry.id, reason, ...(decision === undefined ? {} : { decision }) });
          proposedEntries.add(entry.id);
          if (decision === "reuse") linked.add(entry.id);
        }
      } else if (existing.length > 0 && reason !== "auto") {
        // Identity is uncertain, so an identical-looking excess row is a duplicate candidate, never excluded.
        plans.set(row.row, { kind: "new", row, duplicate_of: (existing[0] as Entry).id });
      } else {
        unmatched.push(row);
      }
    });
  }

  // 3. Changed values: on a completely covered date, pair an unmatched row with an unmatched
  //    existing entry of the same movement and the same amount or description.
  const paired = new Set<string>();
  for (const row of unmatched.sort((a, b) => a.row - b.row)) {
    const date = row.values.posted_date;
    const candidate = covers(input.coverage, date)
      ? entries.find(
          (entry) =>
            entry.source.posted_date === date &&
            entry.source.source_id === undefined &&
            entry.source.source_movement === row.values.source_movement &&
            (entry.source.amount === row.values.amount || entry.source.description === row.values.description) &&
            !linked.has(entry.id) &&
            !proposedEntries.has(entry.id) &&
            !paired.has(entry.id),
        )
      : undefined;
    if (candidate === undefined) {
      plans.set(row.row, { kind: "new", row });
      continue;
    }
    paired.add(candidate.id);
    const decision = decisions.get(row.row);
    plans.set(row.row, { kind: "proposed", row, entry_id: candidate.id, reason: "changed_value", ...(decision === undefined ? {} : { decision }) });
    if (decision === "reuse") linked.add(candidate.id);
  }

  // 4. Discrepancies: existing entries on completely covered dates that this export did not
  //    contain, and entries whose values an explicit decision replaces. Nothing is deleted.
  const byDate = new Map<IsoDate, { missing: string[]; replaced: string[] }>();
  const at = (date: IsoDate) => {
    const found = byDate.get(date) ?? { missing: [], replaced: [] };
    byDate.set(date, found);
    return found;
  };
  for (const entry of entries) {
    if (covers(input.coverage, entry.source.posted_date) && !linked.has(entry.id)) at(entry.source.posted_date).missing.push(entry.id);
  }
  const rows = input.rows.filter((row) => !conflicted.has(row.row)).map((row) => plans.get(row.row) as RowPlan);
  for (const plan of rows) {
    if (plan.kind === "proposed" && plan.reason === "changed_value" && plan.decision === "reuse") {
      at(plan.row.values.posted_date).replaced.push(plan.entry_id);
    }
  }
  const discrepancies = [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([posted_date, found]) => ({ posted_date, missing_entry_ids: found.missing, replaced_entry_ids: found.replaced }));

  return { rows, conflicts, discrepancies };
}

export function undecidedRows(plan: ImportPlan): RowPlan[] {
  return plan.rows.filter((row) => row.kind === "proposed" && row.decision === undefined);
}

export type ImportMeta = {
  readonly accountName: string;
  readonly fileName: string;
  readonly sha256: string;
  readonly now: Timestamp;
};

export type AppliedImport = {
  readonly store: Store;
  readonly import: ImportRecord;
  readonly account: Account;
  readonly mapping: CsvMapping;
  readonly created: readonly Entry[];
};

function addHistory(store: Store, record: Omit<HistoryRecord, "id">): Store {
  const withId = nextId(store, "hist");
  return { ...withId.store, history: [...withId.store.history, { id: withId.id, ...record }] };
}

function replaceEntry(store: Store, entry: Entry): Store {
  return { ...store, entries: store.entries.map((candidate) => (candidate.id === entry.id ? entry : candidate)) };
}

/**
 * Commit a fully decided plan: the account (if new), the mapping version (if changed), the import
 * record, new unreviewed entries and one source record per row with its entry link and match basis.
 * Reused entries keep their IDs, classifications and review states.
 */
export function applyImport(store: Store, input: ImportInput, plan: ImportPlan, meta: ImportMeta): AppliedImport {
  if (plan.conflicts.length > 0 || undecidedRows(plan).length > 0) {
    throw new Error("applyImport needs a plan without conflicts or undecided rows");
  }
  let next = store;

  let account = input.accountId === undefined ? undefined : next.accounts.find((candidate) => candidate.id === input.accountId);
  if (account === undefined) {
    const withId = nextId(next, "acct");
    account = { id: withId.id, name: meta.accountName, created_at: meta.now };
    next = { ...withId.store, accounts: [...withId.store.accounts, account] };
  }
  const accountId = account.id;

  const versions = next.mappings.filter((mapping) => mapping.account_id === accountId);
  const latest = versions.at(-1);
  let mapping: CsvMapping;
  if (latest !== undefined && sameSettings(settingsOf(latest), input.settings)) {
    mapping = latest;
  } else {
    const withId = nextId(next, "map");
    mapping = { id: withId.id, account_id: accountId, version: versions.length + 1, ...input.settings, confirmed_at: meta.now };
    next = { ...withId.store, mappings: [...withId.store.mappings, mapping] };
  }

  const importId = nextId(next, "imp");
  next = importId.store;
  const created: Entry[] = [];
  const sourceRecords: SourceRecord[] = [];

  const newEntry = (row: NormalisedRow, duplicateOf: string | undefined): Entry => {
    const result = createImportedEntry(next, accountId, row.values, meta.now);
    const entry: Entry = duplicateOf === undefined ? result.entry : { ...result.entry, duplicate: { status: "candidate", of_entry_id: duplicateOf } };
    next = replaceEntry(result.store, entry);
    created.push(entry);
    return entry;
  };

  for (const rowPlan of plan.rows) {
    const { row } = rowPlan;
    let entryId: string;
    let match: SourceMatch;
    if (rowPlan.kind === "reuse") {
      entryId = rowPlan.entry_id;
      match = { basis: rowPlan.basis };
    } else if (rowPlan.kind === "new") {
      entryId = newEntry(row, rowPlan.duplicate_of).id;
      match = { basis: "new" };
    } else if (rowPlan.decision === "keep_separate") {
      entryId = newEntry(row, rowPlan.reason === "changed_value" ? undefined : rowPlan.entry_id).id;
      match = { basis: "user_keep_separate", reason: rowPlan.reason, proposed_entry_id: rowPlan.entry_id };
    } else {
      entryId = rowPlan.entry_id;
      match = { basis: "user_reuse", reason: rowPlan.reason, proposed_entry_id: rowPlan.entry_id };
      if (rowPlan.reason === "changed_value") {
        const retained = next.entries.find((entry) => entry.id === rowPlan.entry_id) as Entry;
        // Applying changed values is explicit; a changed amount changes financial meaning and needs fresh review.
        const updated: Entry = {
          ...retained,
          source: row.values,
          review_state: retained.source.amount === row.values.amount ? retained.review_state : "unreviewed",
        };
        next = addHistory(replaceEntry(next, updated), {
          at: meta.now,
          kind: "entry_source_replaced",
          subject_type: "entry",
          subject_id: retained.id,
          before: { source: retained.source, review_state: retained.review_state },
          after: { source: updated.source, review_state: updated.review_state },
          note: `Import ${importId.id}, row ${row.row}`,
        });
        match = { ...match, previous_values: retained.source };
      }
    }
    const sourceId = nextId(next, "src");
    next = sourceId.store;
    sourceRecords.push({
      id: sourceId.id,
      import_id: importId.id,
      account_id: accountId,
      row: row.row,
      line: row.line,
      raw: row.raw,
      values: row.values,
      entry_id: entryId,
      match,
    });
  }

  const record: ImportRecord = {
    id: importId.id,
    account_id: accountId,
    mapping_id: mapping.id,
    file_name: meta.fileName,
    file_sha256: meta.sha256,
    row_count: plan.rows.length,
    coverage: input.coverage,
    discrepancies: plan.discrepancies,
    imported_at: meta.now,
  };
  next = { ...next, imports: [...next.imports, record], source_records: [...next.source_records, ...sourceRecords] };
  return { store: next, import: record, account, mapping, created };
}

const REUSE_BASES = new Set(["source_id", "occurrence_count", "user_reuse"]);

/**
 * Reverse an incorrect reuse: the source row gets its own new unreviewed entry and the retained
 * entry is preserved. A changed-value replacement is undone on the retained entry.
 */
export function reverseSourceReuse(store: Store, sourceRecordId: string, now: Timestamp): { readonly store: Store; readonly entry: Entry } {
  const source = store.source_records.find((candidate) => candidate.id === sourceRecordId);
  if (source === undefined) {
    throw new CliError(`No source row ${sourceRecordId}.`);
  }
  if (!REUSE_BASES.has(source.match.basis)) {
    throw new CliError(`Source row ${sourceRecordId} did not reuse an existing entry, so there is nothing to reverse.`);
  }
  const retained = store.entries.find((entry) => entry.id === source.entry_id) as Entry;
  let next = store;
  if (source.match.previous_values !== undefined) {
    if (differingFields(retained.source, source.values).length > 0) {
      throw new CliError(`Entry ${retained.id} has changed since source row ${sourceRecordId} replaced its values; reverse the later change first.`);
    }
    next = replaceEntry(next, { ...retained, source: source.match.previous_values });
  }
  const created = createImportedEntry(next, source.account_id, source.values, now);
  next = created.store;
  const match: SourceMatch = { basis: "reuse_reversed", reversed_from_entry_id: retained.id };
  const updated: SourceRecord = { ...source, entry_id: created.entry.id, match };
  next = { ...next, source_records: next.source_records.map((candidate) => (candidate.id === source.id ? updated : candidate)) };
  next = addHistory(next, {
    at: now,
    kind: "source_reuse_reversed",
    subject_type: "source_record",
    subject_id: source.id,
    before: { entry_id: source.entry_id, match: source.match },
    after: { entry_id: updated.entry_id, match },
  });
  return { store: next, entry: created.entry };
}
