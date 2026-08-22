import { createClient } from "npm:@supabase/supabase-js@^2.47.10";
import { crossref } from "../_shared/research/providers/crossref.ts";
import { openAlex } from "../_shared/research/providers/openalex.ts";
import type { Fetcher } from "../_shared/research/providers/types.ts";
import { leadingCaveat, quotationCaveat } from "../_shared/research/reference.ts";
import { searchLiterature } from "../_shared/research/search.ts";

// Literature search. Notably, there is no model in this file and no vendor
// key: OpenAlex and Crossref are free public services, so this endpoint costs
// nothing to run beyond the function invocation itself.
//
// It is still metered. The limits here are about being a decent citizen of two
// free APIs and about abuse, not about spend — which is exactly why they live
// under their own purpose and cannot exhaust the analysis budget.

const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PER_CALLER = Number(Deno.env.get("SEARCHES_PER_CALLER") ?? 30);
const WINDOW = Deno.env.get("SEARCH_WINDOW") ?? "1 hour";
const PER_DAY = Number(Deno.env.get("SEARCHES_PER_DAY") ?? 2000);

/**
 * Both APIs ask callers to identify themselves for the faster pool. It is a
 * request rather than authentication and there is nothing secret about it, but
 * it is still somebody's address, so it is configured rather than hard-coded.
 */
const CONTACT = Deno.env.get("RESEARCH_CONTACT_EMAIL");

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, ...extra, "Content-Type": "application/json" },
  });
}

async function fingerprint(request: Request): Promise<string | null> {
  const salt = Deno.env.get("RATE_LIMIT_SALT");
  if (!salt || salt === "REPLACE_ME" || salt.startsWith("local-development")) return null;
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const address = forwarded.split(",")[0]?.trim() || "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${address}`));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { query?: unknown; fromYear?: unknown; order?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (query.length < 3) {
    return json({ error: "too_short", message: "Give at least three characters to search on." }, 400);
  }
  const fromYear = typeof body.fromYear === "number" && Number.isInteger(body.fromYear)
    ? body.fromYear
    : undefined;
  // Anything the client did not explicitly ask to be date-ordered is ordered by
  // relevance. An unrecognised value falls through to relevance rather than
  // being refused: the ordering is a preference, and a 400 over a typo would
  // cost somebody their search for no gain.
  const order = body.order === "recency" ? "recency" as const : "relevance" as const;

  const caller = await fingerprint(request);
  if (!caller) {
    return json(
      { error: "misconfigured", message: "RATE_LIMIT_SALT is not set; refusing to serve unmetered." },
      503,
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const { data: slots, error: slotError } = await supabase.rpc("claim_quota_slot", {
    p_purpose: "research",
    p_fingerprint: caller,
    p_per_caller: PER_CALLER,
    p_per_day: PER_DAY,
    p_window: WINDOW,
  });
  if (slotError) return json({ error: "quota_unavailable", message: slotError.message }, 503);

  const slot = Array.isArray(slots) ? slots[0] : slots;
  if (!slot?.allowed) {
    const retry = Number(slot?.retry_after_seconds ?? 60);
    return json(
      {
        error: slot?.reason === "daily_ceiling" ? "daily_ceiling" : "rate_limited",
        message: slot?.reason === "daily_ceiling"
          ? "Unpaque has hit its search ceiling for today. This is a cap the operator set, not a fault."
          : "That is as many searches as one visitor gets this hour.",
        retryAfterSeconds: retry,
      },
      429,
      { "Retry-After": String(retry) },
    );
  }

  const fetcher: Fetcher = (url, init) => fetch(url, init);
  const options = CONTACT ? { contactEmail: CONTACT } : {};
  const registry = crossref(options);

  try {
    const result = await searchLiterature(
      { text: query, fromYear, perPage: 25, order },
      {
        providers: [openAlex(options), registry],
        fetcher,
        resolve: (doi) => registry.resolve(doi, fetcher),
        concurrency: 4,
      },
    );

    // The caveats are computed here rather than in the browser so that every
    // surface which ever shows a reference gets the same sentences. A caveat
    // that only appears in one client is a caveat that will be missing from
    // the next one somebody builds.
    return json(
      {
        references: result.references.map((reference) => ({
          ...reference,
          caveat: leadingCaveat(reference),
          quotationCaveat: quotationCaveat(reference),
        })),
        reportedTotal: result.reportedTotal,
        notes: result.notes,
      },
      200,
    );
  } catch (error) {
    console.error("search_failed", error);
    return json({ error: "search_failed", message: "The search could not be completed." }, 502);
  }
});
