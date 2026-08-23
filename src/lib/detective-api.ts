import type {
  EpistemicStatus,
  EvidenceClassification,
  SourceKind,
} from "@shared/detective/epistemic.ts";
import type { DateCertainty, TimeOrigin } from "@shared/detective/timeline.ts";
import { supabase } from "@/lib/supabase.ts";

// Queries go straight to Postgres through supabase-js, with no edge function in
// between, because row level security is doing the work. A function here would
// be a second place to express "who may read this case" — and a second place to
// get it wrong. See supabase/migrations/20260822000000_detective_case_privacy.sql.

export interface CaseSummary {
  id: string;
  title: string;
  question: string | null;
  visibility: "private" | "published";
  created_at: string;
}

export interface ClaimRow {
  id: string;
  statement: string;
  status: EpistemicStatus;
  asserted_by: string | null;
}

export interface SourceRow {
  id: string;
  kind: string;
  title: string;
  retrieved_from: string;
  retrieved_at: string;
  /**
   * Same bytes retrieved twice share this. Null means unknown, not unique.
   *
   * Selected because the dossier cannot count independent support without it:
   * a wire story printed in four papers is one source, and four rows that
   * look distinct is exactly how a claim comes to appear far better supported
   * than it is.
   */
  content_hash: string | null;
  /**
   * The per-case number this is read aloud by: SOURCE 014.
   *
   * Assigned once and never reused, so a dossier quoting it still points at
   * this record after something earlier is deleted.
   */
  reference: number | null;
}

export type Result<T> = { ok: true; data: T } | { ok: false; message: string };

/**
 * Errors are values, not exceptions.
 *
 * Every failure this layer has is one a person needs a sentence about, and a
 * thrown error ends up in a catch that renders "something went wrong" — the
 * least useful thing any of them could say.
 */
function wrap<T>(data: T | null, error: { message: string } | null): Result<T> {
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: (data ?? []) as T };
}

export async function listCases(): Promise<Result<CaseSummary[]>> {
  // One literal, deliberately: supabase-js derives the row type by parsing this
  // string as a literal type, and concatenating it widens the result to `any`.
  const { data, error } = await supabase()
    .from("cases")
    .select("id, title, question, visibility, created_at")
    .order("created_at", { ascending: false });
  return wrap<CaseSummary[]>(data as CaseSummary[] | null, error);
}

export async function createCase(title: string, question: string): Promise<Result<CaseSummary>> {
  const { data: auth } = await supabase().auth.getUser();
  const owner = auth.user?.id;
  if (!owner) return { ok: false, message: "You need to be signed in to open a case." };

  const { data, error } = await supabase()
    .from("cases")
    .insert({ owner_id: owner, title: title.trim(), question: question.trim() || null })
    .select("id, title, question, visibility, created_at")
    .single();
  return wrap<CaseSummary>(data as CaseSummary | null, error);
}

export async function getCase(id: string): Promise<Result<CaseSummary | null>> {
  const { data, error } = await supabase()
    .from("cases")
    .select("id, title, question, visibility, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: data as CaseSummary | null };
}

export async function listClaims(caseId: string): Promise<Result<ClaimRow[]>> {
  const { data, error } = await supabase()
    .from("claims")
    .select("id, statement, status, asserted_by")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });
  return wrap<ClaimRow[]>(data as ClaimRow[] | null, error);
}

export interface EvidenceRow {
  id: string;
  claim_id: string;
  source_id: string;
  classification: EvidenceClassification;
  excerpt: string | null;
}

export async function createSource(
  caseId: string,
  input: { kind: SourceKind; title: string; retrievedFrom: string },
): Promise<Result<SourceRow>> {
  const { data, error } = await supabase()
    .from("sources")
    .insert({
      case_id: caseId,
      kind: input.kind,
      title: input.title.trim(),
      retrieved_from: input.retrievedFrom.trim(),
    })
    .select("id, kind, title, retrieved_from, retrieved_at, content_hash, reference")
    .single();
  return wrap<SourceRow>(data as SourceRow | null, error);
}

export async function createClaim(
  caseId: string,
  input: { statement: string; assertedBy: string },
): Promise<Result<ClaimRow>> {
  // No status is sent. §3: a claim is not a fact, and the column defaults to
  // `unknown` — letting the form choose would make "corroborated" a thing you
  // can type rather than a thing the evidence earns.
  const { data, error } = await supabase()
    .from("claims")
    .insert({
      case_id: caseId,
      statement: input.statement.trim(),
      asserted_by: input.assertedBy.trim() || null,
    })
    .select("id, statement, status, asserted_by")
    .single();
  return wrap<ClaimRow>(data as ClaimRow | null, error);
}

