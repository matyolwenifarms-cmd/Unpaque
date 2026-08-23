import { supabase } from "./supabase.ts";
import type { Page } from "@shared/ingest/extract.ts";
import type { FileKind } from "@shared/ingest/kind.ts";
import type { StudyRelation } from "@shared/relations/corpus.ts";

export type Result<T> = { ok: true; data: T } | { ok: false; message: string };

/**
 * The kinds a corpus stores.
 *
 * Narrower than `FileKind`, which distinguishes a spreadsheet from a
 * presentation because Detect's portal has to say what it could not read.
 * Once text has been extracted the distinction that survives is how it was
 * extracted, and everything that is not a PDF, a Word file or plain text
 * reached here some other way.
 */
export type SourceKind = "pdf" | "word" | "text" | "other";

export function sourceKindOf(kind: FileKind): SourceKind {
  if (kind === "pdf" || kind === "word" || kind === "text") return kind;
  return "other";
}

export interface CorpusSource {
  id: string;
  name: string;
  kind: SourceKind;
  doi: string | null;
  pageCount: number;
  addedAt: string;
}

export interface Relation {
  id: string;
  relation: StudyRelation;
  sourceId: string;
  targetId: string;
  basis: string;
  createdAt: string;
}

export interface NewSource {
  name: string;
  kind: SourceKind;
  doi?: string;
  contentHash: string;
  pages: readonly Page[];
}

/**
 * Add a paper to a study, with its pages.
 *
 * Two statements rather than one, and the failure between them is worth
 * stating: if the pages fail after the source row lands, the study holds a
 * paper reporting a page count it cannot show. So the count is written from
 * what actually inserted, and a partial failure deletes the source rather
 * than leaving it — there is no transaction available over PostgREST, and
 * a source with no pages is indistinguishable from a scan.
 */
export async function addSource(
  studyId: string,
  source: NewSource,
): Promise<Result<string | null>> {
  const { data, error } = await supabase()
    .from("study_sources")
    .insert({
      study_id: studyId,
      name: source.name,
      kind: source.kind,
      doi: source.doi ?? null,
      content_hash: source.contentHash,
      page_count: source.pages.length,
    })
    .select("id")
    .single();

  // The same file twice is the same paper. The unique index is what refuses
  // it; the researcher dropped a folder that happened to contain it again,
  // and telling them off for that teaches nothing.
  if (error && /duplicate key|unique constraint/i.test(error.message)) {
    return { ok: true, data: null };
  }
  if (error) return { ok: false, message: error.message };

  const id = (data as { id: string }).id;
  if (source.pages.length === 0) return { ok: true, data: id };

  const { error: pageError } = await supabase()
    .from("study_source_pages")
    .insert(source.pages.map((page) => ({
      study_id: studyId,
      source_id: id,
      page_number: page.number,
      body: page.body,
    })));

  if (pageError) {
    await supabase().from("study_sources").delete().eq("id", id);
    return { ok: false, message: pageError.message };
  }

  return { ok: true, data: id };
}

export async function loadSources(studyId: string): Promise<Result<CorpusSource[]>> {
  const { data, error } = await supabase()
    .from("study_sources")
    .select("id, name, kind, doi, page_count, added_at")
    .eq("study_id", studyId)
    .order("added_at", { ascending: false });
  if (error) return { ok: false, message: error.message };
  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind as SourceKind,
      doi: row.doi,
      pageCount: row.page_count,
      addedAt: row.added_at,
    })),
  };
}

export async function loadPages(sourceId: string): Promise<Result<Page[]>> {
  const { data, error } = await supabase()
    .from("study_source_pages")
    .select("page_number, body")
    .eq("source_id", sourceId)
    .order("page_number", { ascending: true });
  if (error) return { ok: false, message: error.message };
  return {
    ok: true,
    data: (data ?? []).map((row) => ({ number: row.page_number, body: row.body })),
  };
}

export async function dropSource(sourceId: string): Promise<Result<null>> {
  const { error } = await supabase().from("study_sources").delete().eq("id", sourceId);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: null };
}

export async function loadRelations(studyId: string): Promise<Result<Relation[]>> {
  const { data, error } = await supabase()
    .from("study_relations")
    .select("id, relation, source_id, target_id, basis, created_at")
    .eq("study_id", studyId)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, message: error.message };
  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      id: row.id,
      relation: row.relation as StudyRelation,
      sourceId: row.source_id,
      targetId: row.target_id,
      basis: row.basis,
      createdAt: row.created_at,
    })),
  };
}

export async function addRelation(
  studyId: string,
  relation: { relation: StudyRelation; sourceId: string; targetId: string; basis: string },
): Promise<Result<null>> {
  const { error } = await supabase().from("study_relations").insert({
    study_id: studyId,
    relation: relation.relation,
    source_id: relation.sourceId,
    target_id: relation.targetId,
    basis: relation.basis,
  });
  // Unlike a duplicate reference, this one is worth saying. The reviewer has
  // written a reason and pressed a button; silently discarding it looks
  // exactly like it worked, and they will not find out until the reason they
  // wrote is missing from the review.
  if (error && /duplicate key|unique constraint/i.test(error.message)) {
    return { ok: false, message: "That relation is already recorded, in that direction." };
  }
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: null };
}

export async function dropRelation(id: string): Promise<Result<null>> {
  const { error } = await supabase().from("study_relations").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: null };
}
