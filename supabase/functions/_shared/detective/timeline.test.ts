import { describe, expect, it } from "vitest";
import {
  chronological,
  collectiveCertainty,
  explanationsFor,
  findTemporalDiscrepancies,
  type TimelineEvent,
} from "./timeline.ts";

// The specification's own worked example, verbatim in substance: somebody says
// they left at 20:00, a camera puts their vehicle there at 20:37, a phone
// record puts a device nearby at 20:41.
const statement: TimelineEvent = {
  id: "e1", label: "Says they left Location X", at: "2026-06-14T20:00:00Z",
  certainty: "claimed", origin: "account", sourceId: "s-statement",
};
const cctv: TimelineEvent = {
  id: "e2", label: "Vehicle appears at Location X", at: "2026-06-14T20:37:00Z",
  certainty: "confirmed", origin: "recording", sourceId: "s-cctv",
};
const phone: TimelineEvent = {
  id: "e3", label: "Device active near Location X", at: "2026-06-14T20:41:00Z",
  certainty: "confirmed", origin: "recording", sourceId: "s-phone",
};

describe("the specification's worked example", () => {
  const found = findTemporalDiscrepancies([statement, cctv, phone]);

  it("detects the discrepancy between the account and the camera", () => {
    const pair = found.find((d) => d.a.id === "e1" && d.b.id === "e2");
    expect(pair).toBeDefined();
    expect(pair?.differenceMinutes).toBe(37);
  });

  it("does not manufacture one between the camera and the phone, four minutes apart", () => {
    expect(found.find((d) => d.a.id === "e2" && d.b.id === "e3")).toBeUndefined();
  });

  it("marks it potential, never verified", () => {
    for (const discrepancy of found) expect(discrepancy.status).toBe("potential");
  });

  // The requirement §9 states in capitals. A discrepancy that cannot be
  // constructed without explanations cannot be rendered as an accusation.
  it("never produces a discrepancy without explanations", () => {
    expect(found.length).toBeGreaterThan(0);
    for (const discrepancy of found) {
      expect(discrepancy.explanations.length).toBeGreaterThan(1);
      for (const explanation of discrepancy.explanations) {
        expect(explanation.summary.trim()).not.toBe("");
        expect(explanation.distinguishedBy.trim()).not.toBe("");
      }
    }
  });

  it("says nothing about lying, deception or honesty anywhere in the output", () => {
    const prose = JSON.stringify(found).toLowerCase();
    for (const word of ["lied", "lying", "liar", "deceptive", "dishonest", "false statement"]) {
      expect(prose).not.toContain(word);
    }
  });
});

describe("the explanations offered", () => {
  it("offers a clock or timezone error wherever a recording is involved", () => {
    const summaries = explanationsFor(statement, cctv).map((e) => e.summary);
    expect(summaries.some((s) => /clock is wrong|timezone/i.test(s))).toBe(true);
  });

  it("offers misidentification wherever a recording is involved", () => {
    const summaries = explanationsFor(statement, cctv).map((e) => e.summary);
    expect(summaries.some((s) => /other than what it is taken to show/i.test(s))).toBe(true);
  });

  it("offers a device present without its owner", () => {
    const summaries = explanationsFor(statement, phone).map((e) => e.summary);
    expect(summaries.some((s) => /without the person/i.test(s))).toBe(true);
  });

  it("always offers that both are accurate and describe different moments", () => {
    const summaries = explanationsFor(statement, cctv).map((e) => e.summary);
    expect(summaries.some((s) => /different moments/i.test(s))).toBe(true);
  });

  // Named rather than avoided. Omitting it while listing five others steers the
  // reader as surely as leading with it would.
  it("names inaccuracy as one possibility among others, and not the first", () => {
    const explanations = explanationsFor(statement, cctv);
    const index = explanations.findIndex((e) => /account is inaccurate/i.test(e.summary));
    expect(index).toBeGreaterThan(0);
    expect(explanations[index]?.distinguishedBy).toMatch(/independent record/i);
  });

  it("gives every explanation something that would settle it", () => {
    for (const explanation of explanationsFor(statement, phone)) {
      expect(explanation.distinguishedBy.length).toBeGreaterThan(20);
    }
  });
});

