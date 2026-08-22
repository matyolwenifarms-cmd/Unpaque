// Which procedures this data can actually support, and which it cannot.
//
// The list is derived from the columns rather than offered wholesale, and the
// reason is not convenience. A dropdown of every test lets somebody run a
// t-test across a five-level factor by picking the wrong menu item, and the
// output looks exactly like a correct one. Here a procedure that the selected
// columns cannot support is not in the list, and `whyNot` says what would be
// needed — because a greyed-out option with no explanation teaches nothing.
//
// Nothing here decides *which* test is right. That is the researcher's
// decision and their supervisor's, and it depends on the design, not on the
// shape of the spreadsheet. This only rules out what is impossible.

import { groupBy, numericValues, type Column, type Dataset } from "./dataset.ts";
import {
  chiSquareIndependence,
  independentT,
  oneWayAnova,
  pairedT,
  pearson,
  spearman,
  type TestOptions,
  type TestOutcome,
} from "./tests.ts";

export const PROCEDURE_IDS = [
  "independent_t",
  "paired_t",
  "one_way_anova",
  "pearson",
  "spearman",
  "chi_square",
] as const;
export type ProcedureId = (typeof PROCEDURE_IDS)[number];

export interface Procedure {
  id: ProcedureId;
  name: string;
  /** What question it answers, in the words a researcher would use. */
  question: string;
  /** What the two chosen columns have to be. */
  needs: string;
}

export const PROCEDURES: Record<ProcedureId, Procedure> = {
  independent_t: {
    id: "independent_t",
    name: "Independent-samples t-test",
    question: "Do two separate groups differ on this measure?",
    needs: "One numeric measure and one grouping column with exactly two levels.",
  },
  paired_t: {
    id: "paired_t",
    name: "Paired-samples t-test",
    question: "Did the same people change between two measurements?",
    needs: "Two numeric columns holding the before and after values for the same row.",
  },
  one_way_anova: {
    id: "one_way_anova",
    name: "One-way ANOVA",
    question: "Do three or more groups differ on this measure?",
    needs: "One numeric measure and one grouping column with three or more levels.",
  },
  pearson: {
    id: "pearson",
    name: "Pearson correlation",
    question: "Do these two measures rise and fall together in a straight line?",
    needs: "Two numeric columns.",
  },
  spearman: {
    id: "spearman",
    name: "Spearman rank correlation",
    question: "Do these two measures move together, whether or not in a straight line?",
    needs: "Two numeric or ordered columns.",
  },
  chi_square: {
    id: "chi_square",
    name: "Chi-square test of independence",
    question: "Are these two categories related, or independent?",
    needs: "Two categorical columns.",
  },
};

export interface Availability {
  procedure: Procedure;
  available: boolean;
  /** Present when unavailable. What would have to be true. */
  whyNot?: string;
}

/**
 * What can be run on this pair of columns, and what cannot, with reasons.
 *
 * Returns every procedure rather than only the possible ones: an empty list
 * tells a researcher nothing, and the reasons are how somebody learns that a
 * t-test needs exactly two groups without being told off for trying.
 */
export function availableFor(a: Column | null, b: Column | null): Availability[] {
  return PROCEDURE_IDS.map((id) => {
    const procedure = PROCEDURES[id];
    if (!a || !b) {
      return { procedure, available: false, whyNot: "Choose two columns." };
    }
    if (a.name === b.name) {
      return { procedure, available: false, whyNot: "Choose two different columns." };
    }

    const numeric = [a, b].filter((column) => column.kind === "numeric");
    const categorical = [a, b].filter((column) => column.kind === "categorical");

    switch (id) {
      case "pearson":
      case "spearman": {
        if (numeric.length === 2) return { procedure, available: true };
        return {
          procedure,
          available: false,
          whyNot: `Both columns must be numeric. ${describeKinds(a, b)}`,
        };
      }
      case "paired_t": {
        if (numeric.length === 2) return { procedure, available: true };
        return {
          procedure,
          available: false,
          whyNot: `Both columns must be numeric — the before and after values for the same row. ${describeKinds(a, b)}`,
        };
      }
      case "chi_square": {
        if (categorical.length === 2) return { procedure, available: true };
        return {
          procedure,
          available: false,
          whyNot: `Both columns must be categorical. ${describeKinds(a, b)}`,
        };
      }
      case "independent_t":
      case "one_way_anova": {
        if (numeric.length !== 1 || categorical.length !== 1) {
          return {
            procedure,
            available: false,
            whyNot: `Needs one numeric measure and one grouping column. ${describeKinds(a, b)}`,
          };
        }
        const factor = categorical[0]!;
        const levels = factor.distinct;
        if (id === "independent_t") {
          return levels === 2
            ? { procedure, available: true }
            : {
                procedure,
                available: false,
                // Naming the count is the point: "two groups" is the rule, and
                // seeing that this column has five is how somebody learns why
                // ANOVA is the option immediately below.
                whyNot: `"${factor.name}" has ${levels} levels; a t-test compares exactly two. With ${levels}, one-way ANOVA is the corresponding test.`,
              };
        }
        return levels >= 3
          ? { procedure, available: true }
          : {
              procedure,
              available: false,
              whyNot: `"${factor.name}" has ${levels} level(s); ANOVA compares three or more. With two, the independent-samples t-test is the corresponding test.`,
            };
      }
    }
  });
}