export async function createEvidence(
  caseId: string,
  input: { claimId: string; sourceId: string; classification: EvidenceClassification; excerpt: string },
): Promise<Result<EvidenceRow>> {
  const { data, error } = await supabase()
    .from("evidence")
    .insert({
      case_id: caseId,
      claim_id: input.claimId,
      source_id: input.sourceId,
      classification: input.classification,
      excerpt: input.excerpt.trim() || null,
    })
    .select("id, claim_id, source_id, classification, excerpt")
    .single();
  return wrap<EvidenceRow>(data as EvidenceRow | null, error);
}

export async function listEvidence(caseId: string): Promise<Result<EvidenceRow[]>> {
  const { data, error } = await supabase()
    .from("evidence")
    .select("id, claim_id, source_id, classification, excerpt")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });
  return wrap<EvidenceRow[]>(data as EvidenceRow[] | null, error);
}

export interface EventRow {
  id: string;
  source_id: string;
  label: string;
  occurred_at: string | null;
  certainty: DateCertainty;
  origin: TimeOrigin;
  tolerance_minutes: number | null;
  moment: string | null;
}

export async function listEvents(caseId: string): Promise<Result<EventRow[]>> {
  const { data, error } = await supabase()
    .from("events")
    .select("id, source_id, label, occurred_at, certainty, origin, tolerance_minutes, moment")
    .eq("case_id", caseId)
    .order("occurred_at", { ascending: true, nullsFirst: false });
  return wrap<EventRow[]>(data as EventRow[] | null, error);
}

export async function createEvent(
  caseId: string,
  input: {
    sourceId: string;
    label: string;
    occurredAt: string | null;
    certainty: DateCertainty;
    origin: TimeOrigin;
    moment: string;
  },
): Promise<Result<EventRow>> {
  const { data, error } = await supabase()
    .from("events")
    .insert({
      case_id: caseId,
      source_id: input.sourceId,
      label: input.label.trim(),
      // The schema refuses a date on an unknown-certainty event and refuses one
      // missing on any other, so the two are decided together here rather than
      // left for a constraint to catch.
      occurred_at: input.certainty === "unknown" ? null : input.occurredAt,
      certainty: input.certainty,
      origin: input.origin,
      moment: input.moment.trim() || null,
    })
    .select("id, source_id, label, occurred_at, certainty, origin, tolerance_minutes, moment")
    .single();
  return wrap<EventRow>(data as EventRow | null, error);
}

export async function listSources(caseId: string): Promise<Result<SourceRow[]>> {
  const { data, error } = await supabase()
    .from("sources")
    .select("id, kind, title, retrieved_from, retrieved_at, content_hash, reference")
    .eq("case_id", caseId)
    .order("retrieved_at", { ascending: false });
  return wrap<SourceRow[]>(data as SourceRow[] | null, error);
}

// --- Hypotheses -------------------------------------------------------------
//
// Section 12. Competing explanations, each carrying what would end it.

export interface HypothesisRow {
  id: string;
  statement: string;
  falsifier: string;
  assumptions: string[];
}

export interface HypothesisEvidenceRow {
  id: string;
  hypothesis_id: string;
  source_id: string;
  classification: EvidenceClassification;
  summary: string;
}

export async function listHypotheses(caseId: string): Promise<Result<HypothesisRow[]>> {
  const { data, error } = await supabase()
    .from("hypotheses")
    .select("id, statement, falsifier, assumptions")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });
  return wrap<HypothesisRow[]>(data, error);
}

export async function createHypothesis(
  caseId: string,
  input: { statement: string; falsifier: string; assumptions: string[] },
): Promise<Result<HypothesisRow>> {
  const { data, error } = await supabase()
    .from("hypotheses")
    .insert({
      case_id: caseId,
      statement: input.statement.trim(),
      falsifier: input.falsifier.trim(),
      assumptions: input.assumptions.map((entry) => entry.trim()).filter(Boolean),
    })
    .select("id, statement, falsifier, assumptions")
    .single();
  return wrap<HypothesisRow>(data, error);
}

export async function deleteHypothesis(id: string): Promise<Result<null>> {
  const { error } = await supabase().from("hypotheses").delete().eq("id", id);
  return wrap<null>(null, error);
}

export async function listHypothesisEvidence(
  caseId: string,
): Promise<Result<HypothesisEvidenceRow[]>> {
  const { data, error } = await supabase()
    .from("hypothesis_evidence")
    .select("id, hypothesis_id, source_id, classification, summary")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });
  return wrap<HypothesisEvidenceRow[]>(data, error);
}

/**
 * Link a source to a hypothesis, with what it shows.
 *
 * The same source may be linked to several hypotheses with different
 * classifications — that is the ordinary case, not an edge one. What it may
 * not be is linked twice identically, and the database refuses that rather
 * than this function checking for it.
 */
