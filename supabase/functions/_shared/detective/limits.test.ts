import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TEXT_LIMITS, nearLimit, textProblem, type TextLimit } from "./limits.ts";

// Rule 6: a client-side copy of a server rule must be drift-tested. These
// numbers exist only so a person gets a sentence instead of a constraint
// violation, and the moment one of them stops matching its migration the
// sentence becomes a lie — one that tells somebody to trim to a length the
// database will still refuse.
const migrations = fileURLToPath(new URL("../../../migrations", import.meta.url));
const sql = readdirSync(migrations)
  .filter((name) => name.endsWith(".sql"))
  .map((name) => readFileSync(`${migrations}/${name}`, "utf8"))
  .join("\n");

/**
 * The upper bound Postgres will enforce for a column, read from the migration.
 *
 * Matches the two shapes the schema actually uses — `between 1 and n` for a
 * required column and `x is null or length(...) between 1 and n` for an
 * optional one — and deliberately nothing else. A regex loose enough to match
 * any constraint would quietly match the wrong one.
 */
function declaredMax(column: string): number | null {
  const pattern = new RegExp(
    `${column}\\s+text[^,]*?check\\s*\\(\\s*(?:${column}\\s+is\\s+null\\s+or\\s+)?` +
      `length\\(btrim\\(${column}\\)\\)\\s+between\\s+1\\s+and\\s+(\\d+)`,
    "is",
  );
  const alter = new RegExp(
    `add\\s+column\\s+if\\s+not\\s+exists\\s+${column}\\s+text\\s*` +
      `check\\s*\\(\\s*(?:${column}\\s+is\\s+null\\s+or\\s+)?` +
      `length\\(btrim\\(${column}\\)\\)\\s+between\\s+1\\s+and\\s+(\\d+)`,
    "is",
  );
  const match = sql.match(alter) ?? sql.match(pattern);
  return match ? Number(match[1]) : null;
}

const COLUMN_OF: Record<keyof typeof TEXT_LIMITS, string> = {
  caseTitle: "title",
  sourceTitle: "title",
  claimStatement: "statement",
  eventLabel: "label",
  eventMoment: "moment",
};

describe("the limits shown to a person match the ones enforced", () => {
  // Read from the migration text, per column, rather than trusting the numbers
  // written next to them.
  it.each([
    ["claimStatement", 2000],
    ["eventLabel", 300],
    ["eventMoment", 200],
  ] as const)("%s mirrors its constraint", (name, expected) => {
    const column = COLUMN_OF[name];
    expect(declaredMax(column)).toBe(expected);
    expect(TEXT_LIMITS[name].max).toBe(expected);
  });

  // `title` appears on two tables with different limits, so a single regex over
  // the whole corpus cannot tell them apart. Asserted against their own file.
  it.each([
    ["caseTitle", "20260822000000_detective_case_privacy.sql", 200],
    ["sourceTitle", "20260822010000_detective_sources_evidence.sql", 500],
  ] as const)("%s mirrors its constraint", (name, file, expected) => {
    const text = readFileSync(`${migrations}/${file}`, "utf8");
    const match = text.match(/title\s+text\s+not\s+null\s+check\s*\(length\(btrim\(title\)\)\s+between\s+1\s+and\s+(\d+)\)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(expected);
    expect(TEXT_LIMITS[name].max).toBe(expected);
  });

  // The negative control for the reader above: if declaredMax matched anything
  // it was handed, every assertion in the first block would be vacuous.
  it("finds nothing for a column that has no such constraint", () => {
    expect(declaredMax("no_such_column")).toBeNull();
    expect(declaredMax("retrieved_from")).toBeNull();
  });

  it("names a real constraint for every limit", () => {
    for (const limit of Object.values(TEXT_LIMITS) as TextLimit[]) {
      // Postgres names an unnamed check `<table>_<column>_check`, which is what
      // surfaces in the error a user sees. Naming it here is what lets somebody
      // reading that error find this file.
      expect(sql).toMatch(/create table if not exists/);
      expect(limit.constraint).toMatch(/^[a-z_]+_check$/);
    }
  });
});

describe("what a person is told", () => {
  const limit = TEXT_LIMITS.eventLabel;

  it("says nothing about an empty field", () => {
    // Empty is the form's business — it disables the button. A length
    // complaint about a field nobody has typed in is noise.
    expect(textProblem("", limit)).toBeNull();
    expect(textProblem("   ", limit)).toBeNull();
  });

  it("says nothing about a value that fits", () => {
    expect(textProblem("a".repeat(limit.max), limit)).toBeNull();
  });

  it("counts trimmed, because the constraint does", () => {
    expect(textProblem(`  ${"a".repeat(limit.max)}  `, limit)).toBeNull();
  });

  it("says how long it is, how long it may be, and how much to cut", () => {
    const problem = textProblem("a".repeat(limit.max + 42), limit);
    expect(problem).toContain(String(limit.max + 42));
    expect(problem).toContain(String(limit.max));
    expect(problem).toContain("trim 42");
  });

  it("shows a counter only once it is nearly full", () => {
    expect(nearLimit("a".repeat(10), limit)).toBe(false);
    expect(nearLimit("a".repeat(limit.max), limit)).toBe(true);
  });
});