function describeKinds(a: Column, b: Column): string {
  return `"${a.name}" is ${a.kind} and "${b.name}" is ${b.kind}.`;
}

export type RunOutcome = TestOutcome | { ok: false; reason: string };

/**
 * Run one procedure over two columns of a dataset.
 *
 * Re-checks availability rather than trusting the caller. The UI only offers
 * what is possible, but the UI is not the guarantee — a saved analysis replayed
 * against a re-uploaded file with one column renamed would otherwise run
 * something nonsensical and print a result.
 */
export function run(
  dataset: Dataset,
  id: ProcedureId,
  aName: string,
  bName: string,
  options: TestOptions = {},
): RunOutcome {
  const a = dataset.columns.find((column) => column.name === aName) ?? null;
  const b = dataset.columns.find((column) => column.name === bName) ?? null;
  if (!a) return { ok: false, reason: `There is no column named "${aName}".` };
  if (!b) return { ok: false, reason: `There is no column named "${bName}".` };

  const availability = availableFor(a, b).find((entry) => entry.procedure.id === id);
  if (!availability?.available) {
    return { ok: false, reason: availability?.whyNot ?? "That procedure does not fit these columns." };
  }

  switch (id) {
    case "pearson":
      return pearson(numericValues(a), numericValues(b), options);
    case "spearman":
      return spearman(numericValues(a), numericValues(b), options);
    case "paired_t":
      // Raw values, not `numericValues`: a paired test has to keep the rows
      // aligned, and filtering each column separately would pair row 3 of one
      // with row 4 of the other the moment either has a gap.
      return pairedT(a.values, b.values, options);
    case "independent_t": {
      const { outcome, factor } = orient(a, b);
      const groups = groupBy(outcome, factor);
      if (groups.length !== 2) {
        return { ok: false, reason: `"${factor.name}" resolved to ${groups.length} group(s) with usable data.` };
      }
      return independentT(groups[0]!.values, groups[1]!.values, options);
    }
    case "one_way_anova": {
      const { outcome, factor } = orient(a, b);
      const groups = groupBy(outcome, factor);
      if (groups.length < 3) {
        return { ok: false, reason: `"${factor.name}" resolved to ${groups.length} group(s) with usable data.` };
      }
      return oneWayAnova(groups.map((group) => group.values), options);
    }
    case "chi_square": {
      const table = crossTabulate(a, b);
      if (!table) return { ok: false, reason: "The two columns share no complete rows." };
      return chiSquareIndependence(table.counts, options);
    }
  }
}

/** Whichever is numeric is the measure; whichever is categorical is the grouping. */
function orient(a: Column, b: Column): { outcome: Column; factor: Column } {
  return a.kind === "numeric" ? { outcome: a, factor: b } : { outcome: b, factor: a };
}

export interface CrossTab {
  rowLevels: string[];
  columnLevels: string[];
  counts: number[][];
}

/** The contingency table, built row-wise so incomplete rows drop from both. */
export function crossTabulate(a: Column, b: Column): CrossTab | null {
  const rowLevels = [...new Set(a.values.filter((v): v is string => v !== null))].sort();
  const columnLevels = [...new Set(b.values.filter((v): v is string => v !== null))].sort();
  if (rowLevels.length === 0 || columnLevels.length === 0) return null;

  const counts = rowLevels.map(() => columnLevels.map(() => 0));
  let complete = 0;
  for (let row = 0; row < a.values.length; row += 1) {
    const left = a.values[row];
    const right = b.values[row];
    if (left === null || right === null || left === undefined || right === undefined) continue;
    const r = rowLevels.indexOf(left);
    const c = columnLevels.indexOf(right);
    if (r < 0 || c < 0) continue;
    counts[r]![c]! += 1;
    complete += 1;
  }
  return complete === 0 ? null : { rowLevels, columnLevels, counts };
}
