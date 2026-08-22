// §6 coherence checking: name the tension, cite the source, leave the decision.
//
// The specification is unusually explicit about the register here, and it is
// the whole design. These are **not** validation errors. Every one of them is
// defensible in some study — pragmatism exists partly to defend several — and a
// tool that refused an incoherent-looking design would be overruling a
// supervisor it cannot hear. So nothing here blocks anything. It says what the
// tension is, cites where the argument lives, and stops.
//
// The opposite failure is just as real: a silent tool lets somebody submit a
// methodology chapter in which a positivist frame sits beside eight interviews,
// and the first person to say so is an examiner.
//
// No model is involved. Every check below is a comparison between two declared
// fields, which is exactly why the fields exist: `stance` on a theory and
// `epistemology` on a paradigm are there so this file can be arithmetic rather
// than judgement.

import { PARADIGMS, type ParadigmId } from "./paradigms.ts";
import { THEORIES, type TheoryId } from "./theories.ts";

/** How much a reader should slow down, not how wrong they are. */
export const TENSION_LEVELS = ["note", "tension"] as const;
export type TensionLevel = (typeof TENSION_LEVELS)[number];

export interface Tension {
  readonly level: TensionLevel;
  /** What the tension is, in a sentence a supervisor would recognise. */
  readonly says: string;
  /** Where the argument lives, so the researcher can go and settle it. */
  readonly source: string;
  /** Always present. A tension with no way to resolve it is just discouragement. */
  readonly consider: string;
}

export interface Design {
  readonly paradigm: ParadigmId;
  readonly theory?: TheoryId;
  /** Declared sampling approach, where the researcher has stated one. */
  readonly sampling?: "statistical" | "purposive";
  readonly sampleSize?: number;
  /** True where a coding frame is fixed before data collection. */
  readonly apriorCodingFrame?: boolean;
  /** The shape of the research question, where it has been classified. */
  readonly questionType?: "causal" | "associational" | "descriptive" | "exploratory";
  /** Whether the design can support a causal claim: random allocation, or not. */
  readonly randomised?: boolean;
  /** True where the write-up claims thematic saturation. */
  readonly claimsSaturation?: boolean;
  /** How saturation was judged, where an account has been given. */
  readonly saturationAccount?: string;
}

export function checkCoherence(design: Design): Tension[] {
  const paradigm = PARADIGMS[design.paradigm];
  const theory = design.theory ? THEORIES[design.theory] : undefined;
  const tensions: Tension[] = [];

  // Paradigm against analytic theory. Pragmatism is exempt by construction
  // rather than by a special case: its epistemology is `pragmatic`, which
  // matches neither side of this comparison, so it never triggers.
  if (theory && theory.stance !== "either") {
    const measuring = paradigm.epistemology === "objectivist";
    if (measuring && theory.stance === "interpreting") {
      tensions.push({
        level: "tension",
        says: `${paradigm.name} treats knowledge as something measured from outside, while ${theory.name} works by interpreting what things mean to the people involved.`,
        source: "Guba & Lincoln, Competing Paradigms in Qualitative Research (1994)",
        consider:
          "Either state which one governs when they disagree, or declare pragmatism or critical realism, both of which are built to hold the two together.",
      });
    }
    if (!measuring && theory.stance === "measuring" && paradigm.epistemology === "subjectivist") {
      tensions.push({
        level: "tension",
        says: `${paradigm.name} holds that meaning is made by participants, while ${theory.name} models it as variables to be measured.`,
        source: "Guba & Lincoln, Competing Paradigms in Qualitative Research (1994)",
        consider:
          "Post-positivism or pragmatism would carry the measurement without contradicting the frame.",
      });
    }
  }

  // Grounded theory with the one thing it is defined against. Glaser and
  // Strauss's argument is precisely that the categories come from the data.
  if ((design.paradigm === "grounded_theory" || design.theory === "grounded_theory") && design.apriorCodingFrame) {
    tensions.push({
      level: "tension",
      says:
        "Grounded theory is declared alongside a coding frame fixed before collection. The method is defined by categories emerging from the data rather than being brought to it.",
      source: "Glaser & Strauss, The Discovery of Grounded Theory (1967), ch. 3",
      consider:
        "Either drop the fixed frame and code openly, or call this what it is — template or framework analysis, which are respectable and do not claim to be grounded theory.",
    });
  }

  // Phenomenology with a sample sized for inference. The number is a heuristic
  // and is stated as one: this is a prompt to justify, never a rule.
  if ((design.paradigm === "phenomenology" || design.theory === "phenomenology") && (design.sampleSize ?? 0) > 25) {
    tensions.push({
      level: "note",
      says: `Phenomenology with ${design.sampleSize} participants. The method asks for depth in a small number of accounts; large samples usually mean the analysis cannot stay close to any of them.`,
      source: "Smith, Flowers & Larkin, Interpretative Phenomenological Analysis (2009), ch. 3",
      consider:
        "If the number is deliberate, say why in the methodology. Published IPA studies commonly use between three and fifteen.",
    });
  }

  if (design.sampling === "statistical" && paradigm.sampling === "purposive") {
    tensions.push({
      level: "tension",
      says: `${paradigm.name} selects cases for what they can show, not to represent a population, but the sampling is declared as statistical.`,
      source: "Patton, Qualitative Research and Evaluation Methods (2015), ch. 5",
      consider:
        "Purposive, theoretical or maximum-variation sampling would match the frame. If representativeness is genuinely needed, the paradigm may be the thing to change.",
    });
  }

  // A causal question the design cannot answer. This is checkable because the
  // design is in the data model rather than in prose — the same reason Unpack's
  // guard can work at all.
  if (design.questionType === "causal" && design.randomised === false) {
    tensions.push({
      level: "tension",
      says:
        "The question is causal and the design has no random allocation. Whatever is found, something other than the supposed cause may be producing it.",
      source: "Shadish, Cook & Campbell, Experimental and Quasi-Experimental Designs (2002), ch. 1",
      consider:
        "Either state the question as associational, or name the identification strategy that licenses the causal reading — instrument, discontinuity, or a defended counterfactual.",
    });
  }

  if (design.claimsSaturation && !design.saturationAccount?.trim()) {
    tensions.push({
      level: "tension",
      says:
        "Thematic saturation is claimed with no account of how it was judged. Saturation is a conclusion about a process, so without the process it is an assertion.",
      source: "Braun & Clarke, To Saturate or Not to Saturate? (2021)",
      consider:
        "Say how many interviews produced no new codes, and against what. Or drop the claim — a rich analysis does not need it.",
    });
  }

  return tensions;
}
