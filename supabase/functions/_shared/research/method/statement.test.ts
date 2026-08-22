import { describe, expect, it } from "vitest";
import { PARADIGMS, PARADIGM_IDS } from "./paradigms.ts";
import { THEORIES } from "./theories.ts";
import { methodStatement, type MethodDeclaration } from "./statement.ts";

const base: MethodDeclaration = { paradigm: "interpretivism" };

describe("the methodology statement", () => {
  it("names the paradigm with its tradition and its position", () => {
    const { markdown } = methodStatement(base);
    expect(markdown).toMatch(/within an \*\*interpretivist\*\* paradigm, in the tradition of Weber/);
    expect(markdown).toMatch(/ontological position is relativist/);
    expect(markdown).toMatch(/epistemological position is subjectivist/);
  });

  it("carries a real citation for every paradigm", () => {
    for (const id of PARADIGM_IDS) {
      const { markdown } = methodStatement({ paradigm: id });
      // Split and rejoined as prose, so the semicolons become "and" — the
      // sources themselves must all still be there.
      for (const source of PARADIGMS[id].tradition.split(";")) {
        expect(markdown).toContain(source.trim());
      }
    }
  });

  it("names the analytic approach and its unit of analysis", () => {
    const { markdown } = methodStatement({ ...base, theory: "narrative_theory" });
    for (const source of THEORIES.narrative_theory.tradition.split(";")) {
      expect(markdown).toContain(source.trim());
    }
    expect(markdown).toMatch(/unit of analysis is the story as told/);
  });

  // The reader is entitled to wonder whether the same word in both places is a
  // decision or a duplication.
  it("says when the same name is doing both jobs", () => {
    const { markdown } = methodStatement({ paradigm: "grounded_theory", theory: "grounded_theory" });
    expect(markdown).toMatch(/operates here at both levels/);
    expect(markdown).toMatch(/coherent position rather than a repetition/);
  });

  it("does not say that when they are different", () => {
    const { markdown } = methodStatement({ paradigm: "interpretivism", theory: "narrative_theory" });
    expect(markdown).not.toMatch(/operates here at both levels/);
  });
});

describe("what it refuses to write", () => {
  // A chapter with a fluent but unearned rationale is worse than one with an
  // obvious hole, because the hole gets filled and the fluent paragraph gets
  // marked.
  it("leaves the justification to the researcher, and says so", () => {
    const { markdown, gaps } = methodStatement(base);
    expect(gaps.join(" ")).toMatch(/Why interpretivist rather than another paradigm/);
    expect(gaps.join(" ")).toMatch(/yours to write/);
    // It must not invent one.
    expect(markdown).not.toMatch(/was chosen because|is appropriate because|best suits/i);
  });

  it("always names ethics as the researcher's own", () => {
    expect(methodStatement(base).gaps.join(" ")).toMatch(/Ethics: approval, consent/);
  });

  // Never empty. A statement with no gaps is a statement pretending to be a
  // finished chapter.
  it("always has gaps", () => {
    const complete: MethodDeclaration = {
      paradigm: "pragmatism", theory: "institutional_theory", sampling: "purposive",
      sampleSize: 20, collection: "semi-structured interviews", participants: "practitioners",
    };
    expect(methodStatement(complete).gaps.length).toBeGreaterThan(0);
  });

  it("names each thing that is missing, rather than glossing over it", () => {
    const { gaps } = methodStatement(base);
    expect(gaps.join(" ")).toMatch(/analytic approach/);
    expect(gaps.join(" ")).toMatch(/sampling strategy/);
    expect(gaps.join(" ")).toMatch(/sample size/);
    expect(gaps.join(" ")).toMatch(/how the data were actually collected/i);
  });
});

