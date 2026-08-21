import { describe, expect, it } from "vitest";
import { normalise, toSourceRange } from "./normalise.ts";

describe("normalising extracted text", () => {
  it("collapses the runs of whitespace a column layout leaves behind", () => {
    expect(normalise("one   two\n\n  three").text).toBe("one two three");
  });

  it("does not begin a document with a space", () => {
    expect(normalise("   leading").text).toBe("leading");
  });

  it("rejoins a word split across a line break by typesetting", () => {
    expect(normalise("commun-\nication matters").text).toBe("communication matters");
  });

  it("rejoins across indented continuation lines too", () => {
    expect(normalise("attribu-\n    tion theory").text).toBe("attribution theory");
  });

  // The declining case, and the reason the rule looks at what follows. A
  // capital after the break is usually a proper noun or a genuine compound.
  it("leaves a hyphen alone when the next line starts with a capital", () => {
    expect(normalise("Sub-\nSaharan Africa").text).toBe("Sub- Saharan Africa");
  });

  it("normalises typographic quotes and dashes so a quotation is searchable", () => {
    expect(normalise("“it’s” — said").text).toBe('"it\'s" - said');
  });
});

describe("keeping the offsets honest", () => {
  it("maps every normalised character back to where it came from", () => {
    const source = "one   two";
    const doc = normalise(source);
    for (let i = 0; i < doc.text.length; i += 1) {
      const at = doc.offsets[i]!;
      if (doc.text[i] === " ") continue; // a space stands for a run
      expect(source[at]).toBe(doc.text[i]);
    }
  });

  it("points a collapsed run at its first whitespace character", () => {
    const doc = normalise("one   two");
    const spaceIndex = doc.text.indexOf(" ");
    expect(doc.offsets[spaceIndex]).toBe(3);
  });

  // The property the whole passage feature rests on: a span taken from the
  // normalised text maps to a source range containing that same text.
  it("gives a source range that really contains the span", () => {
    const source = "Framing  theory\nsuggests that—in practice—salience is chosen.";
    const doc = normalise(source);
    const start = doc.text.indexOf("salience");
    const end = start + "salience is chosen".length;
    const range = toSourceRange(doc, start, end)!;
    expect(source.slice(range.start, range.end)).toContain("salience is chosen");
  });

  it("survives a de-hyphenated word", () => {
    const source = "attribu-\ntion theory explains a great deal about blame.";
    const doc = normalise(source);
    const start = doc.text.indexOf("attribution");
    const range = toSourceRange(doc, start, start + "attribution".length)!;
    expect(source.slice(range.start, range.end)).toBe("attribu-\ntion");
  });

  it("has one offset per character plus an end marker", () => {
    const doc = normalise("one   two");
    expect(doc.offsets).toHaveLength(doc.text.length + 1);
    expect(doc.offsets[doc.text.length]).toBe("one   two".length);
  });

  it.each([[-1, 3], [0, 0], [5, 2], [0, 999]])("refuses the range %i-%i", (start, end) => {
    expect(toSourceRange(normalise("a short document"), start, end)).toBeNull();
  });

  it("keeps the source untouched", () => {
    const source = "one   two\n\nthree";
    expect(normalise(source).source).toBe(source);
  });
});
