import { supabase } from "./supabase.ts";
import { EMPTY, type StudySnapshot } from "@shared/research/status/status.ts";

export type Result<T> = { ok: true; data: T } | { ok: false; message: string };

/**
 * Everything the status panel needs, counted.
 *
 * Every count is asked for at once. In sequence this is eleven round trips a
 * reader waits through one after another; in parallel it is one.
 */
export async function loadSnapshot(studyId: string): Promise<Result<StudySnapshot>> {
  const client = supabase();
  // `head: true` asks PostgREST for the count and no body, so the panel costs
  // a round trip per subsystem and no rows at all. A status panel that loads
  // the study in order to describe it is one nobody waits for.
  const rows = (table: string) =>
    client.from(table).select("id", { count: "exact", head: true }).eq("study_id", studyId);

  try {
    const [
      papers, scans, relations, screened, undecided, included,
      documents, codes, codings, themes, analyses, references, study,
    ] = await Promise.all([
      rows("study_sources"),
      rows("study_sources").eq("page_count", 0),
      rows("study_relations"),
      rows("study_screening"),
      rows("study_screening").in("state", ["identified", "assessed"]),
      rows("study_screening").eq("state", "included"),
      rows("study_documents"),
      rows("codes"),
      rows("codings"),
      rows("theme_drafts"),
      rows("study_findings"),
      rows("study_references"),
      client.from("studies").select("method_declaration").eq("id", studyId).single(),
    ]);

    const at = (result: { count: number | null }) => result.count ?? 0;

    return {
      ok: true,
      data: {
        ...EMPTY,
        papers: at(papers),
        papersWithoutText: at(scans),
        relations: at(relations),
        screened: at(screened),
        screeningUndecided: at(undecided),
        screeningIncluded: at(included),
        paradigmDeclared:
          (study.data as { method_declaration: unknown } | null)?.method_declaration != null,
        documents: at(documents),
        codes: at(codes),
        codings: at(codings),
        themes: at(themes),
        analyses: at(analyses),
        references: at(references),
      },
    };
  } catch (error) {
    // A panel that cannot count is a panel that says nothing, not one that
    // takes the page down with it. The stages are all still reachable.
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
