import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseDataset, type Dataset } from "./dataset.ts";
import { availableFor, run } from "./procedures.ts";

// The three exports an academic actually has. Built to match the format each
// tool writes — not to be easy — and kept because the header handling below is
// the difference between this feature working and being unusable.
//
// They are synthetic. That is a real limit and worth stating: they reproduce
// the *shape* of a Qualtrics, SPSS or Google Forms export, and were checked
// against what those tools document themselves as writing. No file from an
// actual study has been through this.

function fixture(name: string): Dataset {
  const path = fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
  const outcome = parseDataset(readFileSync(path, "utf8"));
  if (!outcome.ok) throw new Error(`${name}: ${outcome.reason}`);
  return outcome.dataset;
}

const column = (dataset: Dataset, name: string) =>
  dataset.columns.find((c) => c.name === name);

describe("a Qualtrics export", () => {
  const data = fixture("qualtrics.csv");

  // Before the header detection this read 42 rows: the question-text row and
  // the import-id row were data.
  it("counts the responses, not the header rows", () => {
    expect(data.rows).toBe(40);
    expect(data.notes.join(" ")).toMatch(/2 further header row\(s\) were removed/);
    expect(data.notes.join(" ")).toMatch(/Qualtrics/);
  });

  // The symptom that made the file useless: two words landing in every column
  // turned a 1–7 scale into a nine-level categorical variable, and no test
  // will run on that.
  it("reads the scale items as numeric with the levels they actually have", () => {
    for (const item of ["Q2_1", "Q2_2"]) {
      const scale = column(data, item)!;
      expect(scale.kind).toBe("numeric");
      expect(scale.distinct).toBe(7);
    }
  });

  it("reads age and duration as numeric", () => {
    expect(column(data, "Q1")!.kind).toBe("numeric");
    expect(column(data, "Duration (in seconds)")!.kind).toBe("numeric");
  });

  it("keeps the department as a grouping variable", () => {
    const department = column(data, "Q3")!;
    expect(department.kind).toBe("categorical");
    expect(department.distinct).toBe(3);
  });

  it("strips the byte-order mark from the first field name", () => {
    expect(data.columns[0]!.name).toBe("StartDate");
  });

  it("supports the analysis a researcher would actually run on it", () => {
    const list = availableFor(column(data, "Q2_1")!, column(data, "Q3")!);
    expect(list.find((entry) => entry.procedure.id === "one_way_anova")!.available).toBe(true);
    const outcome = run(data, "one_way_anova", "Q2_1", "Q3");
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.finding.n).toBe(40);
  });
});

describe("an SPSS export", () => {
  const data = fixture("spss.csv");

  it("reads every variable as numeric", () => {
    for (const name of ["ID", "AGE", "GENDER", "PRE_SCORE", "POST_SCORE", "GROUP"]) {
      expect(column(data, name)!.kind).toBe("numeric");
    }
  });

  // SPSS writes system-missing as an empty field and, in some exports, a lone
  // full stop. Both must count as absent, or a mean is computed over zeros.
  it("counts both spellings of system-missing", () => {
    expect(column(data, "AGE")!.missing).toBeGreaterThan(0);
    expect(column(data, "POST_SCORE")!.missing).toBeGreaterThan(0);
    expect(column(data, "PRE_SCORE")!.missing).toBe(0);
  });

  it("runs a paired test on the pre and post scores, keeping rows aligned", () => {
    const outcome = run(data, "paired_t", "PRE_SCORE", "POST_SCORE");
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // Fewer than the 60 rows: the pairs missing a post score are gone, and
    // gone from both halves.
    expect(outcome.finding.n).toBeLessThan(data.rows);
    expect(outcome.finding.n).toBe(data.rows - column(data, "POST_SCORE")!.missing);
  });

  // No import-id row and no text-only second row, so nothing must be dropped.
  it("has no header rows removed", () => {
    expect(data.rows).toBe(60);
    expect(data.notes.join(" ")).not.toMatch(/header row/);
  });
});

describe("a Google Forms export", () => {
  const data = fixture("googleforms.csv");

  it("keeps a question containing a comma as one column", () => {
    // "On a scale of 1-10, how likely are you to recommend us?" — split on the
    // comma, this becomes two columns and every later column shifts.
    const scale = data.columns.find((c) => /how likely are you/.test(c.name))!;
    expect(scale).toBeDefined();
    expect(scale.kind).toBe("numeric");
    expect(data.columns).toHaveLength(5);
  });

  it("keeps a free-text answer containing quotation marks intact", () => {
    const comments = data.columns.find((c) => /other comments/.test(c.name))!;
    expect(comments.values.some((value) => value?.includes('"it depends"'))).toBe(true);
  });

  // A multiple-response question arrives as one quoted field holding a
  // comma-separated list. Parsed correctly as one value; whether it should be
  // split into indicator columns is the researcher's decision, not the
  // parser's.
  it("reads a tick-all-that-apply answer as a single value", () => {
    const multi = data.columns.find((c) => /Tick all that apply/.test(c.name))!;
    expect(multi.kind).toBe("categorical");
    expect(multi.levels?.some((level) => level.value.includes(","))).toBe(true);
  });

  it("has no header rows removed", () => {
    expect(data.rows).toBe(35);
    expect(data.notes.join(" ")).not.toMatch(/header row/);
  });
});

describe("the header detection does not fire on ordinary data", () => {
  // The conservative rule: a second row is only removed when every cell in it
  // is text *and* removing it turns a column numeric. Ordinary data cannot
  // usually satisfy both, and this is the assertion that says so.
  it("keeps a first data row that happens to be all text", () => {
    const outcome = parseDataset(
      ["name,city,note", "ana,lisbon,first", "bo,porto,second", "cai,braga,third"].join("\n"),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.dataset.rows).toBe(3);
    expect(outcome.dataset.notes.join(" ")).not.toMatch(/header row/);
  });

  it("keeps a first data row with a text cell beside numeric columns", () => {
    const outcome = parseDataset(
      ["id,label,score", "1,alpha,10", "2,beta,20", "3,gamma,30"].join("\n"),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.dataset.rows).toBe(3);
    expect(column(outcome.dataset, "score")!.kind).toBe("numeric");
  });
});
