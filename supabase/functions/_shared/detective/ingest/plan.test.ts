import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { MAX_ARCHIVE_DEPTH, planImport, summarise, type IncomingFile } from "./plan.ts";

const file = (name: string, text: string): IncomingFile => ({ name, bytes: strToU8(text) });

const wordFile = (name: string, paragraphs: string[]): IncomingFile => ({
  name,
  bytes: zipSync({
    "word/document.xml": strToU8(
      `<w:document><w:body>${paragraphs.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join("")}</w:body></w:document>`,
    ),
  }),
});

const zip = (name: string, contents: Record<string, string>): IncomingFile => ({
  name,
  bytes: zipSync(Object.fromEntries(Object.entries(contents).map(([k, v]) => [k, strToU8(v)]))),
});

const byName = (plan: Awaited<ReturnType<typeof planImport>>, name: string) =>
  plan.sources.find((source) => source.name === name)!;

describe("one pile of files in", () => {
  it("reads each file and says what it appears to be", async () => {
    const plan = await planImport([
      file("docket.txt", "SAPS CHARGE SHEET\nCAS 231/08/2024\nThe accused..."),
      file("amy.txt", "I, the undersigned, Amy Dlamini, do hereby state under oath:"),
    ]);
    expect(plan.sources).toHaveLength(2);
    expect(byName(plan, "docket.txt").reading.suggests).toBe("official_record");
    expect(byName(plan, "amy.txt").reading.suggests).toBe("testimony");
    expect(byName(plan, "amy.txt").reading.because).toMatch(/sworn statement/);
  });

  it("reads a Word document", async () => {
    const plan = await planImport([wordFile("statement.docx", ["Q: Where were you?", "A: At the depot."])]);
    expect(plan.sources[0]!.pages[0]!.body).toMatch(/Where were you/);
    expect(plan.sources[0]!.reading.suggests).toBe("testimony");
  });

  // Most of a real case file is photographs of paper. Dropping them would
  // quietly shrink the case to whatever happened to be typed.
  it("keeps a file it cannot read, marked rather than missing", async () => {
    const image: IncomingFile = { name: "scan.png", bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2]) };
    const plan = await planImport([image]);
    expect(plan.sources).toHaveLength(1);
    expect(plan.sources[0]!.pages).toEqual([]);
    expect(plan.sources[0]!.says).toMatch(/No text is extracted from image files/);
    expect(plan.sources[0]!.reading.because).toMatch(/Nothing has read what is in it/);
  });

  it("says a PDF is probably a scan when nothing reads it", async () => {
    const pdf: IncomingFile = { name: "bundle.pdf", bytes: strToU8("%PDF-1.7\nbinary...") };
    const plan = await planImport([pdf], async () => []);
    expect(plan.sources[0]!.says).toMatch(/no text layer, so it is probably a scan/);
  });

  it("uses the PDF reader it is given", async () => {
    const pdf: IncomingFile = { name: "bundle.pdf", bytes: strToU8("%PDF-1.7") };
    const plan = await planImport([pdf], async () => [
      { number: 1, body: "IN THE HIGH COURT OF SOUTH AFRICA" },
      { number: 2, body: "Case No: 4412/2024" },
    ]);
    expect(plan.sources[0]!.pages).toHaveLength(2);
    expect(plan.sources[0]!.reading.suggests).toBe("official_record");
  });

  it("says plainly when nothing can be read at all", async () => {
    expect((await planImport([])).says).toBe("No files were chosen.");
  });
});

describe("archives", () => {
  it("opens a zip and imports what is inside, not the zip", async () => {
    const plan = await planImport([
      zip("case.zip", { "docket.txt": "CHARGE SHEET", "amy.txt": "Q: Where were you?" }),
    ]);
    expect(plan.sources.map((source) => source.name).sort()).toEqual(["amy.txt", "docket.txt"]);
    expect(plan.archives).toEqual(["case.zip"]);
    expect(byName(plan, "amy.txt").within).toBe("case.zip");
  });

  it("follows a zip inside a zip", async () => {
    const inner = zipSync({ "amy.txt": strToU8("I do hereby state under oath:") });
    const plan = await planImport([{ name: "outer.zip", bytes: zipSync({ "inner.zip": inner }) }]);
    expect(plan.sources.map((source) => source.name)).toEqual(["amy.txt"]);
  });

  // Not silently skipped: somebody should look at it rather than wonder later
  // why a hundred files are missing.
  it("stops at a depth and says it stopped", async () => {
    let bytes = zipSync({ "amy.txt": strToU8("text") });
    for (let depth = 0; depth <= MAX_ARCHIVE_DEPTH; depth += 1) {
      bytes = zipSync({ [`level${depth}.zip`]: bytes });
    }
    const plan = await planImport([{ name: "deep.zip", bytes }]);
    expect(plan.sources.some((source) => source.says?.includes("nested more than"))).toBe(true);
  });

  it("says so when an archive holds nothing importable", async () => {
    const plan = await planImport([{ name: "empty.zip", bytes: zipSync({}) }]);
    expect(plan.sources[0]!.says).toBe("The archive holds no files.");
  });
});

describe("what the person is told before anything is imported", () => {
  it("names a duplicate rather than importing it twice", async () => {
    const plan = await planImport([
      file("statement.txt", "I do hereby state under oath: I was there."),
      file("statement-copy.txt", "I do hereby state under oath: I was there."),
    ]);
    expect(byName(plan, "statement.txt").duplicateOf).toBeUndefined();
    expect(byName(plan, "statement-copy.txt").duplicateOf).toBe("statement.txt");
  });

  // A docket exported as .doc is a PDF about a third of the time.
  it("carries a name-and-bytes disagreement through to the review", async () => {
    const plan = await planImport([{ name: "docket.doc", bytes: strToU8("%PDF-1.4\n") }]);
    expect(plan.sources[0]!.detection.disagreement).toMatch(/The name says doc but the file is pdf/);
  });

  // A researcher with forty files will not read forty rows.
  it("summarises the three things that change what to do next", async () => {
    const plan = await planImport([
      file("a.txt", "I do hereby state under oath:"),
      file("b.txt", "I do hereby state under oath:"),
      { name: "scan.png", bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) },
      { name: "docket.doc", bytes: strToU8("%PDF-1.4") },
    ]);
    const said = summarise(plan);
    expect(said).toMatch(/4 files/);
    // Two: the image, and the PDF that no reader was given for.
    expect(said).toMatch(/2 held no readable text, which for a scan is expected/);
    expect(said).toMatch(/1 are copies of another file here/);
    expect(said).toMatch(/1 are not the format their name claims/);
  });

  it("says so plainly when everything read cleanly", async () => {
    const plan = await planImport([file("a.txt", "One."), file("b.txt", "Two.")]);
    expect(summarise(plan)).toBe("2 files, all readable.");
  });

  it("counts the archives it opened", async () => {
    const plan = await planImport([zip("case.zip", { "a.txt": "One.", "b.txt": "Two." })]);
    expect(summarise(plan)).toMatch(/2 files from 1 archive/);
  });

  // Two different files sharing one allocation would hash identically.
  it("hashes the file and not the buffer behind it", async () => {
    const backing = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const plan = await planImport([
      { name: "a.bin", bytes: backing.subarray(0, 4) },
      { name: "b.bin", bytes: backing.subarray(4, 8) },
    ]);
    expect(plan.sources[1]!.duplicateOf).toBeUndefined();
    expect(plan.sources[0]!.contentHash).not.toBe(plan.sources[1]!.contentHash);
  });
});
