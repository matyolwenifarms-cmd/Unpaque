import type { Code } from "@shared/research/qualitative/codebook.ts";
import type { Coding } from "@shared/research/qualitative/coding.ts";
import type { ThemeDraft } from "@shared/research/qualitative/themes.ts";
import type { Descriptives } from "@shared/research/analytics/describe.ts";
import type { Finding } from "@shared/research/analytics/result.ts";
import type { Reference } from "@shared/research/reference.ts";
import { parseAll, parseFinding, parseReference } from "@shared/research/writeup/stored.ts";
import { supabase } from "@/lib/supabase.ts";

// Straight to Postgres through supabase-js, with no edge function in between,
// because row level security is doing the work — the same argument as
// detective-api.ts. The two exceptions go through RPCs, and both are there
// because the rule is a cross-table one that RLS has no good way to ask:
// `apply_code` checks a coding's offsets against the document it points into,
// and `set_coding_order` rewrites every position in one transaction.

export interface StudySummary {
  id: string;
  title: string;
  question: string | null;
  /** False once every coder can see every coder's codings. Never goes back. */
  blind_coding: boolean;
  owner_id: string;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  name: string;
  body: string;
  coding_position: number;
}

export interface StudyContents {
  documents: DocumentRow[];
  codes: Code[];
  codings: Coding[];
  drafts: ThemeDraft[];
}

export type Result<T> = { ok: true; data: T } | { ok: false; message: string };

/** Errors are values. A thrown one ends up in a catch that says "something went wrong". */
function wrap<T>(data: T | null, error: { message: string } | null): Result<T> {
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: (data ?? []) as T };
}

export async function listStudies(): Promise<Result<StudySummary[]>> {
  const { data, error } = await supabase()
    .from("studies")
    .select("id, title, question, blind_coding, owner_id, created_at")
    .order("created_at", { ascending: false });
  return wrap<StudySummary[]>(data, error);
}

export async function createStudy(
  title: string,
  question: string,
): Promise<Result<StudySummary>> {
  const { data: user } = await supabase().auth.getUser();
  const owner = user.user?.id;
  if (!owner) return { ok: false, message: "You are not signed in." };

  const { data, error } = await supabase()
    .from("studies")
    .insert({ owner_id: owner, title: title.trim(), question: question.trim() || null })
    .select("id, title, question, blind_coding, owner_id, created_at")
    .single();
  return wrap<StudySummary>(data, error);
}

/**
 * Everything in one study, in four round trips.
 *
 * Four rather than a join, because the shapes are genuinely different and a
 * single nested select would arrive as a tree that has to be flattened back
 * into the four flat lists the engine takes. The engine is the authority on
 * how these relate — `assembleThemes` is what decides whether a draft is a
 * theme — so the client's job is to hand it the rows, not to pre-digest them.
 */
export async function loadStudy(studyId: string): Promise<Result<StudyContents>> {
  const documents = await supabase()
    .from("study_documents")
    .select("id, name, body, coding_position")
    .eq("study_id", studyId)
    .order("coding_position", { ascending: true });
  if (documents.error) return { ok: false, message: documents.error.message };

  const codes = await supabase()
    .from("codes")
    .select("id, label, definition, apply_when, not_when, example, parent_id")
    .eq("study_id", studyId)
    .order("created_at", { ascending: true });
  if (codes.error) return { ok: false, message: codes.error.message };

  const codings = await supabase()
    .from("codings")
    .select("id, document_id, code_id, start_offset, end_offset, memo, coder_id")
    .eq("study_id", studyId)
    .order("start_offset", { ascending: true });
  if (codings.error) return { ok: false, message: codings.error.message };

  const drafts = await supabase()
    .from("theme_drafts")
    .select("id, label, statement, theme_draft_codes(code_id)")
    .eq("study_id", studyId)
    .order("created_at", { ascending: true });
  if (drafts.error) return { ok: false, message: drafts.error.message };

  return {
    ok: true,
    data: {
      documents: (documents.data ?? []) as DocumentRow[],
      // The column is `apply_when` because `when` is reserved in SQL, and the
      // engine's field is `when` because that is what it reads as in a
      // codebook. Renamed here, once, rather than in every component.
      codes: (codes.data ?? []).map((row) => ({
        id: row.id,
        label: row.label,
        definition: row.definition,
        when: row.apply_when,
        notWhen: row.not_when,
        example: row.example ?? undefined,
        parentId: row.parent_id,
      })),
      codings: (codings.data ?? []).map((row) => ({
        id: row.id,
        documentId: row.document_id,
        codeId: row.code_id,
        start: row.start_offset,
        end: row.end_offset,
        memo: row.memo,
        coderId: row.coder_id,
      })),
      drafts: (drafts.data ?? []).map((row) => ({
        id: row.id,
        label: row.label,
        statement: row.statement,
        codeIds: (row.theme_draft_codes ?? []).map((join) => join.code_id),
      })),
    },
  };
}

