import { describe, expect, it, vi } from "vitest";
import {
  analyse,
  MAX_INPUT_CHARS,
  MIN_INPUT_CHARS,
  type ModelCaller,
  type ModelRequest,
} from "./analyse.ts";
import { SECTION_IDS } from "./report.ts";

const LONG_ENOUGH = "We have reviewed the request and there is no capacity this quarter for it.";

// Annotations are offsets into the analysed text, so the fixture has to point
// into LONG_ENOUGH rather than carry a copy of a phrase.
const SPAN = "no capacity this quarter";
const SPAN_START = LONG_ENOUGH.indexOf(SPAN);

/**
 * A text of exactly `length` characters, made of words.
 *
 * The boundary tests used `"a".repeat(n)`, which is one very long word — and an
 * annotation into it can only ever land mid-word, which the parser refuses.
 * The limits being tested are about length, not about being unreadable, so the
 * fixture is words.
 */
function textOfLength(length: number): string {
  const filler = "words about a decision that nobody has been named for yet ";
  return filler.repeat(Math.ceil(length / filler.length)).slice(0, length).trimEnd().padEnd(length, "x");
}

function goodPayload(claim = "The refusal is carried by a statement of constraint.") {
  return {
    verdict: "The message declines a request by reporting a constraint.",
    annotations: [{
      start: SPAN_START,
      end: SPAN_START + SPAN.length,
      device: "agentless_framing",
      framework: "critical_discourse",
      aspect: "responsibility",
      note: "The constraint is reported as a fact of the quarter rather than as a decision anyone took.",
    }],
    sections: SECTION_IDS.map((id) => ({
      id,
      summary: "A structural summary of the text.",
      findings: [{ framework: "speech_act", claim, quotes: ["no capacity this quarter"] }],
    })),
  };
}

describe("input limits", () => {
  it("refuses text too short to have structure worth reporting", async () => {
    const call = vi.fn<(request: ModelRequest) => Promise<unknown>>();
    const outcome = await analyse({ text: "thanks!", mode: "decode" }, call as ModelCaller);
    expect(outcome.status).toBe("too_short");
    // The important half: no model call, so a one-word paste costs nothing.
    expect(call).not.toHaveBeenCalled();
  });

  it("refuses text past the paste ceiling without calling the model", async () => {
    const call = vi.fn<(request: ModelRequest) => Promise<unknown>>();
    const outcome = await analyse(
      { text: "a".repeat(MAX_INPUT_CHARS + 1), mode: "decode" },
      call as ModelCaller,
    );
    expect(outcome.status).toBe("too_long");
    expect(call).not.toHaveBeenCalled();
  });

  it("accepts text at the boundaries", async () => {
    // The payload's annotation has to point into the text actually analysed,
    // so each boundary gets a payload built against its own text.
    for (const length of [MIN_INPUT_CHARS, MAX_INPUT_CHARS]) {
      const text = textOfLength(length);
      const first = text.indexOf(" ");
      const call: ModelCaller = async () => ({
        ...goodPayload(),
        annotations: [{
          start: 0,
          end: first,
          device: "agentless_framing",
          framework: "critical_discourse",
          aspect: "responsibility",
          note: "A note about the opening.",
        }],
      });
      expect((await analyse({ text, mode: "decode" }, call)).status).toBe("ok");
    }
  });
});

describe("the happy path", () => {
  it("returns a report in one attempt and says it was not repaired", async () => {
    const call: ModelCaller = async () => goodPayload();
    const outcome = await analyse({ text: LONG_ENOUGH, mode: "decode" }, call);
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.attempts).toBe(1);
    expect(outcome.repaired).toBe(false);
    expect(outcome.report.sections).toHaveLength(4);
  });

  it("sends no correction on the first attempt", async () => {
    const call = vi.fn(async (_request: ModelRequest) => goodPayload());
    await analyse({ text: LONG_ENOUGH, mode: "decode" }, call as unknown as ModelCaller);
    expect(call.mock.calls[0]?.[0]).not.toHaveProperty("correction");
  });
});

