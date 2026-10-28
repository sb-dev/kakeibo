import type { Movement, Purpose, ReviewState, Treatment } from "../classification/vocabulary.ts";
import type { Pence } from "../money/pence.ts";
import type { IsoDate, Month } from "../periods/periods.ts";

/**
 * Versioned local store. Keys use snake_case to mirror Financial Model §5 names.
 * Collections that later tasks populate (contribution links, reviews) are present but
 * empty in schema version 1.
 */
export const SCHEMA_VERSION = 1;
export const STORE_CURRENCY = "GBP";

export const ID_PREFIXES = ["acct", "map", "imp", "src", "tx", "cat", "goal", "rev", "hist"] as const;
export type IdPrefix = (typeof ID_PREFIXES)[number];

/** ISO 8601 timestamp with timezone, e.g. 2026-10-28T10:01:02.000Z. */
export type Timestamp = string;

export type Category = {
  readonly id: string;
  readonly treatment: Treatment;
  readonly name: string;
  readonly created_at: Timestamp;
};

export type GoalKind = "plan_funded";
export type GoalStatus = "active";

/** The single plan-funded Savings goal (Financial Model §6.1). */
export type Goal = {
  readonly id: string;
  readonly name: string;
  readonly kind: GoalKind;
  readonly status: GoalStatus;
  readonly created_at: Timestamp;
};

export type GoalAllocation = {
  readonly goal_id: string;
  readonly amount: Pence;
};

export type EnvelopeLimits = {
  readonly needs: Pence;
  readonly wants: Pence;
  readonly culture: Pence;
  readonly unexpected: Pence;
};

/** One confirmed revision of a month's plan. Earlier revisions are retained. */
export type PlanRevision = {
  readonly revision: number;
  readonly planning_income: Pence;
  readonly fixed_commitments: Pence;
  readonly plan_funded_goal_allocations: readonly GoalAllocation[];
  readonly envelopes: EnvelopeLimits;
  readonly intention?: string;
  readonly confirmed_at: Timestamp;
};

export type MonthPlan = {
  readonly month: Month;
  readonly revisions: readonly PlanRevision[];
};

/** A named personal account. Created by the first confirmed import that names it. */
export type Account = {
  readonly id: string;
  readonly name: string;
  readonly created_at: Timestamp;
};

