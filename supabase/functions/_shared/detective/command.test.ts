import { describe, expect, it } from "vitest";
import { interpret, spokenNumber, type Command } from "./command.ts";

const commandOf = (phrase: string): Command => {
  const outcome = interpret(phrase);
  if (outcome.kind !== "command") throw new Error(`refused: ${outcome.says}`);
  return outcome.command;
};

const refusalOf = (phrase: string) => {
  const outcome = interpret(phrase);
  if (outcome.kind === "command") throw new Error(`understood as ${outcome.command.kind}`);
  return outcome;
};

describe("numbers, spoken and written", () => {
  it("reads a spoken number", () => {
    expect(spokenNumber("fourteen")).toBe(14);
    expect(spokenNumber("forty two")).toBe(42);
    expect(spokenNumber("forty-two")).toBe(42);
    expect(spokenNumber("ninety nine")).toBe(99);
  });

  it("reads digits, which is how anybody says a large one aloud", () => {
    expect(spokenNumber("14")).toBe(14);
    expect(spokenNumber("231")).toBe(231);
  });

  it("refuses what is not a number rather than guessing at one", () => {
    expect(spokenNumber("fourteenish")).toBeNull();
    expect(spokenNumber("the first one")).toBeNull();
    expect(spokenNumber("forty hundred")).toBeNull();
    expect(spokenNumber("")).toBeNull();
  });
});

describe("navigating the case file", () => {
  it("opens a source by number", () => {
    expect(commandOf("open source fourteen")).toEqual({ kind: "open_source", reference: 14 });
    expect(commandOf("show source 3")).toEqual({ kind: "open_source", reference: 3 });
    expect(commandOf("bring up the source twenty one")).toEqual({ kind: "open_source", reference: 21 });
  });

  it("compares two", () => {
    expect(commandOf("compare sources three and nine"))
      .toEqual({ kind: "compare_sources", first: 3, second: 9 });
  });

  it("moves between panels", () => {
    expect(commandOf("show the claims")).toEqual({ kind: "show_panel", panel: "claims" });
    expect(commandOf("build the timeline")).toEqual({ kind: "show_panel", panel: "timeline" });
    expect(commandOf("go back to the timeline")).toEqual({ kind: "show_panel", panel: "timeline" });
    expect(commandOf("what are the competing theories"))
      .toEqual({ kind: "show_panel", panel: "explanations" });
  });

  // "show source fourteen" must not be caught by the panel rule for "source".
  it("prefers the specific command over the panel it mentions", () => {
    expect(commandOf("show source fourteen")).toEqual({ kind: "open_source", reference: 14 });
    expect(commandOf("show the sources")).toEqual({ kind: "show_panel", panel: "sources" });
  });

  it("asks what remains unknown", () => {
    expect(commandOf("what remains unknown")).toEqual({ kind: "what_is_unknown" });
    expect(commandOf("what don't we know")).toEqual({ kind: "what_is_unknown" });
  });

  it("stops", () => {
    expect(commandOf("stop")).toEqual({ kind: "stop" });
    expect(commandOf("pause")).toEqual({ kind: "stop" });
  });

  it("hears through the filler a spoken command arrives wrapped in", () => {
    expect(commandOf("Detective, please show the timeline."))
      .toEqual({ kind: "show_panel", panel: "timeline" });
    expect(commandOf("Could you open source fourteen"))
      .toEqual({ kind: "open_source", reference: 14 });
  });
});

// The commonest failure of a voice interface is not mishearing. It is
// mishearing and acting anyway, leaving the operator to work out from the
// screen what it thought they said.
describe("refusing rather than guessing", () => {
  it("refuses an unrecognised phrase and shows what it heard", () => {
    const refusal = refusalOf("who do you think did it");
    expect(refusal.kind).toBe("not_understood");
    expect(refusal.heard).toBe("who do you think did it");
    expect(refusal.says).toMatch(/does not answer questions in its own words/);
  });

  it("refuses a source command with no number in it", () => {
    const refusal = refusalOf("open source the first one");
    expect(refusal.says).toMatch(/No source number was recognised/);
    expect(refusal.says).toMatch(/open source fourteen/);
  });

  it("refuses a comparison of a source with itself", () => {
    expect(refusalOf("compare sources four and four").says)
      .toMatch(/Two different source numbers are needed/);
  });

  it("refuses silence", () => {
    expect(refusalOf("   ").says).toBe("Nothing was heard.");
  });
});

// A command that silently does nothing reads as a mishearing, and the operator
// says it again, louder.
describe("commands for things that are not built", () => {
  it("says there is nothing to play, rather than ignoring it", () => {
    const refusal = refusalOf("play from one forty two");
    expect(refusal.kind).toBe("not_built");
    expect(refusal.says).toMatch(/no media to play/);
    expect(refusal.says).toMatch(/not built/);
  });

  it("says there are no transcripts", () => {
    expect(refusalOf("show the transcript").says).toMatch(/no transcripts/);
  });

  it("says there is no media", () => {
    const refusal = refusalOf("show the photograph");
    expect(refusal.kind).toBe("not_built");
    expect(refusal.says).toMatch(/Sources are records, not files/);
  });

  // Every one of these is in §24's own list of natural commands.
  it("answers every specified media command with a reason rather than silence", () => {
    for (const phrase of ["play the relevant section", "show me the testimony video", "rewind"]) {
      expect(refusalOf(phrase).kind).toBe("not_built");
    }
  });
});

describe("what it will never do", () => {
  it("has no command that produces a sentence nobody wrote", () => {
    const kinds = [
      "show the claims", "open source one", "compare sources one and two",
      "what remains unknown", "stop",
    ].map((phrase) => commandOf(phrase).kind);
    expect(kinds).not.toContain("answer");
    expect(kinds).not.toContain("summarise");
    expect(kinds.every((kind) => kind !== undefined)).toBe(true);
  });

  it("refuses a question however it is phrased", () => {
    for (const question of [
      "was the driver lying",
      "summarise the case",
      "tell me what you think",
    ]) {
      expect(interpret(question).kind).not.toBe("command");
    }
  });
});