describe("repairing a boundary violation", () => {
  it("corrects once, quoting the offending span, and accepts the repair", async () => {
    const responses = [
      goodPayload("Your manager will feel undermined by the second paragraph."),
      goodPayload("The second paragraph names no actor in the responsibility clause."),
    ];
    const seen: Array<string | undefined> = [];
    const call: ModelCaller = async (request) => {
      seen.push(request.correction);
      return responses.shift();
    };

    const outcome = await analyse({ text: LONG_ENOUGH, mode: "decode" }, call);
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.attempts).toBe(2);
    expect(outcome.repaired).toBe(true);
    expect(seen[0]).toBeUndefined();
    expect(seen[1]).toContain("will feel");
  });

  it("refuses rather than returning a scrubbed report when the repair also breaks it", async () => {
    const call: ModelCaller = async () => goodPayload("This is manipulative framing.");
    const outcome = await analyse({ text: LONG_ENOUGH, mode: "decode" }, call);
    expect(outcome.status).toBe("refused");
    if (outcome.status !== "refused") return;
    expect(outcome.attempts).toBe(2);
    expect(outcome.violations[0]?.ruleId).toBe("manipulation");
  });

  it("never lets a violating claim out, whatever the model insists", async () => {
    const call: ModelCaller = async () => goodPayload("The writer intends to close the discussion.");
    const outcome = await analyse({ text: LONG_ENOUGH, mode: "decode" }, call);
    expect(outcome.status).not.toBe("ok");
  });
});

describe("repairing a malformed payload", () => {
  it("tells the model what was wrong and accepts a corrected shape", async () => {
    const responses: unknown[] = [
      { sections: [{ id: "act", summary: "s", findings: [] }] },
      goodPayload(),
    ];
    const seen: Array<string | undefined> = [];
    const call: ModelCaller = async (request) => {
      seen.push(request.correction);
      return responses.shift();
    };
    const outcome = await analyse({ text: LONG_ENOUGH, mode: "decode" }, call);
    expect(outcome.status).toBe("ok");
    expect(seen[1]).toContain("is missing");
  });

  it("gives up as malformed rather than as refused when the shape never arrives", async () => {
    const call: ModelCaller = async () => ({ nonsense: true });
    const outcome = await analyse({ text: LONG_ENOUGH, mode: "decode" }, call);
    expect(outcome.status).toBe("malformed");
  });
});

describe("draft mode", () => {
  it("carries the rewrite through", async () => {
    const call: ModelCaller = async () => ({
      ...goodPayload(),
      rewrite: { text: "A clearer version.", note: "The request is stated once, up front." },
    });
    const outcome = await analyse({ text: LONG_ENOUGH, mode: "draft" }, call);
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.report.rewrite?.text).toBe("A clearer version.");
  });

  it("asks the model for a rewrite only in draft mode", async () => {
    const call = vi.fn(async (_request: ModelRequest) => goodPayload());
    await analyse({ text: LONG_ENOUGH, mode: "decode" }, call as unknown as ModelCaller);
    const schema = JSON.stringify(call.mock.calls[0]?.[0]?.toolSchema ?? {});
    expect(schema).not.toContain("rewrite");
  });
});

// Offsets index the trimmed text, so the trimmed text has to come back with
// them. Without this the browser renders highlights against what was typed and
// every one of them shifts by however much whitespace was removed — invisibly,
// because the thing that moved them cannot be seen.
describe("the text the offsets belong to", () => {
  it("comes back with the report", async () => {
    const call: ModelCaller = async () => goodPayload();
    const outcome = await analyse({ text: LONG_ENOUGH, mode: "decode" }, call);
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.source).toBe(LONG_ENOUGH);
  });

  it("is the trimmed copy, not what was handed in", async () => {
    const padded = `\n\n   ${LONG_ENOUGH}   \n`;
    const call: ModelCaller = async () => goodPayload();
    const outcome = await analyse({ text: padded, mode: "decode" }, call);
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.source).toBe(LONG_ENOUGH);
    // The span still lands on the phrase it names, which is the whole point.
    const [first] = outcome.report.annotations;
    expect(outcome.source.slice(first!.start, first!.end)).toBe(SPAN);
    // And would not, against the untrimmed input.
    expect(padded.slice(first!.start, first!.end)).not.toBe(SPAN);
  });
});
