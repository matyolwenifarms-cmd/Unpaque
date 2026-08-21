import type { MergedReference } from "@shared/research/merge.ts";

export interface SearchedReference extends MergedReference {
  /** What a reader must be told first about citing this at all. */
  caveat: string | null;
  /** What they must be told about quoting from it. */
  quotationCaveat: string | null;
}

export type SearchResponse =
  | { status: "ok"; references: SearchedReference[]; reportedTotal: number; notes: string[] }
  | { status: "error"; code: string; message: string; retryAfterSeconds?: number };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export async function searchReferences(query: string, fromYear?: number): Promise<SearchResponse> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      status: "error",
      code: "unconfigured",
      message: "The Researcher is not connected to its search service in this build.",
    };
  }

  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/research-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(fromYear === undefined ? { query } : { query, fromYear }),
    });
  } catch {
    return { status: "error", code: "offline", message: "Could not reach the search service." };
  }

  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (response.ok && body && Array.isArray(body.references)) {
    return {
      status: "ok",
      references: body.references as SearchedReference[],
      reportedTotal: typeof body.reportedTotal === "number" ? body.reportedTotal : 0,
      notes: Array.isArray(body.notes) ? (body.notes as string[]) : [],
    };
  }

  return {
    status: "error",
    code: typeof body?.error === "string" ? body.error : String(response.status),
    message: typeof body?.message === "string" ? body.message : "The search returned an error.",
    retryAfterSeconds: typeof body?.retryAfterSeconds === "number" ? body.retryAfterSeconds : undefined,
  };
}
