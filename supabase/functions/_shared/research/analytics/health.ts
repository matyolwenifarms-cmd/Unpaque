// What a supervisor says about a dataset before anybody runs anything.
//
// The analysis stage already refuses a procedure the columns cannot support,
// and `procedures.ts` is deliberate about not choosing between the ones they
// can — that is the researcher's decision and their supervisor's, and it
// follows from the design rather than from the shape of the spreadsheet.
//
// This is the step before that, and it is the one a novice has no way to do.
// A file opens, it looks fine, every column has a name, and none of the things
// below are visible in it. Each one is arithmetic over the parsed columns,
// each one changes what the numbers mean, and each is invisible until somebody
// who has done this before looks at the file.
//
// **Nothing here computes a result, and that is a rule rather than a scope
// decision.** A screen that listed every column pair with its p-value beside
// it would be a machine for producing false positives: the researcher picks
// the small number, and the twenty tests that produced it are never written
// down. So a finding is about the data, never about an outcome, and there is
// no field on one for a statistic.

import { isMissing, toNumber, type Column, type Dataset } from "./dataset.ts";

/**
 * How much a reader should slow down.
 *
 * `will_mislead` is a claim about the arithmetic, not a threat about the
 * software: a mean over a column read as text does not exist, and two levels
 * that differ by a trailing space are two groups in every test that follows.
 * Nothing here blocks anything — saying it did would be the second kind of
 * lie this project is against.
 */
export const HEALTH_LEVELS = ["note", "check", "will_mislead"] as const;
export type HealthLevel = (typeof HEALTH_LEVELS)[number];

export const HEALTH_KINDS = [
  "numbers_as_text",
  "levels_differ_by_case",
  "constant",
  "identifier",
  "missing",
  "tiny_group",
  "unbalanced",
  "duplicate_rows",
  "few_distinct_numeric",
] as const;
export type HealthKind = (typeof HEALTH_KINDS)[number];

export interface Finding {
  readonly kind: HealthKind;
  /** The column it is about; null for a finding about the whole table. */
  readonly column: string | null;
  readonly level: HealthLevel;
  /** What it is, in a sentence, with the numbers in it. */
  readonly says: string;
  /**
   * What to do about it. Always present, like a coherence tension's: a problem
   * with no next step is discouragement, and a novice who cannot act on a
   * finding learns to close the panel.
   */
  readonly consider: string;
}

/** Below this share of parseable values, a column is not numbers-as-text. */
const MOSTLY_NUMERIC = 0.8;
/** Missing above this is worth a sentence; above the second, a stronger one. */
const MISSING_WORTH_SAYING = 0.1;
const MISSING_SERIOUS = 0.4;
/** A group smaller than this supports nothing, whatever the test allows. */
const TINY_GROUP = 5;
/** Above this ratio between the largest and smallest group, say so. */
const UNBALANCED = 10;
/** Below this many rows, none of the proportions above mean anything. */
const ENOUGH_ROWS = 20;

function list(values: readonly string[], cap = 3): string {
  const shown = values.slice(0, cap).map((value) => `"${value}"`);
  return values.length > cap ? `${shown.join(", ")} and others` : shown.join(", ");
}

/**
 * A column of numbers that one bad cell turned into a category.
 *
 * The single most consequential thing wrong with a real export, and the least
 * visible: the column looks like numbers on screen, every procedure that needs
 * a numeric column silently refuses it, and the researcher concludes the tool
 * cannot do what they want.
 *
 * Naming the offending values is the whole finding, and the ones that reach
 * here are not the missing markers DASH `dataset.ts` already reads "n/a", "-"
 * and eight others as absent. What is left is an answer somebody actually
 * gave: "Prefer not to say" in an age column, "65+" in a banded one, "1,5"
 * from a spreadsheet with a comma decimal separator. Each is one cell, each
 * costs the whole column, and none of them is visible in a file of four
 * hundred rows.
 */
function numbersAsText(column: Column): Finding | null {
  if (column.kind !== "categorical" && column.kind !== "text") return null;

  const present = column.values.filter(
    (value): value is string => value !== null && !isMissing(value),
  );
  if (present.length === 0) return null;

  const offenders = new Map<string, number>();
  let numeric = 0;
  for (const value of present) {
    if (Number.isFinite(toNumber(value))) numeric += 1;
    else offenders.set(value, (offenders.get(value) ?? 0) + 1);
  }
  if (numeric / present.length < MOSTLY_NUMERIC || offenders.size === 0) return null;

  const worst = [...offenders.entries()].sort((a, b) => b[1] - a[1]).map(([value]) => value);
  const stuck = present.length - numeric;

  return {
    kind: "numbers_as_text",
    column: column.name,
    level: "will_mislead",
    says: `${numeric} of the ${present.length} values in ${column.name} are numbers, but ${stuck} ${stuck === 1 ? "is" : "are"} not: ${list(worst)}. A column is read as numeric only when every value in it parses, so this one is a category and nothing will compute a mean over it.`,
    consider: `Decide what those ${stuck === 1 ? "cell means" : "cells mean"}. If they are missing data, blank them or write NA. If they are real values, they need a number.`,
  };
}

