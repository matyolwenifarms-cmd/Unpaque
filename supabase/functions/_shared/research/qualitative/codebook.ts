// The codebook: what each code means, and — the half that is usually missing —
// when not to apply it.
//
// A codebook with definitions and no exclusions is the commonest reason two
// coders disagree and neither can say why. "Resistance: where participants
// push back against the policy" reads as complete until one coder applies it
// to a joke about the policy and the other does not, and there is nothing in
// the codebook that settles it. So `notWhen` is a required field. A code that
// nobody has thought about the edges of is a code that has not been defined,
// and this refuses to represent one.
//
// The hierarchy is one level deep on purpose. Open coding produces codes,
// axial coding groups them into categories, and three-level trees in practice
// become a filing system the analyst navigates instead of an analysis they
// think with. A code names its parent category or has none.

export interface Code {
  id: string;
  /** What appears beside a highlighted extract. Short. */
  label: string;
  /** What the code is for, in a sentence somebody else could apply. */
  definition: string;
  /** When to apply it. */
  when: string;
  /**
   * When **not** to, including the near-misses.
   *
   * Required. See the module note: this is the field that makes a codebook
   * usable by a second coder, and the one that gets left out.
   */
  notWhen: string;
  /** A real extract, once one exists. Anchors the definition to the data. */
  example?: string;
  /** The category this belongs to under axial coding, if any. */
  parentId?: string | null;
}

export interface CodeProblem {
  field: "label" | "definition" | "when" | "notWhen" | "parentId";
  says: string;
}

/**
 * What is wrong with a code, or nothing.
 *
 * Returns problems rather than throwing, because this runs as somebody types
 * and a half-written code is not an error — it is a code being written.
 */
export function codeProblems(code: Partial<Code>, existing: readonly Code[] = []): CodeProblem[] {
  const problems: CodeProblem[] = [];
  if (!code.label?.trim()) problems.push({ field: "label", says: "A code needs a name." });
  if (!code.definition?.trim()) {
    problems.push({ field: "definition", says: "Say what this code is for, in a sentence." });
  }
  if (!code.when?.trim()) problems.push({ field: "when", says: "Say when to apply it." });
  if (!code.notWhen?.trim()) {
    problems.push({
      field: "notWhen",
      says:
        "Say when not to apply it, including the near-misses. Two coders disagreeing with nothing in the codebook to settle it is what this field prevents.",
    });
  }
  if (code.parentId) {
    const parent = existing.find((candidate) => candidate.id === code.parentId);
    if (!parent) {
      problems.push({ field: "parentId", says: "That category does not exist." });
    } else if (parent.parentId) {
      // One level. A tree deeper than this becomes a filing system the analyst
      // navigates instead of an analysis they think with.
      problems.push({
        field: "parentId",
        says: `"${parent.label}" is itself inside a category. Codes group one level deep.`,
      });
    }
  }
  return problems;
}

/**
 * Codes grouped under their category, with the uncategorised last.
 *
 * A category is not a separate kind of thing here - it is a code that other
 * codes point at, because that is the only definition the data model can
 * support. So "has children" is what makes one, and a top-level code with no
 * children is an ordinary code and is grouped with the uncategorised.
 *
 * The invariant, which a first version broke: **every code appears exactly
 * once.** Treating every top-level code as a category and listing only its
 * children meant a code with no children rendered as a heading above an empty
 * list - present in the codebook, invisible as a code, with its own extract
 * count unreachable. A category appears first inside its own group rather than
 * only as the heading, for the same reason: it has a definition and may itself
 * be applied to extracts.
 */
export function byCategory(codes: readonly Code[]): Array<{ category: Code | null; codes: Code[] }> {
  const topLevel = codes.filter((code) => !code.parentId);
  const childrenOf = (id: string) => codes.filter((code) => code.parentId === id);

  const grouped = topLevel
    .filter((code) => childrenOf(code.id).length > 0)
    .map((category) => ({ category, codes: [category, ...childrenOf(category.id)] }));

  // A code whose parent has been deleted is not lost - it appears with the
  // uncategorised, where somebody can see it and re-file it. Silently hiding
  // it would remove coded data from the analysis without saying so.
  const loose = codes.filter((code) =>
    code.parentId
      ? !topLevel.some((category) => category.id === code.parentId)
      : childrenOf(code.id).length === 0
  );

  return loose.length > 0 ? [...grouped, { category: null, codes: loose }] : grouped;
}
