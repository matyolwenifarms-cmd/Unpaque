// §7: a correlational design cannot emit a causal claim.
//
// This is the analytics module's version of the diagnostic guard, and it is
// checkable for the same reason the diagnostic's is — the design is in the data
// model, not in prose. A `Finding` knows which procedure produced it, so
// whether the study could support "causes" is a fact the code has, rather than
// a judgement it would have to make.
//
// It refuses rather than rewrites. A sentence with the causal verb swapped out
// is a sentence whose reasoning we can no longer see, and the researcher is the
// one who has to defend the claim in a viva.
//
// ## What is deliberately not banned
//
// The vocabulary of the methods themselves. "Path analysis", "causal
// modelling", "the causal question", "a correlational design cannot support a
// causal claim" — a guard that swallowed those would leave the write-up unable
// to describe its own limitations, which is the opposite of what it is for. So
// the rules match a claim about *the finding*, and a naming test asserts the
// methodological phrases survive.

export const DESIGN_KINDS = [
  "experimental",
  "quasi_experimental",
  "correlational",
  "descriptive",
  "qualitative",
] as const;
export type DesignKind = (typeof DESIGN_KINDS)[number];

export interface Design {
  kind: DesignKind;
  /** True only where participants were randomly allocated to conditions. */
  randomised: boolean;
  /**
   * An identification strategy that licenses a causal reading without
   * randomisation — an instrument, a discontinuity, a defended counterfactual.
   * Free text, because naming one is the researcher's argument to make.
   */
  identificationStrategy?: string;
}

/**
 * May this design carry a causal claim at all?
 *
 * Randomisation, or a named identification strategy. Nothing else — and
 * notably not a large sample, a strong correlation, or a plausible mechanism,
 * which are the three things that most often stand in for it.
 */
export function mayClaimCause(design: Design): boolean {
  if (design.kind === "experimental" && design.randomised) return true;
  return Boolean(design.identificationStrategy?.trim());
}

export interface CausalRule {
  id: string;
  pattern: RegExp;
  why: string;
}

export const CAUSAL_RULES: readonly CausalRule[] = [
  {
    id: "causes",
    // Non-global, for the same lastIndex reason as the diagnostic's guard.
    // `\b(?!question|claim|inference|language|reading|modelling)` keeps the
    // methodological uses, which describe the design rather than assert about
    // the finding.
    pattern: /\b(causes?|caused|causing)\b(?!\s+(question|claim|inference|language|reading|model))/i,
    why: "asserts cause",
  },
  {
    id: "leads-to",
    pattern: /\bleads?\s+to\b|\bled\s+to\b/i,
    why: "asserts that one variable produces another",
  },
  {
    id: "results-in",
    pattern: /\bresults?\s+in\b|\bresulted\s+in\b/i,
    why: "asserts that one variable produces another",
  },
  {
    id: "effect-of-on",
    pattern: /\bthe\s+(effect|impact|influence)\s+of\s+\w+(\s+\w+)?\s+on\b/i,
    why: "names one variable as acting on another",
  },
  {
    id: "increases-decreases",
    // Inflected forms only. The bare stems double as adjectives and nouns —
    // "lower wellbeing", "an increase in trust", "a raise" — and matching them
    // refused "was associated with lower wellbeing", which is the association
    // wording this guard exists to steer people towards. A guard that rejects
    // the correct sentence teaches people to ignore it.
    pattern: /\b(increases|increased|decreases|decreased|reduces|reduced|raises|raised|lowers|lowered|improves|improved|worsens|worsened)\b/i,
    why: "describes one variable changing another",
  },
  {
    id: "because-of",
    pattern: /\b(because\s+of|due\s+to|owing\s+to|as\s+a\s+result\s+of)\b/i,
    why: "attributes the outcome to a cause",
  },
  {
    id: "driven-by",
    pattern: /\b(driven\s+by|produced\s+by|brought\s+about\s+by|attributable\s+to)\b/i,
    why: "attributes the outcome to a cause",
  },
  {
    id: "therefore-causal",
    pattern: /\b(makes?|made)\s+(people|participants|respondents|students|users|them)\b/i,
    why: "asserts the variable acted on people",
  },
];

export interface CausalViolation {
  ruleId: string;
  matched: string;
  why: string;
  field: string;
}

/** Scan one piece of prose written about a finding. */
export function inspectClaim(text: string, field: string): CausalViolation[] {
  const violations: CausalViolation[] = [];
  for (const rule of CAUSAL_RULES) {
    const match = rule.pattern.exec(text);
    if (match) violations.push({ ruleId: rule.id, matched: match[0], why: rule.why, field });
  }
  return violations;
}

export type ClaimOutcome =
  | { ok: true }
  | { ok: false; violations: CausalViolation[]; says: string };

/**
 * Check prose against the design that produced it.
 *
 * Passes everything where the design supports a causal reading — the guard is
 * about the mismatch, not about the vocabulary. An experiment is entitled to
 * say "causes", and a tool that refused it would be teaching researchers to
 * hedge findings they have actually earned.
 */
export function checkCausalClaim(text: string, design: Design, field = "interpretation"): ClaimOutcome {
  if (mayClaimCause(design)) return { ok: true };
  const violations = inspectClaim(text, field);
  if (violations.length === 0) return { ok: true };

  return {
    ok: false,
    violations,
    says: [
      `This is a ${design.kind.replace(/_/g, "-")} design with no randomisation and no stated identification strategy, so it cannot support a claim about cause. The wording says one anyway:`,
      ...violations.map((violation) => `- "${violation.matched}" — ${violation.why}`),
      "",
      "Either state the finding as association — \"was associated with\", \"varied with\", \"predicted\" in the statistical sense — or name what licenses the causal reading: random allocation, an instrument, a discontinuity, or a counterfactual you can defend.",
    ].join("\n"),
  };
}

/**
 * The association wording, offered rather than substituted.
 *
 * A researcher who has to choose the replacement has looked at the sentence;
 * one handed a rewrite has not.
 */
export const ASSOCIATION_WORDINGS: readonly string[] = [
  "was associated with",
  "varied with",
  "was related to",
  "predicted, in the statistical sense",
  "co-occurred with",
  "was higher among",
];
