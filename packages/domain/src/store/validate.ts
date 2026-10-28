import { MOVEMENTS, PURPOSES, REVIEW_STATES, isTreatment } from "../classification/vocabulary.ts";
import { MoneyRangeError } from "../errors.ts";
import { isPence, type Pence } from "../money/pence.ts";
import { describePlanError, validatePlan } from "../plan/plan.ts";
import { parseIsoDate, parseMonth } from "../periods/periods.ts";
import { err, ok, type Result } from "../result.ts";
import {
  CSV_DELIMITERS,
  DATE_FORMATS,
  ID_PREFIXES,
  MATCH_BASES,
  NORMALISATION_VERSION,
  PROPOSAL_REASONS,
  SCHEMA_VERSION,
  STORE_CURRENCY,
  type Store,
} from "./schema.ts";

export type StoreValidationError = {
  readonly path: string;
  readonly message: string;
};

type Json = Record<string, unknown>;

const COLLECTIONS = [
  "accounts",
  "mappings",
  "imports",
  "source_records",
  "entries",
  "categories",
  "goals",
  "plans",
  "goal_contribution_links",
  "reviews",
  "history",
] as const;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

function isOneOf(values: readonly string[], value: unknown): boolean {
  return typeof value === "string" && values.includes(value);
}

function isIsoDate(value: unknown): boolean {
  return typeof value === "string" && parseIsoDate(value).ok;
}

type Fail = (path: string, message: string) => void;

function validateSourceValues(values: unknown, path: string, fail: Fail): void {
  if (!isObject(values)) {
    fail(path, "expected an object");
    return;
  }
  if (!isIsoDate(values["posted_date"])) fail(`${path}.posted_date`, "expected a date in YYYY-MM-DD form");
  if (!isNonEmptyString(values["description"])) fail(`${path}.description`, "expected a description");
  if (values["currency"] !== STORE_CURRENCY) fail(`${path}.currency`, `expected ${STORE_CURRENCY}`);
  if (values["source_movement"] !== "inflow" && values["source_movement"] !== "outflow") {
    fail(`${path}.source_movement`, "expected inflow or outflow");
  }
  if (!isPence(values["amount"]) || (values["amount"] as number) <= 0) fail(`${path}.amount`, "expected positive integer pence");
  for (const optional of ["reference", "source_id"] as const) {
    if (values[optional] !== undefined && !isNonEmptyString(values[optional])) {
      fail(`${path}.${optional}`, "expected a non-empty string when present");
    }
  }
}

/** Validate each object in a collection and collect its IDs, reporting duplicates. */
function eachRecord(value: unknown, name: string, fail: Fail, check: (record: Json, path: string) => void): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(value)) {
    return ids;
  }
  value.forEach((record: unknown, index) => {
    const path = `${name}[${index}]`;
    if (!isObject(record)) {
      fail(path, "expected an object");
      return;
    }
    if (!isNonEmptyString(record["id"])) {
      fail(`${path}.id`, "expected a string");
    } else if (ids.has(record["id"])) {
      fail(`${path}.id`, `duplicate ID ${record["id"]}`);
    } else {
      ids.add(record["id"]);
    }
    check(record, path);
  });
  return ids;
}

/** A revision whose amounts have already passed the structural checks above. */
type StoredRevision = {
  readonly planning_income: Pence;
  readonly fixed_commitments: Pence;
  readonly plan_funded_goal_allocations: readonly { readonly goal_id: string; readonly amount: Pence }[];
  readonly envelopes: { readonly needs: Pence; readonly wants: Pence; readonly culture: Pence; readonly unexpected: Pence };
};

function validateRevisionEquations(revision: StoredRevision, path: string, fail: (path: string, message: string) => void): void {
  try {
    const result = validatePlan({
      planning_income: revision.planning_income,
      fixed_commitments: revision.fixed_commitments,
      plan_funded_goal_allocations: revision.plan_funded_goal_allocations,
      envelopes: revision.envelopes,
    });
    if (!result.ok) {
      for (const error of result.error) {
        fail(path, describePlanError(error));
      }
    }
  } catch (error) {
    if (error instanceof MoneyRangeError) {
      fail(path, "plan totals leave the safe integer range");
      return;
    }
    throw error;
  }
}

