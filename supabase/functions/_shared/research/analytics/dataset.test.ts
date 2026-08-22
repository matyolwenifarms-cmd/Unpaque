import { describe, expect, it } from "vitest";
import {
  detectDelimiter,
  groupBy,
  isMissing,
  MAX_LEVELS,
  numericValues,
  parseDataset,
  splitDelimited,
  toNumber,
} from "./dataset.ts";

// Every case below is a real export shape. Each one has silently corrupted
// somebody's data before, and none of them announces itself: the numbers come
// out, they are just the wrong numbers.

describe("splitting a delimited file", () => {
  it("keeps a quoted field containing the delimiter whole", () => {
    // Split naively, this shifts every column after it by one — for that row
    // only, which reads as bad data rather than a parsing bug.
    const rows = splitDelimited('id,comment,score\n1,"It was, on balance, fine",4\n', ",");
    expect(rows[1]).toEqual(["1", "It was, on balance, fine", "4"]);
  });

  it("keeps a quoted field containing a newline whole", () => {
    const rows = splitDelimited('id,comment\n1,"first line\nsecond line"\n', ",");
    expect(rows).toHaveLength(2);
    expect(rows[1]![1]).toBe("first line\nsecond line");
  });

  it("reads a doubled quote as one literal quote", () => {
    const rows = splitDelimited('id,comment\n1,"she said ""no"" twice"\n', ",");
    expect(rows[1]![1]).toBe('she said "no" twice');
  });

  it("handles CRLF without leaving a carriage return on the last field", () => {
    // Otherwise "yes\r" and "yes" are different categories, and the same
    // answer appears twice in a frequency table.
    const rows = splitDelimited("a,b\r\nyes,no\r\n", ",");
    expect(rows[1]).toEqual(["yes", "no"]);
  });
});

describe("detecting the delimiter", () => {
  it("finds semicolons, which is what Excel writes on a comma-decimal machine", () => {
    expect(detectDelimiter("id;age;score")).toBe(";");
    expect(detectDelimiter("id,age,score")).toBe(",");
    expect(detectDelimiter("id\tage\tscore")).toBe("\t");
  });

  it("is not fooled by a comma inside a quoted header", () => {
    expect(detectDelimiter('id;"Age, in years";score')).toBe(";");
  });
});

describe("reading a dataset", () => {
  const csv = [
    "id,group,score,comment",
    "1,control,12,fine",
    "2,control,15,",
    "3,treatment,19,good",
    "4,treatment,N/A,ok",
    "5,treatment,21,good",
  ].join("\n");

  it("names the columns and counts the rows", () => {
    const outcome = parseDataset(csv);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.dataset.rows).toBe(5);
    expect(outcome.dataset.columns.map((c) => c.name)).toEqual(["id", "group", "score", "comment"]);
  });

  // One stray "N/A" must not silently become a zero in a mean.
  it("refuses to call a column numeric when one value is not", () => {
    const outcome = parseDataset(csv);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const score = outcome.dataset.columns.find((c) => c.name === "score")!;
    expect(score.kind).toBe("numeric");
    expect(score.missing).toBe(1);
    expect(score.n).toBe(4);
    expect(numericValues(score)).toEqual([12, 15, 19, 21]);
  });

  it("finds the levels of a categorical column, most frequent first", () => {
    const outcome = parseDataset(csv);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const group = outcome.dataset.columns.find((c) => c.name === "group")!;
    expect(group.kind).toBe("categorical");
    expect(group.levels?.[0]).toEqual({ value: "treatment", count: 3 });
    expect(group.distinct).toBe(2);
  });

  it("calls a column of many distinct strings text, not a variable", () => {
    const rows = ["notes", ...Array.from({ length: MAX_LEVELS + 5 }, (_, i) => `remark ${i}`)];
    const outcome = parseDataset(rows.join("\n"));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.dataset.columns[0]!.kind).toBe("text");
  });

  // Excel writes one. Unstripped, the first column is named "\uFEFFid" and never
  // matches anything the researcher types.
  it("strips a byte-order mark", () => {
    const outcome = parseDataset("\uFEFFid,score\n1,10\n2,20\n");
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.dataset.columns[0]!.name).toBe("id");
  });

  it("reads a semicolon file and says it did", () => {
    const outcome = parseDataset("id;group;score\n1;a;10\n2;b;20\n");
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.dataset.columns).toHaveLength(3);
    expect(outcome.dataset.notes.join(" ")).toMatch(/not comma-delimited/);
  });

  it("numbers duplicate column names rather than losing one", () => {
    const outcome = parseDataset("q1,q1,q1\n1,2,3\n4,5,6\n");
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.dataset.columns.map((c) => c.name)).toEqual(["q1", "q1 (2)", "q1 (3)"]);
    expect(outcome.dataset.notes.join(" ")).toMatch(/shared a name/);
  });

  it("reports ragged rows rather than shifting the data to fit", () => {
    const outcome = parseDataset("a,b,c\n1,2,3\n4,5\n6,7,8\n");
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.dataset.notes.join(" ")).toMatch(/do not have 3 fields/);
    expect(outcome.dataset.columns[2]!.missing).toBe(1);
  });

  it("refuses a file with a header and nothing else", () => {
    expect(parseDataset("a,b,c\n").ok).toBe(false);
    expect(parseDataset("   ").ok).toBe(false);
  });

  it("treats the usual spellings of absent as absent", () => {
    for (const value of ["", "NA", "n/a", "NULL", ".", "-", "missing", "#N/A"]) {
      expect(isMissing(value)).toBe(true);
    }
    expect(isMissing("0")).toBe(false);
    expect(isMissing("no")).toBe(false);
  });
});

describe("reading a number out of a spreadsheet cell", () => {
  it("handles thousands separators and percentages", () => {
    expect(toNumber("1,234")).toBe(1234);
    expect(toNumber("1,234,567.5")).toBe(1234567.5);
    expect(toNumber("45%")).toBeCloseTo(0.45, 10);
    expect(toNumber("-12.5")).toBe(-12.5);
  });

  // "1,5" is one-and-a-half or fifteen hundred and nothing in the cell says
  // which. Left non-numeric, so the column reports categorical — visible,
  // rather than wrong by a factor of a thousand.
  it("refuses an ambiguous comma decimal rather than guessing", () => {
    expect(Number.isFinite(toNumber("1,5"))).toBe(false);
  });
});

describe("splitting one column by another", () => {
  const csv = [
    "group,score",
    "a,10", "a,12", "b,20", "b,22", ",30", "a,",
  ].join("\n");

  it("groups row-wise and drops a row missing either half", () => {
    const outcome = parseDataset(csv);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const [group, score] = outcome.dataset.columns;
    const groups = groupBy(score!, group!);
    expect(groups.map((g) => g.level)).toEqual(["a", "b"]);
    // The "a" with no score and the score with no group are both gone.
    expect(groups[0]!.values).toEqual([10, 12]);
    expect(groups[1]!.values).toEqual([20, 22]);
  });
});
