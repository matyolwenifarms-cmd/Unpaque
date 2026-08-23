// What questions this data could answer — and not one answer to any of them.
//
// `procedures.ts` tells a researcher whether a chosen pair of columns supports
// a chosen test. That is the right tool for somebody who already knows which
// two columns they care about. A novice does not: they have a file with
// fourteen columns, and the screen asks them to pick two.
//
// So this walks the pairs and reports which procedures each one could support.
// It is the same rule as `availableFor`, read in the other direction.
//
// **It runs nothing, and there is no field on anything here for a result.**
// That is the whole design rather than a limit on it. A screen that listed
// every pair with its p-value beside it would be the most efficient
// false-positive machine anybody has built: ninety comparisons, one of them
// under .05 by arithmetic alone, and the researcher clicks that one and never
// writes down the other eighty-nine. Nothing here is ordered by anything but
// the order of the columns in the file, and the notes say so out loud.

import type { Column, Dataset } from "./dataset.ts";
import { availableFor, PROCEDURES, type Procedure, type ProcedureId } from "./procedures.ts";
import { readHealth } from "./health.ts";

export interface Pairing {
  /** The measure, for a test that has one; otherwise the first column. */
  readonly outcome: string;
  readonly factor: string;
}

export interface Opportunity {
  readonly procedure: Procedure;
  /** The pairs it could run on, in the order the columns appear in the file. */
  readonly pairs: readonly Pairing[];
  /** How many there were before the cap. Equal to `pairs.length` under it. */
  readonly total: number;
}

export interface SetAside {
  readonly column: string;
  readonly because: string;
}

export interface Opportunities {
  readonly opportunities: readonly Opportunity[];
  /**
   * Columns left out of the pairing, with the reason.
   *
   * Listed rather than silently dropped. A researcher whose participant id is
   * missing from every list, with no explanation, concludes the tool did not
   * read their file — which is a worse belief than the true one.
   */
  readonly setAside: readonly SetAside[];
  /** What the shape of a file cannot decide, said before anybody clicks. */
  readonly notes: readonly string[];
}

/** Pairs shown per procedure before the count stands in for the list. */
const DEFAULT_LIMIT = 12;

/**
 * Not offered, and the reason is not that it is unimplemented.
 *
 * `availableFor` reports a paired t-test as available for any two numeric
 * columns, which is correct as far as the columns go: it cannot see that the
 * test also needs them to be the same measurement, on the same person, at two
 * times. Asked about one chosen pair that is the researcher's business. Walked
 * across every numeric pair in a file it becomes a list of ninety paired
 * t-tests that mostly describe nothing, offered by the software.
 */
const NOT_ENUMERATED: ReadonlySet<ProcedureId> = new Set(["paired_t"]);

/**
 * Which columns are worth pairing at all, and why the rest are not.
 *
 * Reuses the health reading rather than repeating its rules: a column it
 * called a row identifier or a constant is exactly a column no pair should
 * include, and having one module decide that means the reason a researcher
 * reads in one place is the reason the other one acted on.
 */
function usable(dataset: Dataset): { columns: Column[]; setAside: SetAside[] } {
  const findings = readHealth(dataset);
  const columns: Column[] = [];
  const setAside: SetAside[] = [];

  for (const column of dataset.columns) {
    if (column.kind === "empty") {
      setAside.push({ column: column.name, because: "It has nothing in it." });
      continue;
    }
    // Three reasons to leave a column out, checked before the generic one.
    //
    // A column the health reading calls `will_mislead` is here because the
    // alternative was incoherent: the panel above says the two levels of
    // "gender" are the same word, and the panel below then offered three
    // tests on it. Every one of those would have compared phantom groups,
    // and the software had already said so a screen earlier.
    //
    // The specific reason also has to win over `text`. A participant id has
    // more distinct values than a set of levels, so it is free text as well
    // as an identifier, and "it holds free text" is a true sentence that
    // sends somebody to look at a column of P001, P002, P003 wondering what
    // is free about it.
    const flagged = findings.find(
      (finding) =>
        finding.column === column.name &&
        (finding.level === "will_mislead" ||
          finding.kind === "identifier" ||
          finding.kind === "constant"),
    );
    if (flagged) {
      // Both halves. A column withdrawn without the way to get it back is a
      // column the researcher believes this cannot read.
      setAside.push({ column: column.name, because: `${flagged.says} ${flagged.consider}` });
      continue;
    }
    if (column.kind === "text") {
      setAside.push({
        column: column.name,
        because: "It holds free text rather than a set of levels, so it is not a variable these tests can take.",
      });
      continue;
    }
    columns.push(column);
  }

  return { columns, setAside };
}

