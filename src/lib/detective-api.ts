import type { EpistemicStatus } from "@shared/detective/epistemic.ts";
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

export async function listSources(caseId: string): Promise<Result<SourceRow[]>> {
  const { data, error } = await supabase()
    .from("sources")
    .select("id, kind, title, retrieved_from, retrieved_at")
    .eq("case_id", caseId)
    .order("retrieved_at", { ascending: false });
  return wrap<SourceRow[]>(data as SourceRow[] | null, error);
}
