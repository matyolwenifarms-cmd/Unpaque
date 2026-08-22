// The length limits the database enforces, copied where a person can be told
// about them before they lose their typing.
//
// Every one of these is a `check (length(btrim(x)) between 1 and n)` in a
// migration. Without a copy here the only thing that notices is Postgres, and
// what a user sees is `new row for relation "events" violates check constraint
// "events_label_check"` — a sentence that names no field, states no limit,
// suggests no action, and reads as a broken application rather than a full box.
// That happened, to somebody pasting a paragraph of a news report into a field
// that holds a short label.
//
// This is a duplicate of a server rule, so it is drift-tested: limits.test.ts
// reads the migrations and asserts every number here still matches the
// constraint it mirrors. A copy nobody checks becomes a lie the first time
// somebody widens a column.
//
// The server rule stays where it is. This is a courtesy, not the enforcement —
// anything posted straight to PostgREST still meets the constraint.

export interface TextLimit {
  /** Longest permitted, after trimming. */
  readonly max: number;
  /** The constraint this mirrors, so the drift test knows what to read. */
  readonly constraint: string;
  /** What to call the field in a sentence addressed to a person. */
  readonly noun: string;
}

export const TEXT_LIMITS = {
  caseTitle: { max: 200, constraint: "cases_title_check", noun: "case title" },
  sourceTitle: { max: 500, constraint: "sources_title_check", noun: "source name" },
  claimStatement: { max: 2000, constraint: "claims_statement_check", noun: "claim" },
  eventLabel: { max: 300, constraint: "events_label_check", noun: "event" },
  eventMoment: { max: 200, constraint: "events_moment_check", noun: "moment" },
} as const satisfies Record<string, TextLimit>;

export type TextLimitName = keyof typeof TEXT_LIMITS;

/**
 * What is wrong with this value, in a sentence, or null if nothing is.
 *
 * Counts the trimmed length because that is what the constraint counts. A
 * message quoting a number the database is not using would send somebody
 * deleting words that were never the problem.
 */
export function textProblem(value: string, limit: TextLimit): string | null {
  const length = value.trim().length;
  if (length === 0) return null;
  if (length <= limit.max) return null;
  return `That ${limit.noun} is ${length} characters. The longest that can be saved is ${limit.max} — trim ${length - limit.max}.`;
}

/** True when the value is long enough to be worth showing a counter for. */
export function nearLimit(value: string, limit: TextLimit): boolean {
  // Three quarters. Earlier is nagging on every field; later is a counter that
  // appears at the moment it stops being useful.
  return value.trim().length >= limit.max * 0.75;
}
