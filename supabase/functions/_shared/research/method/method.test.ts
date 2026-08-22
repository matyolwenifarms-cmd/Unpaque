import { describe, expect, it } from "vitest";
import { PARADIGMS, PARADIGM_IDS } from "./paradigms.ts";
import { THEORIES, THEORY_IDS } from "./theories.ts";
import { checkCoherence } from "./coherence.ts";

describe("the closed vocabulary", () => {
  it("has the fifteen paradigms the specification names", () => {
    expect(PARADIGM_IDS).toHaveLength(15);
    expect(Object.keys(PARADIGMS)).toHaveLength(15);
  });

  it("has the fourteen analytic theories", () => {
    expect(THEORY_IDS).toHaveLength(14);
    expect(Object.keys(THEORIES)).toHaveLength(14);
  });

  it("every entry is complete", () => {
    for (const id of PARADIGM_IDS) {
      const p = PARADIGMS[id];
      expect(p.id).toBe(id);
      // The tradition is what a supervisor checks; an entry without one is a
      // claim about scholarship with no way to look it up.
      expect(p.tradition).toMatch(/\(\d{4}/);
      expect(p.methods.length).toBeGreaterThan(0);
      expect(p.analyticMoves.length).toBeGreaterThan(0);
    }
    for (const id of THEORY_IDS) {
      expect(THEORIES[id].tradition).toMatch(/\(\d{4}/);
      expect(THEORIES[id].analyticMoves.length).toBeGreaterThan(0);
    }
  });

  // The gloss is what a first-year reads. Checking it is short and plain is
  // crude, but a gloss that needs a glossary is not a gloss.
  it("glosses are one plain sentence", () => {
    for (const id of PARADIGM_IDS) {
      const gloss = PARADIGMS[id].gloss;
      expect(gloss.length).toBeLessThan(260);
      expect(gloss.trim()).toMatch(/\.$/);
    }
  });

  it("records where a name is both a paradigm and an analytic theory", () => {
    // Five overlap, and the overlap is real rather than a duplication to tidy
    // away: each operates at both levels.
    const both = THEORY_IDS.filter((id) => THEORIES[id].alsoAParadigm);
    expect(both.sort()).toEqual(
      ["grounded_theory", "phenomenology", "social_constructionism", "symbolic_interactionism"].sort(),
    );
    for (const id of both) {
      expect(PARADIGM_IDS).toContain(THEORIES[id].alsoAParadigm);
    }
  });
});

describe("coherence checking", () => {
  it("says nothing about a design that hangs together", () => {
    expect(checkCoherence({ paradigm: "interpretivism", theory: "narrative_theory" })).toEqual([]);
    expect(checkCoherence({ paradigm: "post_positivism", theory: "technology_acceptance" })).toEqual([]);
  });

  it("names the tension between a measuring frame and an interpreting method", () => {
    const [tension] = checkCoherence({ paradigm: "positivism", theory: "narrative_theory" });
    expect(tension?.level).toBe("tension");
    expect(tension?.says).toContain("Positivism");
    expect(tension?.says).toContain("Narrative theory");
    expect(tension?.source).toMatch(/Guba & Lincoln/);
  });

  // Pragmatism exists to defend exactly this, and does so by construction —
  // its epistemology matches neither branch — rather than by a special case.
  it("leaves pragmatism alone, which is the point of pragmatism", () => {
    expect(checkCoherence({ paradigm: "pragmatism", theory: "narrative_theory" })).toEqual([]);
    expect(checkCoherence({ paradigm: "pragmatism", theory: "technology_acceptance" })).toEqual([]);
  });

  it("flags grounded theory with a coding frame fixed in advance", () => {
    const found = checkCoherence({ paradigm: "grounded_theory", apriorCodingFrame: true });
    expect(found.some((t) => /emerging|emerge|emergent|data rather than/i.test(t.says))).toBe(true);
    expect(found[0]?.consider).toMatch(/template or framework analysis/i);
  });

  it("does not flag grounded theory that codes openly", () => {
    expect(checkCoherence({ paradigm: "grounded_theory", apriorCodingFrame: false })).toEqual([]);
  });

  it("questions a phenomenology sized for inference, as a note rather than a tension", () => {
    const [found] = checkCoherence({ paradigm: "phenomenology", sampleSize: 300 });
    expect(found?.level).toBe("note");
    expect(found?.says).toContain("300");
    expect(checkCoherence({ paradigm: "phenomenology", sampleSize: 8 })).toEqual([]);
  });

  it("flags a causal question with no random allocation", () => {
    const [found] = checkCoherence({
      paradigm: "post_positivism", questionType: "causal", randomised: false,
    });
    expect(found?.says).toMatch(/causal/i);
    expect(found?.consider).toMatch(/associational|identification/i);
  });

  it("says nothing when the causal question is randomised", () => {
    expect(
      checkCoherence({ paradigm: "post_positivism", questionType: "causal", randomised: true }),
    ).toEqual([]);
  });

  it("flags saturation claimed without an account of how it was judged", () => {
    const [found] = checkCoherence({ paradigm: "grounded_theory", claimsSaturation: true });
    expect(found?.says).toMatch(/saturation/i);
    expect(
      checkCoherence({
        paradigm: "grounded_theory",
        claimsSaturation: true,
        saturationAccount: "The last four interviews produced no new codes.",
      }),
    ).toEqual([]);
  });

  // The register is the design. These are prompts to a researcher, not
  // validation errors, and every one must carry a way out — a tension with no
  // resolution is discouragement wearing a citation.
  it("never refuses anything, and always offers a way through", () => {
    const everything = checkCoherence({
      paradigm: "positivism",
      theory: "narrative_theory",
      sampling: "statistical",
      questionType: "causal",
      randomised: false,
      claimsSaturation: true,
    });
    expect(everything.length).toBeGreaterThan(1);
    for (const tension of everything) {
      expect(tension.consider.trim()).not.toBe("");
      expect(tension.source.trim()).not.toBe("");
      // Nothing here is allowed to tell somebody they are wrong.
      expect(tension.says).not.toMatch(/\b(invalid|not allowed|forbidden|error|must not)\b/i);
    }
  });
});
