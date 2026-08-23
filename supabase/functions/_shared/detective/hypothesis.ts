// Competing explanations, and what would kill each one.
//
// Section 12, and 11-13 of the concept document. The rule it opens with is the
// whole design: "The Detective must never be forced into one theory. Maintain
// competing explanations."
//
// Three things are structural here rather than advisory, because each is a
// thing an investigator does wrong under pressure and does not notice:
//
//   * **A hypothesis carries what would falsify it.** Required, in the type.
//     A statement with no answer to "what would make us abandon this" is a
//     belief, and this module has no way to represent one.
//   * **One hypothesis is not an investigation.** `assembleHypotheses` refuses
//     to report on a lone theory and says why. A case with one explanation is
//     a case whose alternatives were never written down, which is not the same
//     as a case whose alternatives were ruled out.
//   * **Nothing is ranked.** There is no "most likely", no score, no ordering
//     by support. Section 4 forbids collapsing information into truth, and a
//     leaderboard of theories is that collapse wearing a number. What is
//     reported is the record behind each one.

import { independentSupport, type EvidenceLike } from "./epistemic.ts";

/** Evidence as a hypothesis sees it: what it bears on, and how. */
export interface HypothesisEvidence extends EvidenceLike {
  id: string;
  /** The hypothesis this bears on. */
  hypothesisId: string;
  /** What the record says, for showing rather than counting. */
  summary: string;
  sourceTitle: string;
}

export interface HypothesisDraft {
  id: string;
  /** The explanation, stated so that it could be wrong. */
  statement: string;
  /**
   * What would make us abandon this.
   *
   * Required, and the field the module is built around. Popper's point
   * restated for a case file: a theory that no observation could count against
   * is not being tested by any of the evidence gathered for it.
   */
  falsifier: string;
  /** What is being taken for granted. Empty is a finding, not a default. */
  assumptions: string[];
}

export interface HypothesisProblem {
  field: "statement" | "falsifier";
  says: string;
}

/** What is wrong with a draft, or nothing. Returned rather than thrown. */
export function hypothesisProblems(draft: Partial<HypothesisDraft>): HypothesisProblem[] {
  const problems: HypothesisProblem[] = [];
  if (!draft.statement?.trim()) {
    problems.push({ field: "statement", says: "State the explanation." });
  }
  if (!draft.falsifier?.trim()) {
    problems.push({
      field: "falsifier",
      says:
        "Say what would make you abandon this. A theory that no possible finding could count against is not being tested by anything you gather for it — and it is the one you will keep believing.",
    });
  }
  return problems;
}

export interface Hypothesis extends HypothesisDraft {
  supporting: HypothesisEvidence[];
  contradicting: HypothesisEvidence[];
  /**
   * Independent sources behind the supporting evidence.
   *
   * Not the count of records. Two sources with the same content hash are the
   * same bytes fetched twice, and a wire story printed in four papers is one
   * source — the failure that makes a hypothesis look far better supported
   * than it is.
   */
  independentSupport: number;
  /**
   * Whether anybody looked for evidence against it.
   *
   * Distinct from having none. A hypothesis with no contradicting evidence may
   * have survived a search or may never have been searched, and the two look
   * identical in a case file unless the difference is named.
   */
  testedAgainst: boolean;
}

export interface HypothesisSet {
  hypotheses: Hypothesis[];
  /**
   * Evidence consistent with every hypothesis on the table.
   *
   * The confirmation-bias trap, computed. A record that fits all of them
   * discriminates between none of them, and it is the kind an investigator
   * collects most of: it feels like progress and moves nothing.
   */
  discriminatesNothing: HypothesisEvidence[];
}

export type HypothesisOutcome =
  | { kind: "read"; set: HypothesisSet }
  | { kind: "refused"; says: string };

/**
 * Assemble the competing explanations, or refuse.
 *
 * The refusal is the feature. One hypothesis is a theory being defended, and
 * everything below — falsifiers, discriminators, the skeptic — exists to
 * compare, so on a lone hypothesis it would return figures that all mean
 * "yes, and?".
 */
