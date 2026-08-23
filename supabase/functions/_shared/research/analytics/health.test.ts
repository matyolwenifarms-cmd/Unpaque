import { describe, expect, it } from "vitest";
import { parseDataset, type Dataset } from "./dataset.ts";
import { healthSummary, readHealth, type Finding } from "./health.ts";

function load(csv: string): Dataset {
  const outcome = parseDataset(csv);
  if (!outcome.ok) throw new Error(outcome.reason);
  return outcome.dataset;
}

/** A file long enough for the proportions to mean something. */
function rows(count: number, make: (index: number) => string): string {
  return Array.from({ length: count }, (_, index) => make(index)).join("\n");
}

const of = (findings: readonly Finding[], kind: string) =>
  findings.filter((finding) => finding.kind === kind);

describe("a column of numbers one cell turned into a category", () => {
  it("names the values that stopped it being numeric", () => {
    // Not "n/a" or "-": dataset.ts already reads those as missing, so a column
    // full of them stays numeric. What survives to here is an answer somebody
    // gave.
    const csv = `age,score\n${rows(30, (i) => `${20 + i},${i}`)}\nPrefer not to say,5\n65+,6\n`;
    const found = of(readHealth(load(csv)), "numbers_as_text");
    expect(found).toHaveLength(1);
    expect(found[0]!.column).toBe("age");
    expect(found[0]!.says).toContain('"Prefer not to say"');
    expect(found[0]!.says).toContain('"65+"');
    expect(found[0]!.level).toBe("will_mislead");
  });

  // Negative control for the threshold. A genuine category of words is not a
  // numeric column with a problem, and reporting it as one would put a finding
  // on every text column in every file.
  it("says nothing about a column that is simply categorical", () => {
    const csv = `arm,score\n${rows(30, (i) => `${i % 2 === 0 ? "control" : "treatment"},${i}`)}\n`;
    expect(of(readHealth(load(csv)), "numbers_as_text")).toHaveLength(0);
  });

  it("says nothing about a column that is already numeric", () => {
    const csv = `age,score\n${rows(30, (i) => `${20 + i},${i}`)}\n`;
    expect(of(readHealth(load(csv)), "numbers_as_text")).toHaveLength(0);
  });

  // Negative control for the boundary this module sits on. A missing marker
  // is missingness, and reporting it here as well would put two findings on
  // the same cell saying different things about it.
  it("does not re-report the standard missing markers as text", () => {
    const csv = `age,score\n${rows(30, (i) => `${20 + i},${i}`)}\n-,5\nn/a,6\n`;
    expect(of(readHealth(load(csv)), "numbers_as_text")).toHaveLength(0);
  });
});

describe("levels that are the same word", () => {
  it("finds the same word written in two cases", () => {
    const csv = `gender,score\n${rows(24, (i) => `${["Male", "male", "Female"][i % 3]},${i}`)}\n`;
    const found = of(readHealth(load(csv)), "levels_differ_by_case");
    expect(found).toHaveLength(1);
    expect(found[0]!.says).toContain('"Male"');
    expect(found[0]!.says).toContain('"male"');
    expect(found[0]!.level).toBe("will_mislead");
  });

  // The reason this rule folds case and nothing else: the parser has already
  // taken the whitespace off, so a trailing space is not a state a level can
  // be in. Asserting that keeps the rule honest if the parser ever stops.
  it("never sees a trailing space, because the parser trims one off", () => {
    const csv = `gender,score\n${rows(24, (i) => `${["Male", '"Male "', "Female"][i % 3]},${i}`)}\n`;
    const dataset = load(csv);
    const gender = dataset.columns.find((column) => column.name === "gender")!;
    expect(gender.levels!.map((level) => level.value).sort()).toEqual(["Female", "Male"]);
    expect(of(readHealth(dataset), "levels_differ_by_case")).toHaveLength(0);
  });

  // Negative control: two genuinely different levels are two levels.
  it("says nothing when the levels really are different words", () => {
    const csv = `arm,score\n${rows(24, (i) => `${["control", "treatment"][i % 2]},${i}`)}\n`;
    expect(of(readHealth(load(csv)), "levels_differ_by_case")).toHaveLength(0);
  });
});

describe("columns that cannot carry an analysis", () => {
  it("finds a column that never varies", () => {
    const csv = `site,score\n${rows(24, (i) => `clinic,${i}`)}\n`;
    expect(of(readHealth(load(csv)), "constant")).toHaveLength(1);
  });

  it("finds a row identifier and says to leave it out", () => {
    const csv = `id,score\n${rows(24, (i) => `P${String(i).padStart(3, "0")},${i}`)}\n`;
    const found = of(readHealth(load(csv)), "identifier");
    expect(found).toHaveLength(1);
    expect(found[0]!.consider).toContain("leaving out");
  });

  // Negative control for the identifier rule, which is one case per level.
  // A column with two cases per level is a variable, not an identifier.
  it("does not call a variable an identifier", () => {
    const csv = `pair,score\n${rows(24, (i) => `P${Math.floor(i / 2)},${i}`)}\n`;
    expect(of(readHealth(load(csv)), "identifier")).toHaveLength(0);
  });
});

describe("what is missing, and who is left", () => {
  it("says nothing about a little missing data", () => {
    const csv = `score,arm\n${rows(40, (i) => `${i === 0 ? "" : i},control`)}\n`;
    expect(of(readHealth(load(csv)), "missing")).toHaveLength(0);
  });

  it("reports a fifth missing as worth checking", () => {
    const csv = `score,arm\n${rows(40, (i) => `${i % 5 === 0 ? "" : i},control`)}\n`;
    const found = of(readHealth(load(csv)), "missing");
    expect(found).toHaveLength(1);
    expect(found[0]!.level).toBe("check");
    expect(found[0]!.says).toContain("20%");
  });

  it("says the sample is no longer the sample when half of it is gone", () => {
    const csv = `score,arm\n${rows(40, (i) => `${i % 2 === 0 ? "" : i},control`)}\n`;
    const found = of(readHealth(load(csv)), "missing");
    expect(found[0]!.level).toBe("will_mislead");
    expect(found[0]!.consider).toContain("not the sample you set out to study");
  });
});

