// The Detective's epistemic model, §4 of the specification.
//
// The system must never casually collapse information into truth. Every
// important item carries one of these, `unknown` included — that is a
// legitimate answer rather than a failure to compute one, and the specification
// says so explicitly.
//
// These mirror the `epistemic_status` and `case_role` Postgres enums.
// `epistemic.test.ts` reads the migration and asserts they still agree, because
// a client-side copy of a server rule drifts the moment somebody adds a value
// on one side only.

export const EPISTEMIC_STATUSES = [
  "fact",
  "claim",
  "inference",
  "unresolved",
  "corroborated",
  "partially_corroborated",
  "contested",
  "contradicted",
  "unverified",
  "disputed",
  "unknown",
] as const;

export type EpistemicStatus = (typeof EPISTEMIC_STATUSES)[number];

export interface EpistemicMeaning {
  status: EpistemicStatus;
  label: string;
  meaning: string;
  /** What the system must do when presenting an item in this state. */
  required: string;
}

export const EPISTEMIC_MEANINGS: Readonly<Record<EpistemicStatus, EpistemicMeaning>> = {
  fact: {
    status: "fact",
    label: "Fact",
    meaning: "Directly supported factual observation from a source.",
    required: "Present as an observation and retain its provenance.",
  },
  claim: {
    status: "claim",
    label: "Claim",
    meaning: "Something a person or source asserts.",
    required: "Do not convert into fact merely because it is repeated.",
  },
  inference: {
    status: "inference",
    label: "Inference",
    meaning: "A conclusion derived from several pieces of information.",
    required: "Show the supporting evidence and the reasoning category.",
  },
  unresolved: {
    status: "unresolved",
    label: "Unresolved",
    meaning: "The available public record cannot establish the answer.",
    required: "State the uncertainty and identify what could resolve it.",
  },
  corroborated: {
    status: "corroborated",
    label: "Corroborated",
    meaning: "Independent evidence converges on the proposition.",
    required: "Show the independent supporting sources.",
  },
  partially_corroborated: {
    status: "partially_corroborated",
    label: "Partially corroborated",
    meaning: "Some elements are supported; others remain uncertain.",
    required: "Explain which elements are supported.",
  },
  contested: {
    status: "contested",
    label: "Contested",
    meaning: "Sources or evidence conflict.",
    required: "Show the conflict; do not silently choose a side.",
  },
  contradicted: {
    status: "contradicted",
    label: "Contradicted",
    meaning: "Evidence directly conflicts with the proposition.",
    required: "Show source A, source B and the exact difference.",
  },
  unverified: {
    status: "unverified",
    label: "Unverified",
    meaning: "The claim or evidence lacks adequate verification.",
    required: "Do not elevate its evidential weight.",
  },
  disputed: {
    status: "disputed",
    label: "Disputed",
    meaning: "The matter is actively disputed.",
    required: "Preserve the competing accounts.",
  },
  unknown: {
    status: "unknown",
    label: "Unknown",
    meaning: "The system does not currently know.",
    required: "Present as a valid state, not as a failure.",
  },
};

/**
 * §4's language discipline, as a lookup rather than a suggestion.
 *
 * The specification pairs each strength of evidence with the wording the
 * system may use. Keeping it here means a generated sentence can be checked
 * against the strength it claims, instead of every prompt being trusted to
 * remember the table.
 */
export const EVIDENCE_LANGUAGE = [
  { strength: "strong", phrasing: "The available records establish…" },
  { strength: "moderate", phrasing: "The evidence strongly supports…" },
  { strength: "limited", phrasing: "The evidence is consistent with…" },
  { strength: "uncertain", phrasing: "There are several plausible explanations…" },
  { strength: "unsupported", phrasing: "I cannot substantiate that claim from the available evidence." },
  { strength: "contradictory", phrasing: "The evidence is currently contested." },
] as const;

export const CASE_ROLES = [
  "owner",
  "investigator",
  "editor",
  "researcher",
  "viewer",
  "commenter",
  "source_contributor",
  "analyst",
] as const;

export type CaseRole = (typeof CASE_ROLES)[number];

/** Roles that may change case content. Mirrors `public.can_write_case`. */
export const WRITING_ROLES: readonly CaseRole[] = ["owner", "investigator", "editor"];

export function canWrite(role: CaseRole | null): boolean {
  return role !== null && WRITING_ROLES.includes(role);
}

export const CASE_VISIBILITIES = ["private", "published"] as const;
export type CaseVisibility = (typeof CASE_VISIBILITIES)[number];
