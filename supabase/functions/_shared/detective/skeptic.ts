// The Skeptic, which may challenge the Detective herself.
//
// Concept document, section 13, and section 12 of the consolidated spec. Ten
// questions are listed there. What this module does with them is the whole of
// its argument: **it answers the ones the case file can answer, and refuses to
// pretend about the rest.**
//
// A skeptic that renders ten prompts is a poster on a wall. Four of these are
// computable from the record — whether the sources are independent, whether
// one source is carrying the case, whether the hypotheses were tested with
// equal effort, whether anybody looked for disconfirming evidence at all —
// and computing them is worth more than the other six put together, because
// those four are the ones an investigator cannot check by introspection.
//
// The remaining six are still shown, marked as questions for a person, with no
// answer attached. Attaching a generated answer to "is the source reliable?"
// would be the failure the whole product is against: a confident sentence
// standing where a judgement belongs.

import { findDuplicateSources } from "./dossier.ts";
import type { Hypothesis, HypothesisSet } from "./hypothesis.ts";

/** Whether the case file can answer a challenge, or only a person can. */
export type ChallengeKind = "computed" | "yours";

export interface Challenge {
  id: string;
  /** The Skeptic's question, as the specification words it. */
  question: string;
  kind: ChallengeKind;
  /**
   * What the record shows, for a computed challenge, or null when it shows
   * nothing worth raising. Always null for a challenge that is the
   * investigator's to answer.
   */
  finding: string | null;
}

/** A source as the skeptic needs to see it, to judge independence. */
export interface SkepticSource {
  id: string;
  title: string;
  contentHash?: string | null;
}

export interface SkepticInput {
  set: HypothesisSet;
  sources: readonly SkepticSource[];
}

/**
 * How lopsided the effort may be before it is worth saying so.
 *
 * Four to one. Below that an investigator is following the evidence; above it
 * they are building a case, and the difference is invisible from inside.
 */
const EFFORT_RATIO = 4;

/**
 * A source may carry this much of the support before it is named.
 *
 * Half. One source behind more than half of everything supporting a theory is
 * not corroboration, it is a single account with a case built on it.
 */
const DOMINANCE = 0.5;

export function runSkeptic(input: SkepticInput): Challenge[] {
  const { set, sources } = input;
  const challenges: Challenge[] = [];

  // 1. What assumptions are we making?
  const unstated = set.hypotheses.filter((hypothesis) => hypothesis.assumptions.length === 0);
  challenges.push({
    id: "assumptions",
    question: "What assumptions are we making?",
    kind: "computed",
    finding: unstated.length === 0
      ? null
      : `${unstated.length === 1 ? "One explanation states" : `${unstated.length} explanations state`} no assumptions at all: ${unstated.map((h) => quoted(h.statement)).join(", ")}. An explanation with no assumptions written down is not one that rests on nothing.`,
  });

  // 2. What evidence is missing? Computable as: was anybody looking for it.
  const untested = set.hypotheses.filter((hypothesis) => !hypothesis.testedAgainst);
  challenges.push({
    id: "untested",
    question: "What evidence is missing?",
    kind: "computed",
    finding: untested.length === 0
      ? null
      : `${untested.map((h) => quoted(h.statement)).join(", ")} ${untested.length === 1 ? "has" : "have"} no evidence against ${untested.length === 1 ? "it" : "them"} on file. That may mean a search found none, or that none was made — and the case file cannot tell those apart.`,
  });

  // 3. Could there be another explanation?
  challenges.push({
    id: "alternatives",
    question: "Could there be another explanation?",
    kind: "computed",
    finding: set.hypotheses.length >= 3
      ? null
      : `Two explanations are on the table. Two is the minimum that makes the comparison meaningful and is rarely the number that exists — the third is usually the one nobody wanted to write down.`,
  });

  // 4. Is the evidence genuinely independent?
  const duplicates = findDuplicateSources(sources.map((source) => ({
    id: source.id,
    title: source.title,
    kind: "reporting",
    retrievedFrom: "",
    contentHash: source.contentHash ?? null,
  })));
  challenges.push({
    id: "independence",
    question: "Is this evidence genuinely independent?",
    kind: "computed",
    finding: duplicates.length === 0
      ? null
      : `${duplicates.length} ${duplicates.length === 1 ? "set of sources holds" : "sets of sources hold"} identical content and ${duplicates.length === 1 ? "is" : "are"} one source, not several. Independent support is counted that way throughout, but a reader looking at the source list will not see it.`,
  });

  // 5. Are we giving too much weight to one source?
  const dominated = set.hypotheses
    .map((hypothesis) => ({ hypothesis, source: dominantSource(hypothesis) }))
    .filter((entry): entry is { hypothesis: Hypothesis; source: { title: string; share: number } } =>
      entry.source !== null);
  challenges.push({
    id: "dominance",
    question: "Are we giving too much weight to one source?",
    kind: "computed",
    finding: dominated.length === 0
      ? null
      : dominated
          .map((entry) =>
            `${Math.round(entry.source.share * 100)}% of what supports ${quoted(entry.hypothesis.statement)} comes from "${entry.source.title}". If that source is wrong, the explanation goes with it.`)
          .join(" "),
  });

  // 6. Are we favouring the investigator's preferred theory?
  const lopsided = preferredTheory(set.hypotheses);
  challenges.push({
    id: "preference",
    question: "Are we unconsciously favouring the preferred theory?",
    kind: "computed",
    finding: lopsided,
  });

  // 7. Are we overinterpreting ambiguous information?
  const inconclusive = set.discriminatesNothing.length;
  challenges.push({
    id: "ambiguity",
    question: "Are we overinterpreting ambiguous information?",
    kind: "computed",
    finding: inconclusive === 0
      ? null
      // Deliberately not the sentence the separating panel uses. That one
      // lists the records; this one names the risk, and the same words in both
      // places read as a stutter.
      : `Evidence that fits every explanation cannot tell them apart, and ${inconclusive} such ${inconclusive === 1 ? "record is" : "records are"} on file. It is the kind an investigator gathers most of, because it never contradicts anything.`,
  });

  // The six the record cannot answer. Shown with no answer attached, because a
  // generated one would be a confident sentence standing where a judgement
  // belongs.
  for (const question of [
    "Is the source reliable?",
    "Could the evidence be incomplete?",
    "Are we confusing correlation with causation?",
  ]) {
    challenges.push({ id: slug(question), question, kind: "yours", finding: null });
  }

  return challenges;
}

