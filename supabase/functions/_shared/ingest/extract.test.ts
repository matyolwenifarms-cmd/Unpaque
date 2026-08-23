import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { decodeText, extractText, extractWord, readArchive } from "./extract.ts";

const ascii = (text: string) => new Uint8Array([...text].map((c) => c.charCodeAt(0)));

/** A .docx is a zip of XML, so a real one can be built rather than mocked. */
function wordFile(paragraphs: string[]): Uint8Array {
  const body = paragraphs
    .map((line) => `<w:p><w:r><w:t>${line}</w:t></w:r></w:p>`)
    .join("");
  return zipSync({
    "[Content_Types].xml": strToU8("<Types/>"),
    "word/document.xml": strToU8(`<?xml version="1.0"?><w:document><w:body>${body}</w:body></w:document>`),
  });
}

describe("decoding what a machine actually wrote", () => {
  // Decoded as UTF-8, UTF-16 arrives as text separated by replacement
  // characters, which looks like a corrupt file rather than a wrong decoder.
  it("honours a UTF-16 byte-order mark", () => {
    const utf16 = new Uint8Array([0xff, 0xfe, 0x54, 0x00, 0x68, 0x00, 0x65, 0x00]);
    expect(decodeText(utf16)).toBe("The");
  });

  // It arrives as an invisible character at the front of the first line and
  // breaks a locator's first word.
  it("strips a UTF-8 byte-order mark", () => {
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...ascii("The van")]);
    expect(decodeText(withBom)).toBe("The van");
  });

  it("reads ordinary UTF-8 unchanged", () => {
    expect(decodeText(ascii("The van left."))).toBe("The van left.");
  });
});

describe("plain text", () => {
  it("reads it as one page", () => {
    const extraction = extractText(ascii("The van left before nine."));
    expect(extraction.pages).toEqual([{ number: 1, body: "The van left before nine." }]);
    expect(extraction.says).toBeNull();
  });

  // A locator saying "page 3" should match what somebody holding the printout
  // sees.
  it("splits on form feeds, which is where a printed export puts a page break", () => {
    const extraction = extractText(ascii("Page one.\fPage two.\fPage three."));
    expect(extraction.pages.map((page) => page.number)).toEqual([1, 2, 3]);
    expect(extraction.pages[1]!.body).toBe("Page two.");
  });

  it("drops a blank page rather than numbering it", () => {
    expect(extractText(ascii("One.\f   \fThree.")).pages).toHaveLength(2);
  });

  it("says plainly when there is no text", () => {
    const extraction = extractText(ascii("   \n\n  "));
    expect(extraction.pages).toEqual([]);
    expect(extraction.says).toBe("The file holds no text.");
  });
});

describe("a Word document", () => {
  it("reads its paragraphs", () => {
    const extraction = extractWord(wordFile(["The van left before nine.", "Nobody saw it."]));
    expect(extraction.says).toBeNull();
    expect(extraction.pages[0]!.body).toBe("The van left before nine.\n\nNobody saw it.");
  });

  it("unescapes what XML escaped", () => {
    expect(extractWord(wordFile(["R &amp; S Ltd &lt;the company&gt;"])).pages[0]!.body)
      .toBe("R & S Ltd <the company>");
  });

  // Word stores no page boundaries — they are computed at layout time — so a
  // page number here would be invented.
  it("does not invent page numbers it cannot know", () => {
    expect(extractWord(wordFile(["a", "b", "c"])).pages).toHaveLength(1);
  });

  it("says so when the document holds only images", () => {
    expect(extractWord(wordFile([])).says).toMatch(/holds no text, only images or formatting/);
  });

  it("says so when the zip is not a Word document at all", () => {
    const notWord = zipSync({ "case/notes.txt": strToU8("hello") });
    expect(extractWord(notWord).says).toMatch(/no word\/document\.xml/);
  });

  it("says so when it is not a readable zip", () => {
    expect(extractWord(ascii("not a zip at all")).says).toMatch(/not a readable one/);
  });
});

describe("an archive", () => {
  it("lists what is inside", () => {
    const zip = zipSync({
      "docket.pdf": strToU8("%PDF-1.4"),
      "statements/amy.txt": strToU8("I was at the depot."),
    });
    const archive = readArchive(zip);
    expect(archive.entries.map((entry) => entry.name).sort())
      .toEqual(["docket.pdf", "statements/amy.txt"]);
  });

  // A case folder zipped on a Mac arrives with a __MACOSX tree shadowing every
  // real file, and importing both would double every source in the case.
  it("drops the metadata an operating system slips in", () => {
    const zip = zipSync({
      "docket.pdf": strToU8("%PDF-1.4"),
      "__MACOSX/._docket.pdf": strToU8("junk"),
      ".DS_Store": strToU8("junk"),
      "Thumbs.db": strToU8("junk"),
    });
    expect(readArchive(zip).entries.map((entry) => entry.name)).toEqual(["docket.pdf"]);
  });

  it("drops empty entries rather than importing them as sources", () => {
    const zip = zipSync({ "empty.txt": new Uint8Array(), "real.txt": strToU8("text") });
    expect(readArchive(zip).entries.map((entry) => entry.name)).toEqual(["real.txt"]);
  });

  it("says so when the archive is empty or unreadable", () => {
    expect(readArchive(zipSync({})).says).toBe("The archive holds no files.");
    expect(readArchive(ascii("not a zip")).says).toBe("The archive could not be opened.");
  });
});