export async function linkHypothesisEvidence(
  caseId: string,
  input: {
    hypothesisId: string;
    sourceId: string;
    classification: EvidenceClassification;
    summary: string;
  },
): Promise<Result<HypothesisEvidenceRow>> {
  const { data, error } = await supabase()
    .from("hypothesis_evidence")
    .insert({
      case_id: caseId,
      hypothesis_id: input.hypothesisId,
      source_id: input.sourceId,
      classification: input.classification,
      summary: input.summary.trim(),
    })
    .select("id, hypothesis_id, source_id, classification, summary")
    .single();
  if (error && /duplicate key|unique constraint/i.test(error.message)) {
    return { ok: false, message: "That record is already entered against this explanation." };
  }
  return wrap<HypothesisEvidenceRow>(data, error);
}

export async function unlinkHypothesisEvidence(id: string): Promise<Result<null>> {
  const { error } = await supabase().from("hypothesis_evidence").delete().eq("id", id);
  return wrap<null>(null, error);
}

// --- The case graph ---------------------------------------------------------
//
// Section 11. Nodes and the relationships between them.

export interface EntityRow {
  id: string;
  kind: "person" | "organisation" | "location";
  display_name: string;
  aliases: string[];
  role_in_case: string | null;
  description: string | null;
  sensitive: boolean;
}

export interface EdgeRow {
  id: string;
  relation: string;
  status: EpistemicStatus;
  established_by: string | null;
  note: string | null;
  source_entity_id: string | null;
  source_event_id: string | null;
  source_claim_id: string | null;
  source_source_id: string | null;
  target_entity_id: string | null;
  target_event_id: string | null;
  target_claim_id: string | null;
  target_source_id: string | null;
}

export async function listEntities(caseId: string): Promise<Result<EntityRow[]>> {
  const { data, error } = await supabase()
    .from("case_entities")
    .select("id, kind, display_name, aliases, role_in_case, description, sensitive")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });
  return wrap<EntityRow[]>(data, error);
}

export async function createEntity(
  caseId: string,
  input: {
    kind: EntityRow["kind"];
    displayName: string;
    aliases: string[];
    roleInCase: string;
    sensitive: boolean;
  },
): Promise<Result<EntityRow>> {
  const { data, error } = await supabase()
    .from("case_entities")
    .insert({
      case_id: caseId,
      kind: input.kind,
      display_name: input.displayName.trim(),
      aliases: input.aliases.map((alias) => alias.trim()).filter(Boolean),
      role_in_case: input.roleInCase.trim() || null,
      sensitive: input.sensitive,
    })
    .select("id, kind, display_name, aliases, role_in_case, description, sensitive")
    .single();
  return wrap<EntityRow>(data, error);
}

export async function deleteEntity(id: string): Promise<Result<null>> {
  const { error } = await supabase().from("case_entities").delete().eq("id", id);
  return wrap<null>(null, error);
}

export async function listEdges(caseId: string): Promise<Result<EdgeRow[]>> {
  const { data, error } = await supabase()
    .from("case_edges")
    .select("id, relation, status, established_by, note, source_entity_id, source_event_id, source_claim_id, source_source_id, target_entity_id, target_event_id, target_claim_id, target_source_id")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });
  return wrap<EdgeRow[]>(data, error);
}

/**
 * Draw a relationship.
 *
 * The endpoint columns are exclusive arcs, so exactly one of each set is sent.
 * The database refuses anything else — including an edge asserted as fact
 * with nothing establishing it, which is the rule the whole table is shaped
 * around.
 */
export async function createEdge(
  caseId: string,
  input: {
    relation: string;
    from: { kind: string; id: string };
    to: { kind: string; id: string };
    status: EpistemicStatus;
    establishedBy: string | null;
    note: string;
  },
): Promise<Result<EdgeRow>> {
  const endpoint = (side: "source" | "target", node: { kind: string; id: string }) => ({
    [`${side}_entity_id`]: node.kind === "entity" ? node.id : null,
    [`${side}_event_id`]: node.kind === "event" ? node.id : null,
    [`${side}_claim_id`]: node.kind === "claim" ? node.id : null,
    [`${side}_source_id`]: node.kind === "source" ? node.id : null,
  });

  const { data, error } = await supabase()
    .from("case_edges")
    .insert({
      case_id: caseId,
      relation: input.relation,
      status: input.status,
      established_by: input.establishedBy,
      note: input.note.trim() || null,
      ...endpoint("source", input.from),
      ...endpoint("target", input.to),
    })
    .select("id, relation, status, established_by, note, source_entity_id, source_event_id, source_claim_id, source_source_id, target_entity_id, target_event_id, target_claim_id, target_source_id")
    .single();
  if (error && /duplicate key|unique constraint/i.test(error.message)) {
    return { ok: false, message: "That relationship is already recorded." };
  }
  return wrap<EdgeRow>(data, error);
}

export async function deleteEdge(id: string): Promise<Result<null>> {
  const { error } = await supabase().from("case_edges").delete().eq("id", id);
  return wrap<null>(null, error);
}