/**
 * Two levels that are the same word in different case.
 *
 * Every test downstream takes them as two groups. A t-test across "Male",
 * "male" and "MALE" is not a t-test at all, and the output says nothing about
 * it beyond a group count nobody reads.
 *
 * Case only, deliberately. `parseDataset` trims every cell, quoted fields
 * included, so a trailing space never reaches a level at all DASH folding
 * whitespace here as well would be a rule no input could exercise, which is
 * the kind of code that looks like a safeguard and is not one.
 */
function levelsDifferByCase(column: Column): Finding | null {
  if (column.levels === undefined) return null;

  const families = new Map<string, string[]>();
  for (const level of column.levels) {
    const key = level.value.toLowerCase();
    families.set(key, [...(families.get(key) ?? []), level.value]);
  }
  const collapsed = [...families.values()].filter((family) => family.length > 1);
  if (collapsed.length === 0) return null;

  const example = collapsed[0]!;
  return {
    kind: "levels_differ_by_case",
    column: column.name,
    level: "will_mislead",
    says: `${column.name} has ${column.distinct} levels, and ${collapsed.length === 1 ? "two of them are" : `${collapsed.length} pairs of them are`} the same word written differently: ${list(example, 4)}. Everything downstream takes them as separate groups.`,
    consider: "Make the capitalisation the same in the file, then upload it again.",
  };
}

function constant(column: Column): Finding | null {
  if (column.n === 0 || column.distinct !== 1) return null;
  return {
    kind: "constant",
    column: column.name,
    level: "note",
    says: `Every row has the same value in ${column.name}.`,
    consider: "Nothing can be tested against a column that does not vary. It may be a label rather than a variable.",
  };
}

/**
 * A column with one case per level, which is a row number rather than a
 * variable.
 *
 * `alreadyText` is why this takes an argument at all. A numeric column that
 * two bad cells turned into a category has one case per level too, and
 * reporting it here as well produced a pair of findings that contradicted
 * each other on the same column: "these values are numbers" directly above
 * "this is a row identifier". A reader cannot settle that, and the one they
 * act on decides whether they fix the column or delete it.
 */
function identifier(column: Column, rows: number, alreadyText: boolean): Finding | null {
  if (alreadyText || column.kind === "numeric" || column.kind === "empty") return null;
  if (rows < ENOUGH_ROWS || column.distinct !== column.n || column.n !== rows) return null;
  return {
    kind: "identifier",
    column: column.name,
    level: "check",
    says: `Every one of the ${rows} values in ${column.name} is different, which is the shape of a row identifier rather than a variable.`,
    consider: "Worth leaving out of the analysis. A column with one case per level supports nothing.",
  };
}

function missingness(column: Column, rows: number): Finding | null {
  if (rows === 0 || column.missing === 0) return null;
  const share = column.missing / rows;
  if (share < MISSING_WORTH_SAYING) return null;

  const percent = Math.round(share * 100);
  const serious = share >= MISSING_SERIOUS;
  return {
    kind: "missing",
    column: column.name,
    level: serious ? "will_mislead" : "check",
    says: `${column.missing} of ${rows} rows have nothing in ${column.name} — ${percent}%.`,
    consider: serious
      ? "At this level the cases left are not the sample you set out to study, and every result over this column describes whoever happened to answer. Say what is missing and why in the write-up, before the results."
      : "Worth saying in the write-up how much was missing and how it was handled. Dropping cases quietly is the part an examiner asks about.",
  };
}

function tinyGroup(column: Column): Finding | null {
  if (column.levels === undefined) return null;
  const small = column.levels.filter((level) => level.count > 0 && level.count < TINY_GROUP);
  if (small.length === 0) return null;

  // Quoting the level and not the count. `"pilot (3)"` reads as a level
  // named "pilot (3)", which is exactly the kind of small wrongness that
  // makes somebody go and look for a level that does not exist.
  const named = small
    .slice(0, 4)
    .map((level) => `"${level.value}" (${level.count})`)
    .join(", ") + (small.length > 4 ? " and others" : "");
  return {
    kind: "tiny_group",
    column: column.name,
    level: "check",
    says: `${column.name} has ${small.length === 1 ? "a level with" : `${small.length} levels with`} fewer than ${TINY_GROUP} cases: ${named}.`,
    consider: "A test will still run. It will not have the power to find anything, and a chi-square over cells this small is not valid. Combining levels, or saying plainly that the group is too small, are both defensible.",
  };
}

