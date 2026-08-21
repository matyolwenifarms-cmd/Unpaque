import { describe, expect, it } from "vitest";
import {
  GUARD_RULES,
  guardReport,
  guardedFields,
  inspect,
  retryInstruction,
} from "./guard.ts";
import type { DiagnosticReport } from "./report.ts";

function report(overrides: Partial<DiagnosticReport> = {}): DiagnosticReport {
  return {
    mode: "decode",
    sections: [
      {
        id: "act",
        summary: "The message is shaped as an update and works as a refusal.",
        findings: [
          {
            framework: "speech_act",
            claim: "The refusal is performed by a statement of constraint rather than by a decline.",
            quotes: ["there is no capacity this quarter"],
          },
        ],
      },
      {
        id: "responsibility",
        summary: "Causation is placed in process rather than in any actor.",
        findings: [
          {
            framework: "attribution",
            claim: "Responsibility lies with an unnamed review, which no clause assigns to a person.",
            quotes: ["following a review"],
          },
        ],
      },
      { id: "framing", summary: "Cost is foregrounded; the original commitment is absent.", findings: [] },
      { id: "ambiguity", summary: "The timeline is unquantified.", findings: [] },
    ],
    ...overrides,
  };
}

describe("the guard passes clean structural prose", () => {
  it("accepts a report that describes the text rather than a mind", () => {
    expect(guardReport(report())).toEqual([]);
  });

  // Rule 7 of the house style: a check that cannot fail is not evidence. These
  // are the negative controls — the framework vocabulary must survive, or the
  // guard has made Unpaque mute rather than careful.
  it.each([
    ["evasion of responsibility, in Benoit's sense", "evasion of responsibility is the strategy in play"],
    ["denial as a named strategy", "the opening clause is a denial of the premise"],
    ["minimisation", "the harm is minimised by quantifying it as a percentage"],
    ["shifting the blame", "blame is shifted onto a supplier"],
    ["face-threatening acts", "the request is a face-threatening act, softened by two hedges"],
    ["passive agency", "passive agency removes the actor from the responsibility clause"],
    ["nominalisation", "nominalisation turns the decision into an event"],
    ["responsibility lies with", "responsibility lies with the department, not an individual"],
    ["mortification", "the final paragraph is mortification: responsibility is accepted outright"],
    ["strategic ambiguity named as a form", "the commitment is left unquantified — strategic ambiguity"],
    ["what a reader would need to know", "the reader would have to already know the earlier figure to notice the gap"],
  ])("does not trip on %s", (_label, text) => {
    expect(inspect(text, "test")).toEqual([]);
  });
});

describe("the guard refuses claims about a mind", () => {
  it.each([
    ["your manager will feel undermined by the second paragraph", "modal-internal-state"],
    ["the recipient would conclude that the deadline has moved", "modal-internal-state"],
    ["this could feel abrupt", "modal-internal-state"],
    ["the phrasing makes the reader feel responsible", "makes-feel"],
    ["the apology comes across as grudging", "comes-across"],
    ["the reader's impression is one of delay", "reader-reaction-noun"],
    ["it leaves the reader without a date", "leaves-the-reader"],
  ])("refuses %s", (text, ruleId) => {
    const violations = inspect(text, "f");
    expect(violations.map((v) => v.ruleId)).toContain(ruleId);
    expect(violations[0]?.kind).toBe("reader_state");
  });
});

describe("the guard refuses verdicts", () => {
  it.each([
    ["the account given is dishonest", "honesty-verdict"],
    ["this is a lie about the timeline", "lying"],
    ["the structure is manipulative", "manipulation"],
    ["this is gaslighting", "gaslighting"],
    ["the response is made in bad faith", "bad-faith"],
    ["a cynical use of the review process", "moral-verdict"],
    ["a hollow apology follows", "sincerity-verdict"],
  ])("refuses %s", (text, ruleId) => {
    expect(inspect(text, "f").map((v) => v.ruleId)).toContain(ruleId);
  });
});

describe("the guard refuses attributed intent", () => {
  it.each([
    ["the writer intends to close the discussion", "author-intent"],
    ["the date is deliberately left open", "intent-adverb"],
    ["the clause is intentionally broad", "intent-adverb"],
  ])("refuses %s", (text, ruleId) => {
    expect(inspect(text, "f").map((v) => v.ruleId)).toContain(ruleId);
  });
});

describe("what the guard is pointed at", () => {
  it("never scans quotes, so a source containing banned words can still be evidenced", () => {
    const r = report();
    r.sections[0]!.findings[0]!.quotes = [
      "you are being manipulative and dishonest",
      "stop gaslighting me",
    ];
    expect(guardReport(r)).toEqual([]);
  });

  it("never scans the rewrite itself — a user is entitled to a blunt draft", () => {
    const r = report({
      mode: "draft",
      rewrite: {
        text: "I think the account given is misleading, and I want the original date honoured.",
        note: "The request is stated once and the constraint is named without hedging.",
      },
    });
    expect(guardReport(r)).toEqual([]);
  });

  it("does scan the note that explains the rewrite", () => {
    const r = report({
      mode: "draft",
      rewrite: { text: "Fine as it is.", note: "Your manager will feel less attacked by this." },
    });
    expect(guardReport(r).map((v) => v.field)).toContain("rewrite.note");
  });

  it("lists every field it is responsible for, and no others", () => {
    const r = report({
      mode: "draft",
      rewrite: { text: "t", note: "n" },
    });
    const fields = guardedFields(r).map(([field]) => field);
    expect(fields).toContain("sections.act.summary");
    expect(fields).toContain("sections.act.findings[0].claim");
    expect(fields).toContain("rewrite.note");
    expect(fields.some((f) => f.includes("quote"))).toBe(false);
    expect(fields).not.toContain("rewrite.text");
  });
});

describe("rule hygiene", () => {
  // A /g/ regex keeps `lastIndex` between calls, so a rule reused across
  // fields starts matching from where it left off and misses the second hit.
  // This test is the reason the patterns are declared without the flag.
  it("catches the same construction in two different fields", () => {
    const r = report();
    r.sections[0]!.summary = "The reader will feel rushed.";
    r.sections[1]!.summary = "The reader will feel rushed.";
    const fields = guardReport(r).map((v) => v.field);
    expect(fields).toContain("sections.act.summary");
    expect(fields).toContain("sections.responsibility.summary");
  });

  it("declares no rule with the global flag", () => {
    expect(GUARD_RULES.filter((rule) => rule.pattern.global)).toEqual([]);
  });

  it("gives every rule a distinct id", () => {
    const ids = GUARD_RULES.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the retry instruction", () => {
  it("quotes the offending span so the model repairs rather than rewrites", () => {
    const violations = inspect("your manager will feel undermined", "sections.act.summary");
    const instruction = retryInstruction(violations);
    expect(instruction).toContain("sections.act.summary");
    expect(instruction).toContain("will feel");
    expect(instruction).toContain("Keep every other field");
  });
});