export interface FromPaper {
  /** The paper in this study's corpus the text was read out of. */
  sourceId: string;
  /** Where each page begins in `body`. See `research/corpus/flatten.ts`. */
  pageStarts: number[];
}

export async function addDocument(
  studyId: string,
  name: string,
  body: string,
  position: number,
  /**
   * Both fields or neither, which the check constraint also enforces. A
   * document claiming a paper it has no page map for cannot cite a page, and
   * a page map belonging to nothing is a map of somewhere else.
   */
  from?: FromPaper,
): Promise<Result<DocumentRow>> {
  const { data, error } = await supabase()
    .from("study_documents")
    .insert({
      study_id: studyId,
      name,
      body,
      coding_position: position,
      ...(from === undefined ? {} : { source_id: from.sourceId, page_starts: from.pageStarts }),
    })
    .select("id, name, body, coding_position")
    .single();
  return wrap<DocumentRow>(data, error);
}

export async function removeDocument(id: string): Promise<Result<null>> {
  const { error } = await supabase().from("study_documents").delete().eq("id", id);
  return wrap<null>(null, error);
}

export async function setCodingOrder(
  studyId: string,
  documentIds: readonly string[],
): Promise<Result<null>> {
  const { error } = await supabase().rpc("set_coding_order", {
    p_study: studyId,
    p_documents: documentIds,
  });
  return wrap<null>(null, error);
}

export async function addCode(studyId: string, code: Code): Promise<Result<Code>> {
  const { data, error } = await supabase()
    .from("codes")
    .insert({
      study_id: studyId,
      label: code.label,
      definition: code.definition,
      apply_when: code.when,
      not_when: code.notWhen,
      example: code.example ?? null,
      parent_id: code.parentId ?? null,
    })
    .select("id, label, definition, apply_when, not_when, example, parent_id")
    .single();
  if (error) return { ok: false, message: error.message };
  return {
    ok: true,
    data: {
      id: data.id,
      label: data.label,
      definition: data.definition,
      when: data.apply_when,
      notWhen: data.not_when,
      example: data.example ?? undefined,
      parentId: data.parent_id,
    },
  };
}

export async function removeCode(id: string): Promise<Result<null>> {
  const { error } = await supabase().from("codes").delete().eq("id", id);
  return wrap<null>(null, error);
}

/**
 * Apply a code to a passage.
 *
 * Through the RPC and not an insert, because the offsets have to be checked
 * against the document they point into and `codings` has no insert policy at
 * all. A coding whose offsets run past the end of its document is corruption
 * nothing downstream can detect: it slices a shorter string and shows a
 * plausible extract nobody said.
 */
export async function applyCoding(
  documentId: string,
  codeId: string,
  start: number,
  end: number,
  memo: string | null,
): Promise<Result<string>> {
  const { data, error } = await supabase().rpc("apply_code", {
    p_document: documentId,
    p_code: codeId,
    p_start: start,
    p_end: end,
    p_memo: memo,
  });
  return wrap<string>(data, error);
}

