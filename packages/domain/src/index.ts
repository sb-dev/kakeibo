export { DomainError, MoneyRangeError } from "./errors.ts";
export { err, ok, type Result } from "./result.ts";
export {
  addPence,
  formatPence,
  formatPencePlain,
  isPence,
  negatePence,
  parseMoney,
  pence,
  subPence,
  sumPence,
  type MoneyParseError,
  type Pence,
} from "./money/pence.ts";
export {
  addDays,
  currentDate,
  currentMonth,
  datesInRange,
  dayOfWeek,
  monthEndOf,
  monthOf,
  monthSegments,
  monthStartOf,
  parseIsoDate,
  parseMonth,
  parseWeekStart,
  weekEndOf,
  weekStartOf,
  type IsoDate,
  type Month,
  type MonthSegment,
  type PeriodError,
} from "./periods/periods.ts";
export {
  ENVELOPES,
  MOVEMENTS,
  PURPOSES,
  REVIEW_STATES,
  TREATMENTS,
  TREATMENT_LABELS,
  isTreatment,
  type Envelope,
  type Movement,
  type Purpose,
  type ReviewState,
  type Treatment,
} from "./classification/vocabulary.ts";
export {
  ENTRY_TYPES,
  allowedTreatments,
  classificationProblems,
  entryTypeOf,
  entryTypesFor,
  type Classification,
  type EntryType,
} from "./classification/rules.ts";
export { MAX_CATEGORY_NAME_LENGTH, addCategory, findCategory } from "./classification/categories.ts";
export {
  CSV_DELIMITERS,
  DATE_FORMATS,
  DUPLICATE_STATUSES,
  ID_PREFIXES,
  MATCH_BASES,
  NORMALISATION_VERSION,
  PROPOSAL_REASONS,
  SCHEMA_VERSION,
  STORE_CURRENCY,
  type Account,
  type AmountLayout,
  type Category,
  type ClosedEntry,
  type CsvDelimiter,
  type CsvMapping,
  type DateFormat,
  type DuplicateState,
  type Entry,
  type EnvelopeLimits,
  type Goal,
  type GoalAllocation,
  type GoalContributionLink,
  type HistoryKind,
  type HistoryRecord,
  type IdPrefix,
  type ImportCoverage,
  type ImportDiscrepancy,
  type ImportRecord,
  type MatchBasis,
  type MonthPlan,
  type PlanRevision,
  type ProposalReason,
  type ReviewClosure,
  type ReviewReflection,
  type SourceMatch,
  type SourceMovement,
  type SourceRecord,
  type SourceValues,
  type Store,
  type Timestamp,
  type WeeklyReview,
} from "./store/schema.ts";
export { createImportedEntry, entryRevision, findEntry, reviseEntry, uncategorisedCategoryId } from "./entries/entries.ts";
export {
  compareEntries,
  countsAsSpending,
  entriesInRange,
  goalContributions,
  isDuplicateCandidate,
  isExcludedDuplicate,
  spendingTotals,
  type GoalContribution,
  type ReviewSplit,
  type SpendingAmounts,
  type SpendingTotals,
} from "./review/totals.ts";
export { applyEntryCorrection, confirmEntries, type EntryCorrection } from "./review/corrections.ts";
export { applyDuplicateDecisions, duplicateProblems, restoreDuplicates, type DuplicateDecision } from "./review/duplicates.ts";
export { goalLinkProblems, linkFor } from "./review/goal-links.ts";
export { closeReview, findReview, reviewStatus, saveReflection, weekEntries, type ReviewStatus } from "./review/weekly.ts";
export { INITIAL_CATEGORIES, SAVINGS_GOAL_NAME, createEmptyStore, savingsGoal } from "./store/create.ts";
export { nextId } from "./store/ids.ts";
export { validateStore, type StoreValidationError } from "./store/validate.ts";
export {
  describePlanError,
  envelopeTotal,
  flexibleBudget,
  goalAllocationTotal,
  validatePlan,
  type PlanInput,
  type PlanValidationError,
  type ValidatedPlan,
} from "./plan/plan.ts";
export { addPlanRevision, currentPlanRevision, monthPlan, type PlanRevisionResult } from "./plan/revisions.ts";