describe("what the design licenses", () => {
  it("says randomisation is what licenses a causal reading", () => {
    const { markdown } = methodStatement({
      paradigm: "post_positivism", questionType: "causal", randomised: true,
    });
    expect(markdown).toMatch(/randomly allocated to conditions, which is what licenses/);
  });

  it("holds an unrandomised causal question to association", () => {
    const { markdown } = methodStatement({
      paradigm: "post_positivism", questionType: "causal", randomised: false,
    });
    expect(markdown).toMatch(/reported as association, not as cause/);
  });

  it("passes on a stated identification strategy for the reader to weigh", () => {
    const { markdown } = methodStatement({
      paradigm: "critical_realism", questionType: "causal", randomised: false,
      identificationStrategy: "Regression discontinuity at the funding cutoff.",
    });
    expect(markdown).toMatch(/rests on the following identification strategy, which the reader should weigh/);
    expect(markdown).toMatch(/Regression discontinuity at the funding cutoff/);
  });

  it("says saturation is an assertion until the process is given", () => {
    const bare = methodStatement({ paradigm: "grounded_theory", claimsSaturation: true });
    expect(bare.markdown).toMatch(/without the process it is an assertion/);
    expect(bare.gaps.join(" ")).toMatch(/How saturation was judged/);

    const given = methodStatement({
      paradigm: "grounded_theory", claimsSaturation: true,
      saturationAccount: "The last four interviews produced no new codes.",
    });
    expect(given.markdown).toMatch(/judged as follows: The last four interviews/);
  });
});

describe("the coherence check travels with the statement", () => {
  it("comes back empty for a design that hangs together", () => {
    expect(methodStatement({ paradigm: "interpretivism", theory: "narrative_theory" }).tensions)
      .toEqual([]);
  });

  it("names the tension without refusing to write the statement", () => {
    const { markdown, tensions } = methodStatement({
      paradigm: "positivism", theory: "narrative_theory",
    });
    expect(tensions.length).toBeGreaterThan(0);
    // The statement is still produced. Nothing blocks: the tension is a
    // supervisor's observation, not a validation error.
    expect(markdown).toMatch(/## Methodology/);
    expect(markdown).toMatch(/\*\*positivist\*\* paradigm/);
  });
});

// Three defects visible only once a whole statement was generated and read.
// All three read as carelessness in the first six words of a chapter.
describe("what a generated statement got wrong before anyone read one", () => {
  // "a interpretivism paradigm" — wrong article, and the noun where the
  // adjective belongs.
  it("uses the adjectival form and the right article", () => {
    expect(methodStatement({ paradigm: "interpretivism" }).markdown)
      .toMatch(/within an \*\*interpretivist\*\* paradigm/);
    expect(methodStatement({ paradigm: "positivism" }).markdown)
      .toMatch(/within a \*\*positivist\*\* paradigm/);
    expect(methodStatement({ paradigm: "phenomenology" }).markdown)
      .toMatch(/within a \*\*phenomenological\*\* paradigm/);
  });

  it("never writes the noun form after an article", () => {
    for (const id of PARADIGM_IDS) {
      const { markdown } = methodStatement({ paradigm: id });
      expect(markdown).not.toMatch(/within an? \*\*\w*(ism|ology|ics)\*\* paradigm/);
    }
  });

  // "(Weber, Economy and Society (1922); …)" — parentheses inside parentheses.
  it("does not nest the citation inside another pair of brackets", () => {
    for (const id of PARADIGM_IDS) {
      expect(methodStatement({ paradigm: id }).markdown).not.toMatch(/\([^()]*\([^()]*\)[^()]*\)/);
    }
  });

  // The first analytic move of critical discourse theory contains its own
  // commas, so a comma-joined list reads as six items instead of three.
  it("separates a list with semicolons when an item contains a comma", () => {
    const { markdown } = methodStatement({
      paradigm: "critical_theory", theory: "critical_discourse_theory",
    });
    expect(markdown).toMatch(/social practice; transitivity and nominalisation; and intertextual tracing/);
  });

  it("still uses commas when no item contains one", () => {
    const { markdown } = methodStatement({ paradigm: "grounded_theory", theory: "grounded_theory" });
    expect(markdown).toMatch(/open coding, axial coding, selective coding, and theoretical sampling/);
  });
});