describe("what counts as a conflict", () => {
  const at = (id: string, iso: string, over: Partial<TimelineEvent> = {}): TimelineEvent => ({
    id, label: id, at: iso, certainty: "confirmed", origin: "recording", sourceId: `s-${id}`, ...over,
  });

  it("ignores a gap inside the default threshold", () => {
    expect(findTemporalDiscrepancies([
      at("a", "2026-06-14T20:00:00Z"), at("b", "2026-06-14T20:10:00Z"),
    ])).toEqual([]);
  });

  it("widens for an approximate time by its own tolerance", () => {
    const approximate = at("a", "2026-06-14T20:00:00Z", {
      certainty: "approximate", toleranceMinutes: 120,
    });
    expect(findTemporalDiscrepancies([approximate, at("b", "2026-06-14T21:30:00Z")])).toEqual([]);
    expect(findTemporalDiscrepancies([approximate, at("b", "2026-06-15T02:00:00Z")]))
      .toHaveLength(1);
  });

  // An event whose time nobody knows conflicts with nothing. Treating an
  // unknown as a value produces conflicts against a date that was never claimed.
  it("never conflicts with an event of unknown time", () => {
    expect(findTemporalDiscrepancies([
      at("a", "2026-06-14T20:00:00Z"),
      at("b", "1970-01-01T00:00:00Z", { certainty: "unknown" }),
    ])).toEqual([]);
  });

  it("compares every pair, not just neighbours", () => {
    const found = findTemporalDiscrepancies([
      at("a", "2026-06-14T08:00:00Z"),
      at("b", "2026-06-14T12:00:00Z"),
      at("c", "2026-06-14T18:00:00Z"),
    ]);
    expect(found).toHaveLength(3);
  });
});

describe("the certainty a set of records collectively warrants", () => {
  const at = (id: string, iso: string, over: Partial<TimelineEvent> = {}): TimelineEvent => ({
    id, label: id, at: iso, certainty: "confirmed", origin: "recording", sourceId: `s-${id}`, ...over,
  });

  // Once two records disagree, no single one of them can honestly be presented
  // as confirmed, whatever its own origin claimed for it.
  it("is conflicting as soon as anything disagrees, however confirmed the parts", () => {
    expect(collectiveCertainty([
      at("a", "2026-06-14T20:00:00Z"), at("b", "2026-06-14T22:00:00Z"),
    ])).toBe("conflicting");
  });

  it("is confirmed when agreeing records include a confirmed one", () => {
    expect(collectiveCertainty([
      at("a", "2026-06-14T20:00:00Z"),
      at("b", "2026-06-14T20:05:00Z", { certainty: "claimed", origin: "account" }),
    ])).toBe("confirmed");
  });

  it("falls back through approximate and claimed", () => {
    expect(collectiveCertainty([at("a", "2026-06-14T20:00:00Z", { certainty: "approximate" })]))
      .toBe("approximate");
    expect(collectiveCertainty([at("a", "2026-06-14T20:00:00Z", { certainty: "claimed" })]))
      .toBe("claimed");
  });

  it("is unknown for nothing at all", () => {
    expect(collectiveCertainty([])).toBe("unknown");
  });
});

describe("ordering a timeline", () => {
  const at = (id: string, iso: string, over: Partial<TimelineEvent> = {}): TimelineEvent => ({
    id, label: id, at: iso, certainty: "confirmed", origin: "recording", sourceId: `s-${id}`, ...over,
  });

  it("sorts chronologically", () => {
    const sorted = chronological([
      at("c", "2026-06-14T18:00:00Z"), at("a", "2026-06-14T08:00:00Z"), at("b", "2026-06-14T12:00:00Z"),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  // An event whose time nobody knows belongs at the end, not at the epoch.
  // Sorting it to 1970 puts it before everything and reads as a finding.
  it("puts events of unknown time last, not first", () => {
    const sorted = chronological([
      at("unknown", "1970-01-01T00:00:00Z", { certainty: "unknown" }),
      at("a", "2026-06-14T08:00:00Z"),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(["a", "unknown"]);
  });
});
