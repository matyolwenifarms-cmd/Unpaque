import { supabase } from "./supabase.ts";
import type { ScreenedRecord, ScreeningState } from "@shared/research/prisma/flow.ts";

export type Result<T> = { ok: true; data: T } | { ok: false; message: string };

export interface ScreeningRow extends ScreenedRecord {
  foundVia: string | null;
  doi: string | null;
}

export async function loadScreening(studyId: string): Promise<Result<ScreeningRow[]>> {
  const { data, error } = await supabase()
    .from("study_screening")
    .select("id, label, state, reason, found_via, doi, created_at")
    .eq("study_id", studyId)
    .order("created_at", { ascending: true });
  if (error) return { ok: false, message: error.message };
  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      id: row.id,
      label: row.label,
      state: row.state as ScreeningState,
      ...(row.reason === null ? {} : { reason: row.reason }),
      foundVia: row.found_via,
      doi: row.doi,
    })),
  };
}

/**
 * Add records to screen, one per line.
 *
 * Pasted rather than typed one at a time, because the input to this is a list
 * of two hundred titles exported from a database, and a form with an Add
 * button is a form nobody uses twice.
 */
export async function addToScreening(
  studyId: string,
  labels: readonly string[],
  foundVia: string,
): Promise<Result<number>> {
  const rows = labels
    .map((label) => label.trim())
    .filter((label) => label.length > 0)
    .map((label) => ({
      study_id: studyId,
      label: label.slice(0, 500),
      ...(foundVia.trim() === "" ? {} : { found_via: foundVia.trim().slice(0, 120) }),
    }));
  if (rows.length === 0) return { ok: true, data: 0 };

  const { error } = await supabase().from("study_screening").insert(rows);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: rows.length };
}

/**
 * Record a decision.
 *
 * `decided_at` travels with the state, because the check constraint refuses a
 * decision with no time and an undecided record with one. Sending the state
 * alone would be refused by the database — which is the right place for it
 * to be refused, and the wrong place for the client to find out.
 */
export async function decide(
  id: string,
  state: ScreeningState,
  reason?: string,
): Promise<Result<null>> {
  const { error } = await supabase()
    .from("study_screening")
    .update({
      state,
      decided_at: state === "identified" ? null : new Date().toISOString(),
      reason: state === "excluded_on_full_text" ? (reason ?? "").trim() || null : null,
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: null };
}

export async function dropScreened(id: string): Promise<Result<null>> {
  const { error } = await supabase().from("study_screening").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: null };
}