/** Which of the two is the measure, for a test that has one. */
function pairingFor(id: ProcedureId, a: Column, b: Column): Pairing {
  if (id === "independent_t" || id === "one_way_anova") {
    const outcome = a.kind === "numeric" ? a : b;
    const factor = outcome === a ? b : a;
    return { outcome: outcome.name, factor: factor.name };
  }
  return { outcome: a.name, factor: b.name };
}

/**
 * Every question the columns of this file could support.
 *
 * Ordered by the order of the procedures and then by the order of the columns,
 * and by nothing else. There is deliberately no notion of a more promising
 * pair here: the only signal that could produce one is a result, and ranking
 * by result is the thing this module exists not to do.
 */
export function readOpportunities(dataset: Dataset, limit = DEFAULT_LIMIT): Opportunities {
  const { columns, setAside } = usable(dataset);

  const found = new Map<ProcedureId, Pairing[]>();
  for (let i = 0; i < columns.length; i += 1) {
    for (let j = i + 1; j < columns.length; j += 1) {
      const a = columns[i]!;
      const b = columns[j]!;
      for (const availability of availableFor(a, b)) {
        const id = availability.procedure.id;
        if (!availability.available || NOT_ENUMERATED.has(id)) continue;
        found.set(id, [...(found.get(id) ?? []), pairingFor(id, a, b)]);
      }
    }
  }

  const opportunities: Opportunity[] = [];
  for (const id of Object.keys(PROCEDURES) as ProcedureId[]) {
    const pairs = found.get(id);
    if (pairs === undefined || pairs.length === 0) continue;
    opportunities.push({
      procedure: PROCEDURES[id],
      pairs: pairs.slice(0, Math.max(1, limit)),
      total: pairs.length,
    });
  }

  const notes: string[] = [];
  if (opportunities.length > 0) {
    notes.push(
      "Nothing here has been run. These are questions the columns could answer, not answers to any of them, and they are in the order the columns appear in your file rather than in any order of interest.",
    );
    notes.push(
      "Running all of them and keeping the ones that came out small is the most common way a study reports something that is not there. Choose from your research question, not from this list.",
    );
    notes.push(
      "A paired t-test is not listed. It needs two columns holding the same measurement for the same person at two times, and nothing in the shape of a spreadsheet says whether two numeric columns are that. It is still on the analysis stage, for a pair you choose.",
    );
  } else {
    notes.push(
      `Nothing in this file supports any of these procedures. ${columns.length < 2 ? "They each need two columns." : "They need a numeric measure with a grouping column, two numeric columns, or two categorical ones."}`,
    );
  }

  return { opportunities, setAside, notes };
}

/** One sentence for somebody who reads one. */
export function opportunitySummary(found: Opportunities): string {
  const total = found.opportunities.reduce((sum, one) => sum + one.total, 0);
  if (total === 0) return "No procedure on the analysis stage fits these columns.";
  const kinds = found.opportunities.length;
  return `${total} ${total === 1 ? "pair of columns supports" : "pairs of columns support"} ${kinds === 1 ? "one kind of test" : `${kinds} kinds of test`}. Which of them answers your question is a decision this cannot make.`;
}