describe("groups", () => {
  it("names a group too small to support anything", () => {
    const csv = `arm,score\n${rows(40, (i) => `${i < 2 ? "pilot" : "main"},${i}`)}\n`;
    const found = of(readHealth(load(csv)), "tiny_group");
    expect(found).toHaveLength(1);
    expect(found[0]!.says).toContain('"pilot" (2)');
    // It still runs. Saying otherwise would be threatening a consequence that
    // does not happen.
    expect(found[0]!.consider).toContain("still run");
  });

  it("notes a badly unbalanced design without calling it a fault", () => {
    const csv = `arm,score\n${rows(120, (i) => `${i < 6 ? "b" : "a"},${i}`)}\n`;
    const found = of(readHealth(load(csv)), "unbalanced");
    expect(found).toHaveLength(1);
    expect(found[0]!.level).toBe("note");
    expect(found[0]!.consider).toContain("Not a fault");
  });
});

describe("rows and codes", () => {
  it("counts rows that repeat another row exactly", () => {
    const csv = `arm,score\n${rows(20, (i) => `control,${i}`)}\ncontrol,0\ncontrol,1\n`;
    const found = of(readHealth(load(csv)), "duplicate_rows");
    expect(found).toHaveLength(1);
    expect(found[0]!.says).toContain("2 of the 22 rows");
  });

  it("names the fork on a numeric column that holds five codes", () => {
    const csv = `rating,score\n${rows(40, (i) => `${(i % 5) + 1},${i}`)}\n`;
    const found = of(readHealth(load(csv)), "few_distinct_numeric");
    expect(found).toHaveLength(1);
    // It must not overrule the literature on treating a Likert item as a
    // scale. It names both readings and leaves the choice.
    expect(found[0]!.consider).toContain("rating scale");
    expect(found[0]!.says).not.toContain("meaningless");
  });

  it("says nothing about a numeric column with real spread", () => {
    const csv = `score,arm\n${rows(40, (i) => `${i * 3},control`)}\n`;
    expect(of(readHealth(load(csv)), "few_distinct_numeric")).toHaveLength(0);
  });
});

describe("the reading as a whole", () => {
  // One file with a finding of every level in it, arranged so that the two
  // that read as harmless come from the *first* columns. Without that, file
  // order and severity order agree and nothing below can tell them apart.
  const MESSY = load(
    `site,gender,age,id,score\n${rows(40, (i) =>
      `clinic,${["Male", "male"][i % 2]},${20 + i},P${i},${i % 5 === 0 ? "" : i}`)}\n` +
      `clinic,Male,Prefer not to say,PX,7\n`,
  );

  it("puts what makes a result wrong above what is worth checking", () => {
    const findings = readHealth(MESSY);
    // The note is on `site`, the first column in the file.
    expect(findings.some((finding) => finding.level === "note")).toBe(true);
    expect(findings[0]!.level).toBe("will_mislead");
    const lastMisleading = findings.map((f) => f.level).lastIndexOf("will_mislead");
    const firstOther = findings.findIndex((f) => f.level !== "will_mislead");
    expect(firstOther).toBeGreaterThan(lastMisleading);
  });

  // The pair that contradicted each other before `identifier` was told about
  // it: a numeric column two bad cells turned into a category has one case
  // per level too, and reporting it as a row identifier as well leaves a
  // reader with two findings on one column and no way to settle them.
  it("does not also call a text-contaminated numeric column an identifier", () => {
    const findings = readHealth(MESSY).filter((finding) => finding.column === "age");
    expect(findings.map((finding) => finding.kind)).toEqual(["numbers_as_text"]);
  });

  it("finds every kind it is meant to in one messy file", () => {
    const kinds = new Set(readHealth(MESSY).map((finding) => finding.kind));
    for (const kind of ["numbers_as_text", "levels_differ_by_case", "constant", "identifier", "missing"]) {
      expect(kinds, kind).toContain(kind);
    }
  });

  it("gives every finding something to do about it", () => {
    const findings = readHealth(MESSY);
    expect(findings.length).toBeGreaterThan(4);
    for (const finding of findings) {
      expect(finding.consider.length, `${finding.kind} has nothing to do about it`)
        .toBeGreaterThan(20);
    }
  });

  // Honesty: a clean file is not a good study, and the sentence must not let
  // anybody read it that way.
  it("does not let a clean file read as a sound analysis", () => {
    const csv = `score,arm\n${rows(40, (i) => `${i * 3},${["a", "b"][i % 2]}`)}\n`;
    const findings = readHealth(load(csv));
    expect(findings).toHaveLength(0);
    expect(healthSummary(findings)).toContain("different question");
  });

  it("counts what it found, and separates the two kinds", () => {
    expect(healthSummary(readHealth(MESSY))).toMatch(/will make a result wrong as the file stands/);
  });

  // No finding carries a number about an outcome. The whole reason this is a
  // separate module from `procedures.ts` is that a list of column pairs with
  // their p-values beside them is a machine for producing false positives.
  it("says nothing about any result", () => {
    const prose = readHealth(MESSY).map((f) => `${f.says} ${f.consider}`).join(" ");
    expect(prose).not.toMatch(/\bp\s*[=<]|significan|correlat|effect size|r\s*=\s*[-.\d]/i);
  });
});