export async function removeCoding(id: string): Promise<Result<null>> {
  const { error } = await supabase().from("codings").delete().eq("id", id);
  return wrap<null>(null, error);
}

export async function addThemeDraft(
  studyId: string,
  draft: Omit<ThemeDraft, "id">,
): Promise<Result<ThemeDraft>> {
  const { data, error } = await supabase()
    .from("theme_drafts")
    .insert({ study_id: studyId, label: draft.label, statement: draft.statement })
    .select("id, label, statement")
    .single();
  if (error) return { ok: false, message: error.message };

  if (draft.codeIds.length > 0) {
    const join = await supabase()
      .from("theme_draft_codes")
      .insert(draft.codeIds.map((codeId) => ({ theme_id: data.id, code_id: codeId })));
    if (join.error) return { ok: false, message: join.error.message };
  }
  return {
    ok: true,
    data: { id: data.id, label: data.label, statement: data.statement, codeIds: [...draft.codeIds] },
  };
}

export async function removeThemeDraft(id: string): Promise<Result<null>> {
  const { error } = await supabase().from("theme_drafts").delete().eq("id", id);
  return wrap<null>(null, error);
}

export interface CoderRow {
  email: string;
  role: "coder" | "viewer";
  user_id: string | null;
  accepted_at: string | null;
}

export async function listCoders(studyId: string): Promise<Result<CoderRow[]>> {
  const { data, error } = await supabase()
    .from("study_coders")
    .select("email, role, user_id, accepted_at")
    .eq("study_id", studyId)
    .order("created_at", { ascending: true });
  return wrap<CoderRow[]>(data, error);
}

/**
 * Invite somebody to code a study.
 *
 * By address, and through an RPC, because resolving the address to an account
 * here would mean an endpoint that reports whether an account exists — and
 * anybody could then enumerate the instance's users by inviting addresses to a
 * study of their own. It also means a colleague who has not signed up yet can
 * be invited, which is the ordinary case.
 */
export async function inviteCoder(studyId: string, email: string): Promise<Result<null>> {
  const { error } = await supabase().rpc("invite_coder", {
    p_study: studyId,
    p_email: email,
    p_role: "coder",
  });
  return wrap<null>(null, error);
}

export async function removeCoder(studyId: string, email: string): Promise<Result<null>> {
  const { error } = await supabase()
    .from("study_coders")
    .delete()
    .eq("study_id", studyId)
    .eq("email", email.trim().toLowerCase());
  return wrap<null>(null, error);
}

/** True when there was an invitation to accept. */
export async function acceptInvitation(studyId: string): Promise<Result<boolean>> {
  const { data, error } = await supabase().rpc("accept_coder_invitation", { p_study: studyId });
  return wrap<boolean>(data, error);
}

/**
 * Show every coder's codings to every coder. One-way.
 *
 * This is the act that makes agreement computable and the point after which
 * nobody in the study is coding independently. The database refuses to undo
 * it, because a coder who has seen the other codings cannot be returned to not
 * having seen them — and a study that could flip back would let a methods
 * section say "coded independently" about coding that was not.
 */
export async function unblindStudy(studyId: string): Promise<Result<null>> {
  const { error } = await supabase().rpc("unblind_study", { p_study: studyId });
  return wrap<null>(null, error);
}

export interface Invitation {
  study_id: string;
  title: string;
  invited_by_email: string | null;
}

/**
 * Studies this person has been invited to and not yet accepted.
 *
 * An RPC rather than a select, because an unaccepted invitation grants no read
 * on `studies` — that is what makes it an invitation — so the invitee's own
 * row carries a study id and nothing they would recognise.
 */
export async function pendingInvitations(): Promise<Result<Invitation[]>> {
  const { data, error } = await supabase().rpc("pending_invitations");
  return wrap<Invitation[]>(data, error);
}

// --- What a write-up is assembled from -------------------------------------
//
// Three jsonb columns, and every read goes through the parsers in
// writeup/stored.ts. What does not parse is dropped and counted, never cast:
// a `Finding` admitted without checking would carry a p-value with no effect
// beside it, which is the one thing `result.ts` exists to make impossible.

