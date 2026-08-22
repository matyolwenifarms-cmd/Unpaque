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
    verdict: "The message is shaped as an update and works as a refusal.",
    annotations: [{
      start: 0,
      end: 8,
      device: "agentless_framing",
      framework: "critical_discourse",
      aspect: "responsibility",
      note: "The opening reports a state of affairs rather than naming a decision.",
    }],
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
    // Was "it leaves the reader without a date", which this rule used to refuse
    // and no longer does. That sentence asserts what the text omits, not what
    // anybody feels — see the narrowing in guard.ts. These are states.
    ["it leaves the reader uncertain about the timing", "leaves-the-reader"],
    ["it leaves the reader with a sense of being managed", "leaves-the-reader"],
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

// The deployed product's own prose is the register this is built to match, so
// the guard has to accept it. The `leaves-the-reader` rule did not, and it took
// the stub tripping it to notice: the rule banned a frame rather than a claim.
describe("the register the running site actually writes in", () => {
  const FROM_THE_SITE = [
    "The core act is an announcement of layoffs, with a secondary act of reassurance.",
    "The passive construction reports the outcome without naming who chose it, so the reader learns what happened but not who is answerable for it.",
    "People become positions, and dismissal becomes impact. Converting the action into a noun removes both the actor and the specific event, which makes the scale of the change harder to picture.",
    "A single adverb carries the emotional weight of the announcement. It registers regret without attaching that regret to anyone who made the call, and it does no work to explain the reasoning.",
    "A value claim sits directly beside the loss it follows. It is stated rather than evidenced, so it emphasises intent while the concrete question of severance, notice, or support stays omitted.",
    "This message announces job losses while removing any named person from the decision that caused them.",
  ];

  it.each(FROM_THE_SITE)("passes: %s", (prose) => {
    expect(inspect(prose, "annotations[0].note")).toEqual([]);
  });

  // The counterpart. Allowing the absence-of-information frame must not have
  // opened the door to the thing the rule is for.
  it.each([
    "leaves the reader anxious about their job",
    "leaves the reader with a sense of betrayal",
    "leaves the recipient without confidence in the sender",
    "leaves the audience feeling dismissed",
  ])("still refuses: %s", (prose) => {
    expect(inspect(prose, "annotations[0].note").length).toBeGreaterThan(0);
  });
});

// One sentence of the site's own prose is refused, on purpose, and this records
// which and why rather than quietly loosening the rule to fit.
//
// "The timing commitment is deliberately unbounded" claims the sender chose to
// leave it so. That is a claim about a mind, and it is the exact thing the
// intent rules exist to refuse — §12's boundary does not have an exception for
// prose the product already ships. The finding survives the correction intact:
// "the commitment carries no date, threshold or named condition" says
// everything the reader needs and asserts nothing about anyone's intention.
describe("where the site's prose crosses Unpaque's own boundary", () => {
  it("refuses 'deliberately', even in a sentence the deployed product writes", () => {
    const violations = inspect(
      "The timing commitment is deliberately unbounded.",
      "annotations[0].note",
    );
    expect(violations.map((v) => v.ruleId)).toContain("intent-adverb");
    expect(violations[0]?.kind).toBe("intent");
  });

  it("accepts the same finding stated structurally", () => {
    expect(
      inspect(
        "The commitment carries no date, threshold or named condition, so an open phrase keeps the sender free while leaving the reader without a point to plan around.",
        "annotations[0].note",
      ),
    ).toEqual([]);
  });
});
