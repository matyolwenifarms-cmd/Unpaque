import Anthropic from "npm:@anthropic-ai/sdk@^0.120.0";
import { createClient } from "npm:@supabase/supabase-js@^2.47.10";
import {
  analyse,
  MAX_INPUT_CHARS,
  MIN_INPUT_CHARS,
  type ModelCaller,
} from "../_shared/diagnostic/analyse.ts";
import { TOOL_DESCRIPTION, TOOL_NAME } from "../_shared/diagnostic/prompt.ts";
import type { Mode } from "../_shared/diagnostic/report.ts";

// Everything in this file is the part that cannot be pure: environment,
// vendor SDK, HTTP, the database. The diagnostic itself lives in
// _shared/diagnostic and is tested from Node without any of it.

const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Per-caller analyses per window, and the window. */
const PER_CALLER = Number(Deno.env.get("ANALYSES_PER_CALLER") ?? 8);
const WINDOW = Deno.env.get("ANALYSIS_WINDOW") ?? "1 hour";
/** The number the operator is prepared to pay for in a day. */
const PER_DAY = Number(Deno.env.get("ANALYSES_PER_DAY") ?? 500);

// Opus 5 by default. This is the product — the whole of Unpaque's output
// quality is this call — so the model choice is deliberately not tuned down
// for cost here; it is an operator decision, made by setting the variable.
const MODEL = Deno.env.get("UNPAQUE_MODEL") ?? "claude-opus-5";

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, ...extra, "Content-Type": "application/json" },
  });
}

/**
 * A salted hash of the caller's address.
 *
 * The salt is required rather than defaulted: an unsalted hash of an IPv4
 * address is reversible by anyone willing to walk 4.3 billion candidates, so a
 * missing salt would leave a table that looks anonymised and is not.
 */
async function fingerprint(request: Request): Promise<string | null> {
  const salt = Deno.env.get("RATE_LIMIT_SALT");
  // The placeholder from .env.example is treated as absent. Copying that file
  // and forgetting to edit it is the likeliest way to end up with a salt that
  // is published in a public repository, which is the same as having none.
  if (!salt || salt === "REPLACE_ME" || salt.startsWith("local-development")) return null;
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const address = forwarded.split(",")[0]?.trim() || "unknown";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt}:${address}`),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { text?: unknown; mode?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const text = typeof body.text === "string" ? body.text : "";
  const mode: Mode = body.mode === "draft" ? "draft" : "decode";

  // The API key is checked before the rate limit is spent, so a
  // misconfigured deployment does not silently burn a visitor's allowance.
  //
  // Unpaque degrades to nothing here, and says so. Elsewhere an absent key
  // should fall back to something lesser; there is no lesser version of
  // rhetorical analysis, and a deterministic keyword pass dressed up as a
  // diagnostic would be exactly the tone-scoring the product exists not to be.
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey || /^(your-key|changeme|x+)$/i.test(apiKey)) {
    return json(
      {
        error: "engine_unavailable",
        message:
          "Unpaque cannot analyse anything right now: the analysis engine is not configured. Nothing you typed has been lost.",
      },
      503,
    );
  }

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

  const { data: slots, error: slotError } = await supabase.rpc("claim_analysis_slot", {
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
        message:
          slot?.reason === "daily_ceiling"
            ? "Unpaque has hit its analysis ceiling for today. This is a cap the operator set, not a fault."
            : "That is as many analyses as one visitor gets this hour.",
        retryAfterSeconds: retry,
      },
      429,
      { "Retry-After": String(retry) },
    );
  }

  const anthropic = new Anthropic({ apiKey });

  const callModel: ModelCaller = async ({ system, user, correction, toolSchema }) => {
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: user }];
    // A correction is a second user turn rather than a rewritten system prompt:
    // the system prompt is the cached prefix, and editing it to add a
    // correction would invalidate the cache on exactly the requests that are
    // already costing twice.
    if (correction) {
      messages.push({ role: "assistant", content: "(previous tool call)" });
      messages.push({ role: "user", content: correction });
    }

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages,
      output_config: { effort: "high" },
      tools: [
        {
          name: TOOL_NAME,
          description: TOOL_DESCRIPTION,
          strict: true,
          input_schema: toolSchema as Anthropic.Tool["input_schema"],
        },
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
    });

    const block = response.content.find((b) => b.type === "tool_use" && b.name === TOOL_NAME);
    return block && block.type === "tool_use" ? block.input : null;
  };

  try {
    const outcome = await analyse({ text, mode }, callModel);

    switch (outcome.status) {
      case "ok":
        return json({ report: outcome.report, repaired: outcome.repaired }, 200);
      case "too_short":
        return json(
          {
            error: "too_short",
            message: `Give Unpaque at least ${MIN_INPUT_CHARS} characters — there is not enough structure in less to report on honestly.`,
          },
          400,
        );
      case "too_long":
        return json(
          {
            error: "too_long",
            message: `Unpaque takes up to ${MAX_INPUT_CHARS.toLocaleString("en-GB")} characters of pasted text.`,
          },
          400,
        );
      case "refused":
        // Deliberately visible rather than silently retried into oblivion. The
        // boundary held; the user is told that it did.
        console.warn("boundary_violation", JSON.stringify(outcome.violations));
        return json(
          {
            error: "boundary",
            message:
              "Unpaque could not produce a report that stays inside its own limits on this text, so it is not showing you one. This is a refusal, not a crash.",
          },
          422,
        );
      case "malformed":
        console.error("malformed_payload", JSON.stringify(outcome.problems));
        return json({ error: "malformed", message: "The analysis came back in a shape Unpaque could not read." }, 502);
    }
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return json({ error: "upstream_rate_limited", message: "The analysis engine is busy. Try again shortly." }, 429);
    }
    if (error instanceof Anthropic.APIError) {
      console.error("anthropic_error", error.status, error.message);
      return json({ error: "upstream", message: "The analysis engine returned an error." }, 502);
    }
    console.error("unhandled", error);
    return json({ error: "unhandled" }, 500);
  }
});
