import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  canWrite,
  CASE_ROLES,
  CASE_VISIBILITIES,
  EPISTEMIC_MEANINGS,
  EPISTEMIC_STATUSES,
  EVIDENCE_LANGUAGE,
  WRITING_ROLES,
} from "./epistemic.ts";

const migration = readFileSync(
  fileURLToPath(new URL("../../../migrations/20260822000000_detective_case_privacy.sql", import.meta.url)),
  "utf8",
);

/** Pull the values out of a `create type ... as enum (...)` in the migration. */
function enumValues(name: string): string[] {
  const match = new RegExp(`create type public\\.${name} as enum \\(([^)]*)\\)`, "s").exec(migration);
  if (!match) throw new Error(`no enum ${name} found in the migration`);
  return [...match[1]!.matchAll(/'([^']+)'/g)].map((entry) => entry[1]!);
}

// Rule 8: a client-side copy of a server rule gets drift-tested, or it drifts.
// Adding a value on one side only is the specific thing this catches, and it is
// the thing that actually happens.
describe("the TypeScript enums still agree with Postgres", () => {
  it("has exactly the epistemic statuses the migration declares", () => {
    expect([...EPISTEMIC_STATUSES].sort()).toEqual(enumValues("epistemic_status").sort());
  });

  it("has exactly the case roles the migration declares", () => {
    expect([...CASE_ROLES].sort()).toEqual(enumValues("case_role").sort());
  });

  it("has exactly the visibilities the migration declares", () => {
    expect([...CASE_VISIBILITIES].sort()).toEqual(enumValues("case_visibility").sort());
  });

  // The negative control for the parser itself. If enumValues silently returned
  // an empty list, all three tests above would pass by comparing nothing.
  it("actually reads values out of the migration", () => {
    expect(enumValues("case_visibility")).toEqual(["private", "published"]);
    expect(() => enumValues("no_such_enum")).toThrow(/no enum/);
  });
});

describe("the writing roles agree with can_write_case", () => {
  it("matches the roles the SQL function names", () => {
    const match = /in \('owner', 'investigator', 'editor'\)/.exec(migration);
    expect(match).not.toBeNull();
    expect([...WRITING_ROLES].sort()).toEqual(["editor", "investigator", "owner"]);
  });

  it.each([...CASE_ROLES])("decides %s consistently", (role) => {
    expect(canWrite(role)).toBe(WRITING_ROLES.includes(role));
  });

  it("refuses a null role", () => {
    expect(canWrite(null)).toBe(false);
  });
});

describe("§4's meanings", () => {
  it("gives every status a meaning and a required behaviour", () => {
    for (const status of EPISTEMIC_STATUSES) {
      const meaning = EPISTEMIC_MEANINGS[status];
      expect(meaning.status).toBe(status);
      expect(meaning.meaning.trim()).not.toBe("");
      expect(meaning.required.trim()).not.toBe("");
    }
  });

  it("describes unknown as a valid state rather than a failure", () => {
    expect(EPISTEMIC_MEANINGS.unknown.required).toMatch(/valid state, not as a failure/);
  });

  it("requires contested to show the conflict rather than pick a side", () => {
    expect(EPISTEMIC_MEANINGS.contested.required).toMatch(/do not silently choose a side/);
  });

  it("keeps a phrasing for every strength in the language table", () => {
    expect(EVIDENCE_LANGUAGE).toHaveLength(6);
    for (const entry of EVIDENCE_LANGUAGE) expect(entry.phrasing.trim()).not.toBe("");
  });
});