export interface StoredFindings {
  findings: Finding[];
  descriptives: Array<{ label: string; stats: Descriptives }>;
  datasetName: string | null;
  /** Rows that did not parse. Surfaced, never swallowed. */
  dropped: number;
}

export async function loadMethodDeclaration(studyId: string): Promise<Result<unknown>> {
  const { data, error } = await supabase()
    .from("studies")
    .select("method_declaration")
    .eq("id", studyId)
    .single();
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: data.method_declaration };
}

export async function saveMethodDeclaration(
  studyId: string,
  declaration: unknown,
): Promise<Result<null>> {
  const { error } = await supabase()
    .from("studies")
    .update({ method_declaration: declaration })
    .eq("id", studyId);
  return wrap<null>(null, error);
}

export async function loadFindings(studyId: string): Promise<Result<StoredFindings>> {
  const { data, error } = await supabase()
    .from("study_findings")
    .select("finding, descriptives, dataset_name, position")
    .eq("study_id", studyId)
    .order("position", { ascending: true });
  if (error) return { ok: false, message: error.message };

  const rows = data ?? [];
  const parsed = parseAll(rows.map((row) => row.finding), parseFinding);
  // The descriptives and the file name come from the most recent row: they
  // describe the dataset, and every finding in a study was run on one.
  const last = rows[rows.length - 1];
  return {
    ok: true,
    data: {
      findings: parsed.items,
      descriptives: (last?.descriptives ?? []) as Array<{ label: string; stats: Descriptives }>,
      datasetName: last?.dataset_name ?? null,
      dropped: parsed.dropped,
    },
  };
}

export async function saveFinding(
  studyId: string,
  finding: Finding,
  descriptives: Array<{ label: string; stats: Descriptives }>,
  datasetName: string | null,
  position: number,
): Promise<Result<null>> {
  const { error } = await supabase().from("study_findings").insert({
    study_id: studyId,
    finding,
    descriptives,
    dataset_name: datasetName,
    position,
  });
  return wrap<null>(null, error);
}

export async function clearFindings(studyId: string): Promise<Result<null>> {
  const { error } = await supabase().from("study_findings").delete().eq("study_id", studyId);
  return wrap<null>(null, error);
}

export async function loadReferences(
  studyId: string,
): Promise<Result<{ references: Reference[]; dropped: number }>> {
  const { data, error } = await supabase()
    .from("study_references")
    .select("reference")
    .eq("study_id", studyId)
    .order("created_at", { ascending: true });
  if (error) return { ok: false, message: error.message };
  const parsed = parseAll((data ?? []).map((row) => row.reference), parseReference);
  return { ok: true, data: { references: parsed.items, dropped: parsed.dropped } };
}

export async function keepReference(
  studyId: string,
  reference: Reference,
): Promise<Result<null>> {
  const { error } = await supabase().from("study_references").insert({
    study_id: studyId,
    reference,
    doi: reference.doi ?? null,
    provider_id: reference.providerId ?? null,
  });
  // Adding the same work twice is not a failure worth a message. The unique
  // index is what stops it; the researcher clicked a button that was already
  // done, and telling them off for it teaches nothing.
  if (error && /duplicate key|unique constraint/i.test(error.message)) {
    return { ok: true, data: null };
  }
  return wrap<null>(null, error);
}

export async function dropReference(studyId: string, referenceId: string): Promise<Result<null>> {
  const { data, error } = await supabase()
    .from("study_references")
    .select("id, reference")
    .eq("study_id", studyId);
  if (error) return { ok: false, message: error.message };
  const row = (data ?? []).find((candidate) => {
    const reference = candidate.reference as { id?: unknown } | null;
    return reference !== null && reference.id === referenceId;
  });
  if (!row) return { ok: true, data: null };
  const removal = await supabase().from("study_references").delete().eq("id", row.id);
  return wrap<null>(null, removal.error);
}
