import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BASIS_MAX, BASIS_MIN, STUDY_RELATIONS, basisProblem, readRelation } from "./corpus.ts";

const MIGRATION = readFileSync(
  "supabase/migrations/20260823090000_research_relations.sql",
  "utf8",
);

// Rule 8: a client-side copy of a server rule is drift-tested, or it drifts.
// This copy exists only so a reviewer gets a sentence instead of a raw
// constraint violation, and a sentence describing a limit the database no
// longer has is worse than the violation.
describe("the vocabulary matches the database", () => {
  it("has exactly the values the enum has", () => {
    const declared = /create type public\.study_relation as enum \(([^)]*)\)/.exec(MIGRATION);
    expect(declared).not.toBeNull();
    const values = [...declared![1]!.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
    expect(values).toEqual([...STUDY_RELATIONS]);
  });

  it("uses the same limits on a basis as the check constraint", () => {
    const check = /length\(btrim\(basis\)\) between (\d+) and (\d+)/.exec(MIGRATION);
    expect(check).not.toBeNull();
    expect(Number(check![1])).toBe(BASIS_MIN);
    expect(Number(check![2])).toBe(BASIS_MAX);
  });

  // The negative control for the two readers above: if either matched
  // anything it was handed, both assertions would be vacuous.
  it("finds nothing in a migration that declares neither", () => {
    expect(/create type public\.study_relation as enum \(([^)]*)\)/.test("select 1;")).toBe(false);
    expect(/length\(btrim\(basis\)\) between (\d+) and (\d+)/.test("select 1;")).toBe(false);
  });
});

describe("what a reviewer is told about their reason", () => {
  it("accepts a reason that says something", () => {
    expect(basisProblem("Ndlovu reports 40% and Smith 52% for the same cohort.")).toBeNull();
  });

  it("asks for one when the field is empty", () => {
    expect(basisProblem("   ")).toContain("Say why");
  });

  // Not "invalid input". Somebody who typed "differs" has not made a mistake,
  // they have written half a thought, and the sentence says which.
  it("says what is missing rather than what is wrong", () => {
    const said = basisProblem("differs")!;
    expect(said).toContain("the start of a reason rather than one");
    // Never "invalid" or "must". They have written half a thought, not made a
    // mistake, and a form that tells them off for it gets a filled field
    // rather than a reason.
    expect(said).not.toMatch(/invalid|error|must/i);
  });

  it("says the limit when there is too much", () => {
    expect(basisProblem("x".repeat(BASIS_MAX + 1))).toContain(String(BASIS_MAX));
  });
});

describe("reading a relation back", () => {
  // The direction is the whole point and an arrow does not carry it.
  it("puts the direction in the sentence", () => {
    expect(readRelation("contradicts", "Ndlovu 2019", "Smith 2020"))
      .toBe("Ndlovu 2019 contradicts Smith 2020");
    expect(readRelation("contradicts", "Smith 2020", "Ndlovu 2019"))
      .toBe("Smith 2020 contradicts Ndlovu 2019");
  });

  it("reads the other relation too", () => {
    expect(readRelation("corroborates", "A", "B")).toBe("A corroborates B");
  });
});
