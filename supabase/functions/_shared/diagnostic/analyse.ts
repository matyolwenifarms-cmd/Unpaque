import { guardReport, retryInstruction, type Violation } from "./guard.ts";
import { diagnosticToolSchema, parseReport, type DiagnosticReport, type Mode } from "./report.ts";
import { systemPrompt, userPrompt } from "./prompt.ts";

/**
 * Shortest text worth a report. Below this there is not enough structure to
 * say anything, and a confident four-section diagnostic of "thanks!" would be
 * the tool at its least honest.
 */
export const MIN_INPUT_CHARS = 40;

/**
 * Phase 1 is pasted text, not documents — Phase 4 is where uploads and
 * section-wise chunking arrive. The cap is here rather than only in the UI
 * because the UI is not what protects the bill.
 */
export const MAX_INPUT_CHARS = 12_000;

export interface ModelRequest {
  system: string;
  user: string;
  /** Present only on the retry, quoting what broke the boundary. */
  correction?: string;
  toolSchema: Record<string, unknown>;
}

/**
 * The one thing the pipeline cannot do for itself.
 *
 * Injected rather than imported so the whole diagnostic — validation, guard,
 * retry, outcome — is testable from Node with a fake model and no network, and
 * so moving from a synchronous request to a queued worker in Phase 4 changes
 * the transport around this function rather than the function itself.
 */
export type ModelCaller = (request: ModelRequest) => Promise<unknown>;

export type AnalysisOutcome =
  | { status: "ok"; report: DiagnosticReport; attempts: number; repaired: boolean }
  | { status: "too_short" | "too_long" }
  | { status: "malformed"; problems: string[]; attempts: number }
  | { status: "refused"; violations: Violation[]; attempts: number };

/**
 * Run the diagnostic, and refuse to return one that breaks the boundary.
 *
 * The model gets exactly one correction. A second failure returns `refused`
 * rather than a scrubbed report, because the alternative — stripping the
 * offending sentence and showing the rest — hands the user a report whose
 * reasoning has a hole in it that nothing on screen marks. An honest error is
 * worth more than a quietly edited diagnosis.
 */
export async function analyse(
  input: { text: string; mode: Mode },
  callModel: ModelCaller,
): Promise<AnalysisOutcome> {
  const text = input.text.trim();
  if (text.length < MIN_INPUT_CHARS) return { status: "too_short" };
  if (text.length > MAX_INPUT_CHARS) return { status: "too_long" };

  const base: ModelRequest = {
    system: systemPrompt(input.mode),
    user: userPrompt(text),
    toolSchema: diagnosticToolSchema(input.mode),
  };

  let attempts = 0;
  let correction: string | undefined;
  let lastProblems: string[] = [];
  let lastViolations: Violation[] = [];

  while (attempts < 2) {
    attempts += 1;
    const raw = await callModel(correction ? { ...base, correction } : base);

    const parsed = parseReport(raw, input.mode);
    if (!parsed.ok) {
      lastProblems = parsed.problems;
      correction = [
        "The previous response did not fit the required shape:",
        ...parsed.problems.map((p) => `- ${p}`),
        "",
        "Return the tool call again, corrected.",
      ].join("\n");
      continue;
    }

    const violations = guardReport(parsed.report);
    if (violations.length === 0) {
      return { status: "ok", report: parsed.report, attempts, repaired: attempts > 1 };
    }

    lastViolations = violations;
    lastProblems = [];
    correction = retryInstruction(violations);
  }

  if (lastViolations.length > 0) {
    return { status: "refused", violations: lastViolations, attempts };
  }
  return { status: "malformed", problems: lastProblems, attempts };
}
