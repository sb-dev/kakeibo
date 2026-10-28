import { isTreatment } from "../classification/vocabulary.ts";
import { isPence } from "../money/pence.ts";
import { parseMonth } from "../periods/periods.ts";
import { err, ok, type Result } from "../result.ts";
import { ID_PREFIXES, SCHEMA_VERSION, STORE_CURRENCY, type Store } from "./schema.ts";

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
      });
    });
  }

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
