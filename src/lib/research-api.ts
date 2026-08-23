import type { MergedReference } from "@shared/research/merge.ts";
import type { DoiCheck } from "@shared/research/proposal/supervise.ts";

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

export type ResultOrder = "relevance" | "recency";

export async function searchReferences(
  query: string,
  fromYear?: number,
  order: ResultOrder = "relevance",
): Promise<SearchResponse> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      status: "error",
      code: "unconfigured",
      message: "This build is not connected to the literature search service.",
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
      body: JSON.stringify({
        query,
        ...(fromYear === undefined ? {} : { fromYear }),
        ...(order === "relevance" ? {} : { order }),
      }),
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

export type CheckResponse =
  | { status: "ok"; checks: DoiCheck[]; total: number }
  | { status: "error"; code: string; message: string };

/**
 * Check a proposal's identifiers at their registration agency, in one call.
 *
 * One request for the whole list, not one per DOI. The endpoint is metered per
 * request, and a forty-reference proposal checked one at a time would spend a
 * student's entire hourly allowance on a single upload and then tell them to
 * come back in an hour.
 *
 * An error here is not a finding. It comes back as `error` and the caller
 * renders the report without the identifier section, rather than turning an
 * unreachable service into a sentence about somebody's references.
 */
export async function checkDois(dois: readonly string[]): Promise<CheckResponse> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      status: "error",
      code: "unconfigured",
      message: "This build is not connected to the reference-checking service.",
    };
  }
  if (dois.length === 0) return { status: "ok", checks: [], total: 0 };

  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/research-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ dois }),
    });
  } catch {
    return { status: "error", code: "offline", message: "Could not reach the checking service." };
  }

  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (response.ok && body && Array.isArray(body.checks)) {
    return {
      status: "ok",
      checks: body.checks as DoiCheck[],
      total: typeof body.total === "number" ? body.total : (body.checks as DoiCheck[]).length,
    };
  }

  return {
    status: "error",
    code: typeof body?.error === "string" ? body.error : String(response.status),
    message: typeof body?.message === "string" ? body.message : "The check returned an error.",
  };
}