export const DATE_FORMATS = ["YYYY-MM-DD", "DD/MM/YYYY"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export const CSV_DELIMITERS = [",", ";"] as const;
export type CsvDelimiter = (typeof CSV_DELIMITERS)[number];

/** Version of the conservative text normalisation applied to source values (Financial Model §10.3). */
export const NORMALISATION_VERSION = 1;

/**
 * How amounts are laid out. Source signs are not globally meaningful (Financial Model §3.1),
 * so a signed column records which sign means money out.
 */
export type AmountLayout =
  | { readonly kind: "signed"; readonly column: string; readonly money_out_sign: "negative" | "positive" }
  | { readonly kind: "debit_credit"; readonly debit_column: string; readonly credit_column: string };

/** One confirmed CSV mapping version for an account. Never modified; a remap adds a version. */
export type CsvMapping = {
  readonly id: string;
  readonly account_id: string;
  readonly version: number;
  readonly delimiter: CsvDelimiter;
  readonly header: readonly string[];
  readonly date_column: string;
  readonly date_format: DateFormat;
  readonly description_column: string;
  readonly amount: AmountLayout;
  readonly source_id_column?: string;
  readonly currency_column?: string;
  readonly reference_column?: string;
  readonly normalisation_version: typeof NORMALISATION_VERSION;
  readonly confirmed_at: Timestamp;
};

export type SourceMovement = "inflow" | "outflow";

/** Source-normalised values of one row. Amount is a positive magnitude; direction is the movement. */
export type SourceValues = {
  readonly posted_date: IsoDate;
  readonly description: string;
  readonly currency: typeof STORE_CURRENCY;
  readonly source_movement: SourceMovement;
  readonly amount: Pence;
  readonly reference?: string;
  readonly source_id?: string;
};

/**
 * Declared posted-transaction coverage of an export. Only an explicit declaration establishes
 * completeness; it is never inferred from the first and last rows (Financial Model §10.3).
 */
export type ImportCoverage =
  | { readonly completeness: "complete"; readonly from: IsoDate; readonly to: IsoDate; readonly basis: "user_declaration" }
  | { readonly completeness: "partial" }
  | { readonly completeness: "unknown" };

/** A posted date where a complete export disagreed with existing occurrences. */
export type ImportDiscrepancy = {
  readonly posted_date: IsoDate;
  /** Existing entries on that date that the export did not contain. They are kept. */
  readonly missing_entry_ids: readonly string[];
  /** Existing entries whose source values were replaced by an explicit decision. */
  readonly replaced_entry_ids: readonly string[];
};

export type ImportRecord = {
  readonly id: string;
  readonly account_id: string;
  readonly mapping_id: string;
  readonly file_name: string;
  readonly file_sha256: string;
  readonly row_count: number;
  readonly coverage: ImportCoverage;
  readonly discrepancies: readonly ImportDiscrepancy[];
  readonly imported_at: Timestamp;
};

export const MATCH_BASES = [
  "new",
  "source_id",
  "occurrence_count",
  "user_reuse",
  "user_keep_separate",
  "reuse_reversed",
] as const;
/** Why a source row is linked to its entry. */
export type MatchBasis = (typeof MATCH_BASES)[number];

export const PROPOSAL_REASONS = [
  "incoming_not_complete",
  "incompatible_mapping",
  "uncertain_coverage",
  "changed_value",
  "source_id_missing",
] as const;
/** Why a proposed match needed an explicit decision instead of automatic reuse. */
export type ProposalReason = (typeof PROPOSAL_REASONS)[number];

export type SourceMatch = {
  readonly basis: MatchBasis;
  readonly reason?: ProposalReason;
  readonly proposed_entry_id?: string;
  /** The retained entry's source values before a changed-value replacement. */
  readonly previous_values?: SourceValues;
  readonly reversed_from_entry_id?: string;
};

/** One observed source row from one import, linked to the entry that represents it. */
export type SourceRecord = {
  readonly id: string;
  readonly import_id: string;
  readonly account_id: string;
  /** 1-based data row position in the file (the header is not counted). */
  readonly row: number;
  /** Physical line number in the file, for messages. */
  readonly line: number;
  readonly raw: Readonly<Record<string, string>>;
  readonly values: SourceValues;
  readonly entry_id: string;
  readonly match: SourceMatch;
};

export type DuplicateState = {
  readonly status: "candidate";
  readonly of_entry_id: string;
};

/**
 * A financial entry (Financial Model §3). `source` holds the source-normalised values used for
 * reconciliation; movement, purpose, treatment, category and review state are separate and editable.
 */
export type Entry = {
  readonly id: string;
  readonly account_id: string;
  readonly source: SourceValues;
  readonly movement: Movement;
  readonly purpose: Purpose;
  readonly treatment: Treatment;
  readonly category_id: string;
  readonly review_state: ReviewState;
  readonly duplicate?: DuplicateState;
  readonly created_at: Timestamp;
};

export type HistoryKind = "plan_confirmed" | "entry_source_replaced" | "entry_source_restored" | "source_reuse_reversed";

/** Explains an explicit change: what changed, when and from/to what. */
export type HistoryRecord = {
  readonly id: string;
  readonly at: Timestamp;
  readonly kind: HistoryKind;
  readonly subject_type: "plan" | "entry" | "source_record";
  readonly subject_id: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly note?: string;
};

export type Store = {
  readonly schema_version: typeof SCHEMA_VERSION;
  readonly currency: typeof STORE_CURRENCY;
  readonly created_at: Timestamp;
  readonly counters: Readonly<Partial<Record<IdPrefix, number>>>;
  readonly accounts: readonly Account[];
  readonly mappings: readonly CsvMapping[];
  readonly imports: readonly ImportRecord[];
  readonly source_records: readonly SourceRecord[];
  readonly entries: readonly Entry[];
  readonly categories: readonly Category[];
  readonly goals: readonly Goal[];
  readonly plans: readonly MonthPlan[];
  readonly goal_contribution_links: readonly unknown[];
  readonly reviews: readonly unknown[];
  readonly history: readonly HistoryRecord[];
};
