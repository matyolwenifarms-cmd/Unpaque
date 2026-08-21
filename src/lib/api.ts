import type { DiagnosticReport, Mode } from "@shared/diagnostic/report.ts";

export type AnalysisResponse =
  | { status: "ok"; report: DiagnosticReport; repaired: boolean }
  | { status: "error"; code: string; message: string; retryAfterSeconds?: number };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Errors are values here rather than thrown exceptions.
 *
 * Every failure this endpoint has is one a user needs a sentence about — over
 * the rate limit, past the paste ceiling, the boundary held and no report is
 * coming. Throwing them would push all of that into a catch block that ends up
 * rendering "Something went wrong", which is the least useful thing any of
 * these could say.
 */
export async function requestAnalysis(text: string, mode: Mode): Promise<AnalysisResponse> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      status: "error",
      code: "unconfigured",
      message:
        "Unpack is not connected to its analysis engine in this build. Nothing you typed has been sent anywhere.",
    };
  }

  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/analyse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ text, mode }),
    });
  } catch {
    return {
      status: "error",
      code: "offline",
      message: "Unpack could not reach the analysis engine. Check your connection and try again.",
    };
  }

  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  if (response.ok && body && "report" in body) {
    return {
      status: "ok",
      report: body.report as DiagnosticReport,
      repaired: body.repaired === true,
    };
  }

  return {
    status: "error",
    code: typeof body?.error === "string" ? body.error : String(response.status),
    message:
      typeof body?.message === "string"
        ? body.message
        : "The analysis engine returned an error Unpack could not interpret.",
    retryAfterSeconds:
      typeof body?.retryAfterSeconds === "number" ? body.retryAfterSeconds : undefined,
  };
}