/**
 * Structural validation of a parsed store. Pure: no filesystem access.
 * Unknown keys are ignored so later schema additions remain readable.
 * Returns every problem found rather than stopping at the first.
 */
export function validateStore(value: unknown): Result<Store, readonly StoreValidationError[]> {
  const errors: StoreValidationError[] = [];
  const fail = (path: string, message: string): void => {
    errors.push({ path, message });
  };

  if (!isObject(value)) {
    return err([{ path: "$", message: "store must be a JSON object" }]);
  }

  if (value["schema_version"] !== SCHEMA_VERSION) {
    const found = value["schema_version"];
    if (typeof found === "number" && found > SCHEMA_VERSION) {
      fail("schema_version", `schema version ${found} is newer than the supported version ${SCHEMA_VERSION}`);
    } else {
      fail("schema_version", `expected schema version ${SCHEMA_VERSION}, found ${JSON.stringify(found)}`);
    }
  }
  if (value["currency"] !== STORE_CURRENCY) {
    fail("currency", `expected currency ${STORE_CURRENCY}, found ${JSON.stringify(value["currency"])}`);
  }
  if (typeof value["created_at"] !== "string") {
    fail("created_at", "expected a timestamp string");
  }

  const counters = value["counters"];
  if (!isObject(counters)) {
    fail("counters", "expected an object of ID counters");
  } else {
    for (const [prefix, count] of Object.entries(counters)) {
      if (!(ID_PREFIXES as readonly string[]).includes(prefix)) {
        fail(`counters.${prefix}`, "unknown ID prefix");
      } else if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
        fail(`counters.${prefix}`, "expected a non-negative integer");
      }
    }
  }

  for (const name of COLLECTIONS) {
    if (!Array.isArray(value[name])) {
      fail(name, "expected an array");
    }
  }

  if (Array.isArray(value["categories"])) {
    value["categories"].forEach((category: unknown, index) => {
      const path = `categories[${index}]`;
      if (!isObject(category)) {
        fail(path, "expected an object");
        return;
      }
      if (typeof category["id"] !== "string") fail(`${path}.id`, "expected a string");
      if (!isTreatment(category["treatment"])) fail(`${path}.treatment`, "unknown treatment");
      if (typeof category["name"] !== "string" || category["name"] === "") fail(`${path}.name`, "expected a name");
      if (typeof category["created_at"] !== "string") fail(`${path}.created_at`, "expected a timestamp string");
    });
  }

  const goalIds = new Set<string>();
  if (Array.isArray(value["goals"])) {
    value["goals"].forEach((goal: unknown, index) => {
      const path = `goals[${index}]`;
      if (!isObject(goal)) {
        fail(path, "expected an object");
        return;
      }
      if (typeof goal["id"] === "string") goalIds.add(goal["id"]);
      else fail(`${path}.id`, "expected a string");
      if (typeof goal["name"] !== "string" || goal["name"] === "") fail(`${path}.name`, "expected a name");
      if (goal["kind"] !== "plan_funded") fail(`${path}.kind`, "expected plan_funded");
      if (goal["status"] !== "active") fail(`${path}.status`, "expected active");
      if (typeof goal["created_at"] !== "string") fail(`${path}.created_at`, "expected a timestamp string");
    });
  }

  if (Array.isArray(value["plans"])) {
    const months = new Set<string>();
    value["plans"].forEach((plan: unknown, index) => {
      const path = `plans[${index}]`;
      if (!isObject(plan)) {
        fail(path, "expected an object");
        return;
      }
      if (typeof plan["month"] !== "string" || !parseMonth(plan["month"]).ok) {
        fail(`${path}.month`, "expected a month in YYYY-MM form");
      } else if (months.has(plan["month"])) {
        fail(`${path}.month`, `duplicate plan for ${plan["month"]}`);
      } else {
        months.add(plan["month"]);
      }
      const revisions = plan["revisions"];
      if (!Array.isArray(revisions) || revisions.length === 0) {
        fail(`${path}.revisions`, "expected a non-empty array of revisions");
        return;
      }
      revisions.forEach((revision: unknown, revisionIndex) => {
        const rpath = `${path}.revisions[${revisionIndex}]`;
        if (!isObject(revision)) {
          fail(rpath, "expected an object");
          return;
        }
        const errorsBefore = errors.length;
        if (revision["revision"] !== revisionIndex + 1) {
          fail(`${rpath}.revision`, `expected revision number ${revisionIndex + 1}`);
        }
        for (const field of ["planning_income", "fixed_commitments"] as const) {
          if (!isPence(revision[field]) || (revision[field] as number) < 0) {
            fail(`${rpath}.${field}`, "expected non-negative integer pence");
          }
        }
        const allocations = revision["plan_funded_goal_allocations"];
        if (!Array.isArray(allocations)) {
          fail(`${rpath}.plan_funded_goal_allocations`, "expected an array");
        } else {
          allocations.forEach((allocation: unknown, allocationIndex) => {
            const apath = `${rpath}.plan_funded_goal_allocations[${allocationIndex}]`;
            if (!isObject(allocation)) {
              fail(apath, "expected an object");
              return;
            }
            if (typeof allocation["goal_id"] !== "string" || !goalIds.has(allocation["goal_id"])) {
              fail(`${apath}.goal_id`, "references an unknown goal");
            }
            if (!isPence(allocation["amount"]) || (allocation["amount"] as number) < 0) {
              fail(`${apath}.amount`, "expected non-negative integer pence");
            }
          });
        }
        const envelopes = revision["envelopes"];
        if (!isObject(envelopes)) {
          fail(`${rpath}.envelopes`, "expected an object");
        } else {
          for (const envelope of ["needs", "wants", "culture", "unexpected"] as const) {
            if (!isPence(envelopes[envelope]) || (envelopes[envelope] as number) < 0) {
              fail(`${rpath}.envelopes.${envelope}`, "expected non-negative integer pence");
            }
          }
        }
        if (revision["intention"] !== undefined && typeof revision["intention"] !== "string") {
          fail(`${rpath}.intention`, "expected a string when present");
        }
        if (typeof revision["confirmed_at"] !== "string") {
          fail(`${rpath}.confirmed_at`, "expected a timestamp string");
        }
        // Once every amount is structurally valid, the revision must satisfy the planning
        // equations (Financial Model §5). A stored plan that does not balance is corrupt.
        if (errors.length === errorsBefore) {
          validateRevisionEquations(revision as StoredRevision, rpath, fail);
        }
      });
    });
  }

  validateImportCollections(value, fail);

  if (Array.isArray(value["history"])) {
    value["history"].forEach((record: unknown, index) => {
      const path = `history[${index}]`;
      if (!isObject(record)) {
        fail(path, "expected an object");
        return;
      }
      if (typeof record["id"] !== "string") fail(`${path}.id`, "expected a string");
      if (typeof record["at"] !== "string") fail(`${path}.at`, "expected a timestamp string");
      if (typeof record["kind"] !== "string") fail(`${path}.kind`, "expected a string");
      if (typeof record["subject_type"] !== "string") fail(`${path}.subject_type`, "expected a string");
      if (typeof record["subject_id"] !== "string") fail(`${path}.subject_id`, "expected a string");
      if (!("before" in record) || !("after" in record)) fail(path, "expected before and after values");
    });
  }

  if (errors.length > 0) {
    return err(errors);
  }
  return ok(value as unknown as Store);
}