/** The source behind more than half of a hypothesis's support, if there is one. */
function dominantSource(hypothesis: Hypothesis): { title: string; share: number } | null {
  if (hypothesis.supporting.length < 3) return null;
  const counts = new Map<string, { title: string; count: number }>();
  for (const item of hypothesis.supporting) {
    const entry = counts.get(item.sourceId) ?? { title: item.sourceTitle, count: 0 };
    counts.set(item.sourceId, { title: entry.title, count: entry.count + 1 });
  }
  for (const entry of counts.values()) {
    const share = entry.count / hypothesis.supporting.length;
    if (share > DOMINANCE) return { title: entry.title, share };
  }
  return null;
}

/**
 * Whether one explanation has been worked far harder than the others.
 *
 * The asymmetry, not the totals. An investigator who has gathered nine records
 * for one theory and none for its rival has not weighed them — and this is
 * the single hardest thing to notice from inside an investigation, because
 * every one of those nine felt like following the evidence.
 */
function preferredTheory(hypotheses: readonly Hypothesis[]): string | null {
  const effort = hypotheses.map((hypothesis) => ({
    hypothesis,
    records: hypothesis.supporting.length + hypothesis.contradicting.length,
  }));
  const most = effort.reduce((a, b) => (b.records > a.records ? b : a));
  const least = effort.reduce((a, b) => (b.records < a.records ? b : a));
  if (most.records < EFFORT_RATIO) return null;
  if (least.records > 0 && most.records / least.records < EFFORT_RATIO) return null;

  return `${most.records} records bear on ${quoted(most.hypothesis.statement)} and ${least.records === 0 ? "none bears" : `${least.records} on`} ${quoted(least.hypothesis.statement)}. That is a fact about where the looking went, not about which is true.`;
}

/**
 * A statement, quoted, ending once.
 *
 * The trailing stop is dropped because the sentence around it supplies one.
 * Left on, the first generated report read `"...depot at all.". An explanation`
 * — two stops and a stray quote, which is the same defect a dossier shipped
 * with once and reads as carelessness in a document whose whole claim is care.
 */
function quoted(statement: string): string {
  const trimmed = statement.trim().replace(/[.]+$/, "");
  const short = trimmed.length > 60 ? `${trimmed.slice(0, 57).trimEnd()}...` : trimmed;
  return `"${short}"`;
}

function slug(question: string): string {
  return question.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
}