export function assembleHypotheses(
  drafts: readonly HypothesisDraft[],
  evidence: readonly HypothesisEvidence[],
): HypothesisOutcome {
  const usable = drafts.filter((draft) => hypothesisProblems(draft).length === 0);

  if (usable.length === 0) {
    return { kind: "refused", says: "No hypotheses have been stated yet." };
  }
  if (usable.length === 1) {
    return {
      kind: "refused",
      says:
        "Only one explanation is on the table. A case with one hypothesis is a case whose alternatives were never written down, which is not the same as a case whose alternatives were ruled out. State at least one competing explanation, including the one you think is wrong.",
    };
  }

  const hypotheses = usable.map<Hypothesis>((draft) => {
    const mine = evidence.filter((item) => item.hypothesisId === draft.id);
    const supporting = mine.filter((item) => item.classification === "supports");
    const contradicting = mine.filter(
      (item) => item.classification === "contradicts" || item.classification === "undermines_source",
    );
    return {
      ...draft,
      supporting,
      contradicting,
      // Collapsed by source *before* the hash check, which is the difference
      // between this and the dossier's use of the same function. There, one
      // evidence row is one source. Here a single witness can supply five
      // records, and `independentSupport` counts unhashed ones individually by
      // design — so three statements from one supervisor were arriving as
      // three independent sources, which is the exact overstatement the
      // function exists to prevent.
      independentSupport: independentSupport(oncePerSource(supporting)),
      testedAgainst: mine.some((item) => item.classification !== "supports"),
    };
  });

  // A record bearing on every hypothesis, the same way each time. Keyed on the
  // source and the summary rather than on the evidence id, because the same
  // record linked to three hypotheses is three rows.
  const ids = new Set(hypotheses.map((hypothesis) => hypothesis.id));
  const groups = new Map<string, HypothesisEvidence[]>();
  for (const item of evidence) {
    if (!ids.has(item.hypothesisId)) continue;
    const key = `${item.sourceId} ${item.summary}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const discriminatesNothing: HypothesisEvidence[] = [];
  for (const group of groups.values()) {
    if (new Set(group.map((item) => item.hypothesisId)).size < hypotheses.length) continue;
    if (new Set(group.map((item) => item.classification)).size !== 1) continue;
    discriminatesNothing.push(group[0]!);
  }

  return { kind: "read", set: { hypotheses, discriminatesNothing } };
}

/** One record per source, keeping whichever carries a content hash. */
function oncePerSource(evidence: readonly HypothesisEvidence[]): HypothesisEvidence[] {
  const bySource = new Map<string, HypothesisEvidence>();
  for (const item of evidence) {
    const held = bySource.get(item.sourceId);
    if (!held || (!held.contentHash && item.contentHash)) bySource.set(item.sourceId, item);
  }
  return [...bySource.values()];
}

/**
 * Evidence already in the case that separates two explanations.
 *
 * A record that supports one and contradicts the other has done work. One that
 * bears on only one of them has not: it is consistent with the other by
 * silence, and silence is not evidence against.
 */
export function discriminators(
  a: Hypothesis,
  b: Hypothesis,
): Array<{ evidence: HypothesisEvidence; favours: string; against: string }> {
  const found: Array<{ evidence: HypothesisEvidence; favours: string; against: string }> = [];
  const key = (item: HypothesisEvidence) => `${item.sourceId} ${item.summary}`;

  const bContradicts = new Set(b.contradicting.map(key));
  for (const item of a.supporting) {
    if (bContradicts.has(key(item))) found.push({ evidence: item, favours: a.id, against: b.id });
  }
  const aContradicts = new Set(a.contradicting.map(key));
  for (const item of b.supporting) {
    if (aContradicts.has(key(item))) found.push({ evidence: item, favours: b.id, against: a.id });
  }
  return found;
}

/**
 * The question that would separate two explanations, where the record cannot.
 *
 * A question and not an answer, because it is a research task rather than a
 * finding. What is deliberately not offered is a guess at what the answer
 * would be: that is the point at which an investigation starts confirming
 * itself.
 */
export function discriminatingQuestion(a: Hypothesis, b: Hypothesis): string | null {
  if (discriminators(a, b).length > 0) return null;
  return `Nothing in the case file separates "${a.statement}" from "${b.statement}". Every record gathered so far is consistent with both. What could be found that only one of them survives?`;
}