/** Accounts, mappings, imports, source records and entries (CLI MVP T2), with their references. */
function validateImportCollections(value: Json, fail: Fail): void {
  const accountNames = new Set<string>();
  const accountIds = eachRecord(value["accounts"], "accounts", fail, (account, path) => {
    if (!isNonEmptyString(account["name"]) || account["name"].trim() !== account["name"]) {
      fail(`${path}.name`, "expected a trimmed name");
    } else if (accountNames.has(account["name"].toLowerCase())) {
      fail(`${path}.name`, `duplicate account name ${account["name"]}`);
    } else {
      accountNames.add(account["name"].toLowerCase());
    }
    if (typeof account["created_at"] !== "string") fail(`${path}.created_at`, "expected a timestamp string");
  });

  const mappingVersions = new Set<string>();
  const mappingIds = eachRecord(value["mappings"], "mappings", fail, (mapping, path) => {
    if (typeof mapping["account_id"] !== "string" || !accountIds.has(mapping["account_id"])) {
      fail(`${path}.account_id`, "references an unknown account");
    }
    const version = mapping["version"];
    if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 1) {
      fail(`${path}.version`, "expected a positive integer");
    } else {
      const key = `${String(mapping["account_id"])}#${version}`;
      if (mappingVersions.has(key)) fail(`${path}.version`, `duplicate mapping version ${version}`);
      mappingVersions.add(key);
    }
    if (!isOneOf(CSV_DELIMITERS, mapping["delimiter"])) fail(`${path}.delimiter`, "expected , or ;");
    const header = mapping["header"];
    const columns = new Set(Array.isArray(header) ? header.filter((name) => typeof name === "string") : []);
    if (!Array.isArray(header) || columns.size !== header.length) fail(`${path}.header`, "expected unique column names");
    const requireColumn = (field: string, column: unknown): void => {
      if (!isNonEmptyString(column) || !columns.has(column)) fail(`${path}.${field}`, "expected a column from the header");
    };
    requireColumn("date_column", mapping["date_column"]);
    requireColumn("description_column", mapping["description_column"]);
    if (!isOneOf(DATE_FORMATS, mapping["date_format"])) fail(`${path}.date_format`, "unsupported date format");
    const amount = mapping["amount"];
    if (isObject(amount) && amount["kind"] === "signed") {
      requireColumn("amount.column", amount["column"]);
      if (amount["money_out_sign"] !== "negative" && amount["money_out_sign"] !== "positive") {
        fail(`${path}.amount.money_out_sign`, "expected negative or positive");
      }
    } else if (isObject(amount) && amount["kind"] === "debit_credit") {
      requireColumn("amount.debit_column", amount["debit_column"]);
      requireColumn("amount.credit_column", amount["credit_column"]);
    } else {
      fail(`${path}.amount`, "expected a signed or debit_credit layout");
    }
    for (const optional of ["source_id_column", "currency_column", "reference_column"] as const) {
      if (mapping[optional] !== undefined) requireColumn(optional, mapping[optional]);
    }
    if (mapping["normalisation_version"] !== NORMALISATION_VERSION) {
      fail(`${path}.normalisation_version`, `expected ${NORMALISATION_VERSION}`);
    }
    if (typeof mapping["confirmed_at"] !== "string") fail(`${path}.confirmed_at`, "expected a timestamp string");
  });

  const categoryIds = new Set(
    Array.isArray(value["categories"]) ? value["categories"].map((category: unknown) => (isObject(category) ? category["id"] : undefined)) : [],
  );
  const entryIds = eachRecord(value["entries"], "entries", fail, (entry, path) => {
    if (typeof entry["account_id"] !== "string" || !accountIds.has(entry["account_id"])) {
      fail(`${path}.account_id`, "references an unknown account");
    }
    validateSourceValues(entry["source"], `${path}.source`, fail);
    if (!isOneOf(MOVEMENTS, entry["movement"])) fail(`${path}.movement`, "unknown movement");
    if (!isOneOf(PURPOSES, entry["purpose"])) fail(`${path}.purpose`, "unknown purpose");
    if (!isTreatment(entry["treatment"])) fail(`${path}.treatment`, "unknown treatment");
    if (!categoryIds.has(entry["category_id"])) fail(`${path}.category_id`, "references an unknown category");
    if (!isOneOf(REVIEW_STATES, entry["review_state"])) fail(`${path}.review_state`, "unknown review state");
    if (typeof entry["created_at"] !== "string") fail(`${path}.created_at`, "expected a timestamp string");
  });
  // Duplicate references need every entry ID, so check them in a second pass.
  if (Array.isArray(value["entries"])) {
    value["entries"].forEach((entry: unknown, index) => {
      if (!isObject(entry) || entry["duplicate"] === undefined) return;
      const duplicate = entry["duplicate"];
      const path = `entries[${index}].duplicate`;
      if (!isObject(duplicate) || duplicate["status"] !== "candidate") {
        fail(path, "expected a candidate status");
      } else if (typeof duplicate["of_entry_id"] !== "string" || !entryIds.has(duplicate["of_entry_id"]) || duplicate["of_entry_id"] === entry["id"]) {
        fail(`${path}.of_entry_id`, "references an unknown or the same entry");
      }
    });
  }

  const importAccounts = new Map<string, unknown>();
  const importIds = eachRecord(value["imports"], "imports", fail, (record, path) => {
    importAccounts.set(String(record["id"]), record["account_id"]);
    if (typeof record["account_id"] !== "string" || !accountIds.has(record["account_id"])) {
      fail(`${path}.account_id`, "references an unknown account");
    }
    if (typeof record["mapping_id"] !== "string" || !mappingIds.has(record["mapping_id"])) {
      fail(`${path}.mapping_id`, "references an unknown mapping");
    }
    if (!isNonEmptyString(record["file_name"])) fail(`${path}.file_name`, "expected a file name");
    if (typeof record["file_sha256"] !== "string" || !/^[0-9a-f]{64}$/.test(record["file_sha256"])) {
      fail(`${path}.file_sha256`, "expected a SHA-256 hex digest");
    }
    const rowCount = record["row_count"];
    if (typeof rowCount !== "number" || !Number.isSafeInteger(rowCount) || rowCount < 1) fail(`${path}.row_count`, "expected a positive integer");
    const coverage = record["coverage"];
    if (!isObject(coverage)) {
      fail(`${path}.coverage`, "expected an object");
    } else if (coverage["completeness"] === "complete") {
      if (!isIsoDate(coverage["from"]) || !isIsoDate(coverage["to"]) || String(coverage["from"]) > String(coverage["to"])) {
        fail(`${path}.coverage`, "expected an ordered from/to date range");
      }
      if (coverage["basis"] !== "user_declaration") fail(`${path}.coverage.basis`, "expected user_declaration");
    } else if (coverage["completeness"] !== "partial" && coverage["completeness"] !== "unknown") {
      fail(`${path}.coverage.completeness`, "expected complete, partial or unknown");
    }
    if (!Array.isArray(record["discrepancies"])) {
      fail(`${path}.discrepancies`, "expected an array");
    } else {
      record["discrepancies"].forEach((discrepancy: unknown, index) => {
        const dpath = `${path}.discrepancies[${index}]`;
        if (!isObject(discrepancy) || !isIsoDate(discrepancy["posted_date"])) {
          fail(dpath, "expected a posted date");
          return;
        }
        for (const field of ["missing_entry_ids", "replaced_entry_ids"] as const) {
          const ids = discrepancy[field];
          if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string" && entryIds.has(id))) fail(`${dpath}.${field}`, "references an unknown entry");
        }
      });
    }
    if (typeof record["imported_at"] !== "string") fail(`${path}.imported_at`, "expected a timestamp string");
  });

  eachRecord(value["source_records"], "source_records", fail, (source, path) => {
    if (typeof source["import_id"] !== "string" || !importIds.has(source["import_id"])) {
      fail(`${path}.import_id`, "references an unknown import");
    } else if (importAccounts.get(source["import_id"]) !== source["account_id"]) {
      fail(`${path}.account_id`, "does not match its import's account");
    }
    for (const field of ["row", "line"] as const) {
      const position = source[field];
      if (typeof position !== "number" || !Number.isSafeInteger(position) || position < 1) fail(`${path}.${field}`, "expected a positive integer");
    }
    const raw = source["raw"];
    if (!isObject(raw) || !Object.values(raw).every((cell) => typeof cell === "string")) fail(`${path}.raw`, "expected raw string values");
    validateSourceValues(source["values"], `${path}.values`, fail);
    if (typeof source["entry_id"] !== "string" || !entryIds.has(source["entry_id"])) {
      fail(`${path}.entry_id`, "references an unknown entry");
    }
    const match = source["match"];
    if (!isObject(match) || !isOneOf(MATCH_BASES, match["basis"])) {
      fail(`${path}.match.basis`, "unknown match basis");
    } else {
      if (match["reason"] !== undefined && !isOneOf(PROPOSAL_REASONS, match["reason"])) fail(`${path}.match.reason`, "unknown reason");
      for (const field of ["proposed_entry_id", "reversed_from_entry_id"] as const) {
        const id = match[field];
        if (id !== undefined && (typeof id !== "string" || !entryIds.has(id))) fail(`${path}.match.${field}`, "references an unknown entry");
      }
      if (match["previous_values"] !== undefined) validateSourceValues(match["previous_values"], `${path}.match.previous_values`, fail);
    }
  });
}
