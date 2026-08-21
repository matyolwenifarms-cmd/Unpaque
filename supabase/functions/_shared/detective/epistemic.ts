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

// ---------------------------------------------------------------------------
// §6 and §10 vocabulary. Mirrored from the sources/evidence migration and
// drift-tested against it for the same reason as everything above.
// ---------------------------------------------------------------------------

export const SOURCE_KINDS = [
  "primary_document",
  "official_record",
  "testimony",
  "video",
  "audio",
  "image",
  "reporting",
  "archive",
  "dataset",
  "correspondence",
  "other",
] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number];

/**
 * §6's source hierarchy, strongest first, and configurable as the
 * specification requires.
 *
 * It is an ordering rather than a score. A number would be treated as a
 * measurement of reliability, and this is nothing of the sort: an official
 * record can be wrong and a piece of reporting can be impeccable. What the
 * ordering encodes is proximity to the event, which is a property of the
 * category rather than a judgement about any particular document.
 */
export const DEFAULT_SOURCE_HIERARCHY: readonly SourceKind[] = [
  "primary_document",
  "official_record",
  "testimony",
  "video",
  "audio",
  "image",
  "correspondence",
  "dataset",
  "reporting",
  "archive",
  "other",
];

export const EVIDENCE_CLASSIFICATIONS = [
  "supports",
  "contradicts",
  "contextualises",
  "undermines_source",
  "inconclusive",
] as const;

export type EvidenceClassification = (typeof EVIDENCE_CLASSIFICATIONS)[number];

export interface EvidenceLike {
  sourceId: string;
  classification: EvidenceClassification;
  /** Same bytes retrieved twice share this. Absent means unknown, not unique. */
  contentHash?: string | null;
}

/**
 * How many *independent* sources support a proposition.
 *
 * §3: corroboration matters, and repeated copying is not independent
 * corroboration. Two sources with the same content hash are the same bytes
 * fetched twice — a wire story printed in four papers is one source, and
 * counting it as four is the classic way a claim comes to look far better
 * supported than it is.
 *
 * Sources with no hash count separately, because unknown is not the same as
 * identical and refusing to count them would penalise material that simply has
 * not been hashed yet.
 */
export function independentSupport(evidence: readonly EvidenceLike[]): number {
  const hashes = new Set<string>();
  let unhashed = 0;
  for (const item of evidence) {
    if (item.classification !== "supports") continue;
    if (item.contentHash) hashes.add(item.contentHash);
    else unhashed += 1;
  }
  return hashes.size + unhashed;
}

/**
 * Whether the evidence permits calling something corroborated.
 *
 * Deliberately conservative and deliberately not automatic: this answers "may
 * a person mark this corroborated", not "mark it". §4 keeps human authority
 * explicit for consequential investigative decisions, and quietly promoting a
 * claim because a count crossed two would be exactly the collapse into truth
 * the epistemic model exists to prevent.
 */
export function mayBeCorroborated(evidence: readonly EvidenceLike[]): boolean {
  if (evidence.some((item) => item.classification === "contradicts")) return false;
  return independentSupport(evidence) >= 2;
}
