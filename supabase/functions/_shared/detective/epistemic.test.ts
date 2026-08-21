import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  canWrite,
  CASE_ROLES,
  CASE_VISIBILITIES,
  EPISTEMIC_MEANINGS,
  EPISTEMIC_STATUSES,
  DEFAULT_SOURCE_HIERARCHY,
  EVIDENCE_CLASSIFICATIONS,
  EVIDENCE_LANGUAGE,
  independentSupport,
  mayBeCorroborated,
  SOURCE_KINDS,
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

const evidenceMigration = readFileSync(
  fileURLToPath(new URL("../../../migrations/20260822010000_detective_sources_evidence.sql", import.meta.url)),
  "utf8",
);

function evidenceEnumValues(name: string): string[] {
  const match = new RegExp(`create type public\\.${name} as enum \\(([^)]*)\\)`, "s").exec(evidenceMigration);
  if (!match) throw new Error(`no enum ${name} found in the evidence migration`);
  return [...match[1]!.matchAll(/'([^']+)'/g)].map((entry) => entry[1]!);
}

describe("the source and evidence enums still agree with Postgres", () => {
  it("has exactly the source kinds the migration declares", () => {
    expect([...SOURCE_KINDS].sort()).toEqual(evidenceEnumValues("source_kind").sort());
  });

  it("has exactly the evidence classifications the migration declares", () => {
    expect([...EVIDENCE_CLASSIFICATIONS].sort())
      .toEqual(evidenceEnumValues("evidence_classification").sort());
  });

  it("ranks every source kind in the hierarchy, and none twice", () => {
    expect([...DEFAULT_SOURCE_HIERARCHY].sort()).toEqual([...SOURCE_KINDS].sort());
    expect(new Set(DEFAULT_SOURCE_HIERARCHY).size).toBe(DEFAULT_SOURCE_HIERARCHY.length);
  });

  it("actually reads values out of the evidence migration", () => {
    expect(() => evidenceEnumValues("no_such_enum")).toThrow(/no enum/);
  });
});

describe("counting independent support", () => {
  const supports = (sourceId: string, contentHash?: string) =>
    ({ sourceId, classification: "supports" as const, contentHash });

  it("counts two distinct sources as two", () => {
    expect(independentSupport([supports("a", "h1"), supports("b", "h2")])).toBe(2);
  });

  // §3, and the reason this function exists at all: a wire story printed in
  // four papers is one source, not four.
  it("counts the same bytes retrieved four times as one", () => {
    expect(independentSupport([
      supports("a", "same"), supports("b", "same"), supports("c", "same"), supports("d", "same"),
    ])).toBe(1);
  });

  it("counts unhashed sources separately — unknown is not identical", () => {
    expect(independentSupport([supports("a"), supports("b")])).toBe(2);
  });

  it("ignores evidence that does not support", () => {
    expect(independentSupport([
      { sourceId: "a", classification: "contradicts" },
      { sourceId: "b", classification: "contextualises" },
    ])).toBe(0);
  });
});

describe("whether corroboration may be claimed", () => {
  it("permits it on two independent sources", () => {
    expect(mayBeCorroborated([
      { sourceId: "a", classification: "supports", contentHash: "h1" },
      { sourceId: "b", classification: "supports", contentHash: "h2" },
    ])).toBe(true);
  });

  it("refuses it on one source copied twice", () => {
    expect(mayBeCorroborated([
      { sourceId: "a", classification: "supports", contentHash: "same" },
      { sourceId: "b", classification: "supports", contentHash: "same" },
    ])).toBe(false);
  });

  // §4 requires a contradiction to be surfaced, not outvoted. Something with
  // evidence against it is contested, whatever else supports it.
  it("refuses it whenever anything contradicts, however much supports", () => {
    expect(mayBeCorroborated([
      { sourceId: "a", classification: "supports", contentHash: "h1" },
      { sourceId: "b", classification: "supports", contentHash: "h2" },
      { sourceId: "c", classification: "supports", contentHash: "h3" },
      { sourceId: "d", classification: "contradicts" },
    ])).toBe(false);
  });

  it("refuses it on no evidence at all", () => {
    expect(mayBeCorroborated([])).toBe(false);
  });
});
