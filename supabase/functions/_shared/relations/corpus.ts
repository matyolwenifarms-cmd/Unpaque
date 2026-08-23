// The vocabulary a study uses to set one paper against another.
//
// Mirrored from `20260823090000_research_relations.sql`, which is the
// authority. `corpus.test.ts` reads that migration and asserts the two agree,
// because the only reason this copy exists is so a reviewer gets a sentence
// instead of a raw constraint violation — and a copy nobody checks drifts.

/**
 * Two values, not five.
 *
 * `extends`, `replicates` and `supersedes` are all real relations between
 * papers and none of them is decidable from a reading of two texts. A
 * vocabulary offering choices nobody can justify produces a graph whose edges
 * mean whatever the person clicking felt like, which is worse than no graph.
 */
export const STUDY_RELATIONS = ["corroborates", "contradicts"] as const;
export type StudyRelation = (typeof STUDY_RELATIONS)[number];

/** The database's own limits on a basis, so the form can say so first. */
export const BASIS_MIN = 10;
export const BASIS_MAX = 2000;

/**
 * Why the basis this reviewer typed will not be accepted, or nothing.
 *
 * A sentence rather than a boolean, and the short case says what is missing
 * rather than what is wrong: somebody who typed "differs" has not made a
 * mistake, they have written half a thought.
 */
export function basisProblem(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return "Say why. A relation with no reason behind it is an arrow nobody can check.";
  }
  if (trimmed.length < BASIS_MIN) {
    return `That is ${trimmed.length} characters, which is the start of a reason rather than one. Say what the two papers actually disagree about: a figure, a definition, a sample, a period.`;
  }
  if (trimmed.length > BASIS_MAX) {
    return `That is ${trimmed.length} characters and the limit is ${BASIS_MAX}. What does not fit belongs in the write-up rather than on the edge.`;
  }
  return null;
}

/**
 * The relation as a sentence, with the direction in it.
 *
 * Written out because the direction is the whole point and an arrow does not
 * carry it. "A contradicts B" and "B contradicts A" are different claims, and
 * a reviewer reading a list of edges has no other way to tell which they
 * recorded.
 */
export function readRelation(relation: StudyRelation, from: string, to: string): string {
  return relation === "corroborates"
    ? `${from} corroborates ${to}`
    : `${from} contradicts ${to}`;
}