function unbalanced(column: Column): Finding | null {
  if (column.levels === undefined || column.levels.length < 2 || column.levels.length > 5) return null;
  const counts = column.levels.map((level) => level.count).filter((count) => count > 0);
  if (counts.length < 2) return null;
  const largest = Math.max(...counts);
  const smallest = Math.min(...counts);
  if (smallest < TINY_GROUP || largest / smallest < UNBALANCED) return null;

  return {
    kind: "unbalanced",
    column: column.name,
    level: "note",
    says: `The groups in ${column.name} are very different sizes: the largest has ${largest} cases and the smallest ${smallest}.`,
    consider: "Not a fault. It does mean the assumption checks matter more than usual, because unequal variances hurt an unbalanced design much more than a balanced one.",
  };
}

function duplicateRows(dataset: Dataset): Finding | null {
  if (dataset.rows < 2 || dataset.columns.length === 0) return null;

  const seen = new Set<string>();
  let repeated = 0;
  for (let row = 0; row < dataset.rows; row += 1) {
    const key = dataset.columns.map((column) => column.values[row] ?? "").join(" ");
    if (seen.has(key)) repeated += 1;
    else seen.add(key);
  }
  if (repeated === 0) return null;

  return {
    kind: "duplicate_rows",
    column: null,
    level: "check",
    says: `${repeated} of the ${dataset.rows} rows repeat a row that appears earlier, in every column.`,
    consider: "Sometimes real, often an export run twice or a merge that duplicated. Worth knowing which before anything is counted, because a duplicated case is counted twice in every result.",
  };
}

function fewDistinctNumeric(column: Column, rows: number): Finding | null {
  if (column.kind !== "numeric" || rows < ENOUGH_ROWS) return null;
  if (column.distinct < 2 || column.distinct > TINY_GROUP) return null;

  const whole = column.values.every(
    (value) => value === null || isMissing(value) || Number.isInteger(toNumber(value)),
  );
  if (!whole) return null;

  return {
    kind: "few_distinct_numeric",
    column: column.name,
    level: "check",
    // Deliberately not "a mean over this is meaningless". A Likert item has
    // exactly this shape, and treating one as interval is a defensible choice
    // a great many published papers make. Naming the fork is the honest move;
    // overruling a whole literature from the shape of a column is not.
    says: `${column.name} holds only ${column.distinct} different whole numbers across ${rows} rows.`,
    consider: "If those are codes for categories, they are a grouping variable and a mean over them is not a number about anything. If it is a rating scale, treating it as a scale is a choice worth defending in the write-up rather than one to make silently.",
  };
}

/**
 * Everything worth saying about a dataset before a test is chosen.
 *
 * Ordered by level rather than by column, because the two things that make a
 * result wrong — a numeric column read as text, and levels that are the
 * same word — have to sit above a note about group sizes. Within a level,
 * file order, so the list does not reshuffle between uploads of the same data.
 */
export function readHealth(dataset: Dataset): Finding[] {
  const findings: Finding[] = [];

  for (const column of dataset.columns) {
    const asText = numbersAsText(column);
    for (const finding of [
      asText,
      levelsDifferByCase(column),
      constant(column),
      identifier(column, dataset.rows, asText !== null),
      missingness(column, dataset.rows),
      tinyGroup(column),
      unbalanced(column),
      fewDistinctNumeric(column, dataset.rows),
    ]) {
      if (finding !== null) findings.push(finding);
    }
  }

  const duplicates = duplicateRows(dataset);
  if (duplicates !== null) findings.push(duplicates);

  const rank: Record<HealthLevel, number> = { will_mislead: 0, check: 1, note: 2 };
  // Stable within a level: Array.prototype.sort is required to be stable, so
  // file order survives. A list that reshuffles between two uploads of the
  // same file reads as the tool having changed its mind.
  return findings.sort((a, b) => rank[a.level] - rank[b.level]);
}

/** One sentence over the whole reading, for somebody who reads only one. */
export function healthSummary(findings: readonly Finding[]): string {
  if (findings.length === 0) {
    return "Nothing in the shape of this file looks wrong. That is all it says: whether the data answers your question is a different question, and nothing here can see it.";
  }

  const misleading = findings.filter((finding) => finding.level === "will_mislead").length;
  const rest = findings.length - misleading;
  if (misleading === 0) {
    return `${rest} ${rest === 1 ? "thing is" : "things are"} worth checking before you run anything. None of them makes a result wrong on its own.`;
  }
  const alsoRest = rest > 0
    ? `, and ${rest} more ${rest === 1 ? "is" : "are"} worth checking`
    : "";
  return `${misleading} ${misleading === 1 ? "thing" : "things"} will make a result wrong as the file stands${alsoRest}.`;
}
