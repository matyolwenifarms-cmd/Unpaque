import { describe, expect, it } from "vitest";
import { detect, extensionOf, looksLikeText } from "./kind.ts";
import { readByFormat, readDocument } from "./classify.ts";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => new Uint8Array([...text].map((c) => c.charCodeAt(0)));
const withHeader = (signature: number[], rest = "") =>
  new Uint8Array([...signature, ...[...rest].map((c) => c.charCodeAt(0))]);

describe("what a file actually is", () => {
  it("reads a PDF from its first four bytes", () => {
    const detection = detect("docket.pdf", ascii("%PDF-1.7\n..."));
    expect(detection.kind).toBe("pdf");
    expect(detection.because).toMatch(/begins with %PDF/);
    expect(detection.disagreement).toBeUndefined();
  });

  it("tells a Word document from a spreadsheet inside the same zip container", () => {
    expect(detect("a.docx", withHeader([0x50, 0x4b, 0x03, 0x04], "word/document.xml")).kind)
      .toBe("word");
    expect(detect("a.xlsx", withHeader([0x50, 0x4b, 0x03, 0x04], "xl/workbook.xml")).kind)
      .toBe("spreadsheet");
    expect(detect("a.zip", withHeader([0x50, 0x4b, 0x03, 0x04], "case/notes.txt")).kind)
      .toBe("archive");
  });

  it("recognises images and rich text", () => {
    expect(detect("scan.png", bytes(0x89, 0x50, 0x4e, 0x47, 0x0d)).kind).toBe("image");
    expect(detect("scan.jpg", bytes(0xff, 0xd8, 0xff, 0xe0)).kind).toBe("image");
    expect(detect("note.rtf", ascii("{\\rtf1\\ansi")).kind).toBe("rich_text");
  });

  it("reads an email from its headers", () => {
    const detection = detect("thread.eml", ascii("From: a@b.org\nTo: c@d.org\nSubject: The van\n\nText."));
    expect(detection.kind).toBe("email");
  });

  it("reads plain text as text", () => {
    expect(detect("notes.txt", ascii("The van left before nine.")).kind).toBe("text");
  });

  // The whole reason this reads bytes rather than names. A docket exported as
  // .doc is a PDF about a third of the time.
  it("reports a disagreement rather than resolving it", () => {
    const detection = detect("statement.doc", ascii("%PDF-1.4\n"));
    expect(detection.kind).toBe("pdf");
    expect(detection.disagreement).toMatch(/The name says doc but the file is pdf/);
    expect(detection.disagreement).toMatch(/this is what the bytes are/);
  });

  it("does not call a .csv a disagreement for being text", () => {
    expect(detect("rows.csv", ascii("a,b,c\n1,2,3\n")).disagreement).toBeUndefined();
  });

  // An archive with nothing in it has no local file header, only the
  // end-of-central-directory record.
  it("recognises an empty archive as an archive", () => {
    expect(detect("empty.zip", bytes(0x50, 0x4b, 0x05, 0x06)).kind).toBe("archive");
    expect(detect("empty.zip", bytes(0x50, 0x4b, 0x05, 0x06)).because)
      .toMatch(/nothing in it/);
  });

  it("says an empty file is empty rather than guessing", () => {
    expect(detect("nothing.pdf", new Uint8Array()).kind).toBe("unknown");
  });

  it("refuses to name a format it does not recognise", () => {
    const detection = detect("thing.bin", bytes(0x00, 0x01, 0x02, 0x03));
    expect(detection.kind).toBe("unknown");
    expect(detection.because).toMatch(/match no format this recognises/);
  });

  // An old .doc and an old .xls share one container, and the extension is the
  // better evidence.
  it("uses the extension for an old binary Office file, and says why", () => {
    const ole = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    expect(detect("old.xls", ole).kind).toBe("spreadsheet");
    expect(detect("old.doc", ole).because).toMatch(/does not say which application wrote it/);
  });

  it("knows a UTF-16 file is text despite being full of NULs", () => {
    expect(looksLikeText(bytes(0xff, 0xfe, 0x54, 0x00, 0x68, 0x00))).toBe(true);
    expect(looksLikeText(bytes(0x54, 0x00, 0x68, 0x00))).toBe(false);
  });

  it("reads an extension off a name, or nothing", () => {
    expect(extensionOf("a/b/c.PDF")).toBe("pdf");
    expect(extensionOf("no-extension")).toBe("");
  });
});

// Every reading is a suggestion with its evidence attached. A docket filed as
// a witness statement corrupts every count downstream.
describe("what an investigative document appears to be", () => {
  it("reads a court record from its heading", () => {
    const reading = readDocument("IN THE HIGH COURT OF SOUTH AFRICA\nCase No: 4412/2024\n");
    expect(reading.suggests).toBe("official_record");
    expect(reading.strength).toBe("clear");
    expect(reading.because).toMatch(/court heading and a case number/);
  });

  it("reads a docket", () => {
    expect(readDocument("SAPS CHARGE SHEET\nCAS 231/08/2024\n").suggests).toBe("official_record");
  });

  it("reads an affidavit as testimony", () => {
    const reading = readDocument("I, the undersigned, Amy Dlamini, do hereby state under oath:");
    expect(reading.suggests).toBe("testimony");
    expect(reading.strength).toBe("clear");
  });

  it("reads an interview transcript as testimony", () => {
    expect(readDocument("Q: Where were you?\nA: At the depot.\n").suggests).toBe("testimony");
  });

  it("reads email headers and a letter as correspondence", () => {
    expect(readDocument("From: a@b.org\nSubject: The van\n").suggests).toBe("correspondence");
    expect(readDocument("Dear Sir,\n\nI write concerning...\n\nYours faithfully,").suggests)
      .toBe("correspondence");
  });

  it("reads a byline as reporting", () => {
    expect(readDocument("By Jane Smith, senior reporter\n\nThe van left...").suggests)
      .toBe("reporting");
  });

  it("reads a comma-separated file as a dataset", () => {
    expect(readDocument("name,date,amount,notes\na,b,c,d\ne,f,g,h\n").suggests).toBe("dataset");
  });

  // Confidently wrong on exactly the documents that matter is the failure a
  // deeper heuristic would produce.
  it("says it does not know rather than guessing at prose", () => {
    const reading = readDocument("The meeting happened. Several people were present.");
    expect(reading.suggests).toBe("other");
    expect(reading.strength).toBe("guess");
    expect(reading.because).toMatch(/Nothing in its opening says what kind of document it is/);
  });

  // Scanning a 200-page bundle for a phrase in an annexure finds the annexure.
  it("reads the opening only", () => {
    const bundle = `${"Ordinary prose. ".repeat(400)}\nIN THE HIGH COURT case no: 1/2\n`;
    expect(readDocument(bundle).suggests).toBe("other");
  });

  it("never claims to have read an image", () => {
    const reading = readByFormat("image");
    expect(reading.suggests).toBe("image");
    expect(reading.because).toMatch(/Nothing has read what is in it/);
  });

  it("says a PDF with no text layer is probably a scan", () => {
    expect(readByFormat("pdf").because).toMatch(/probably a scan/);
  });
});
