// Getting readable text out of a file, and saying so when there is none.
//
// The half of the upload portal that decides whether anything downstream
// works. A page of text with a page number is a locator; a page of nothing is
// a source that cannot be quoted, and the difference has to reach the screen
// rather than being averaged away into "imported 40 files".
//
// **A scan is not a failure and must not be reported as one.** Most of a real
// case file is photographs of paper. Those extract nothing, correctly, and the
// portal says "no text layer, probably a scan" rather than "could not read" —
// because the first is a fact about the document and the second sounds like a
// bug in the software.
//
// PDF is deliberately absent from this module. It needs pdfjs, which is a
// megabyte and only exists in a browser or Node, and `_shared` is imported by
// both the Edge Runtime and the browser. The browser layer loads it lazily and
// calls in here for everything else.

import { unzipSync } from "fflate";

export interface Page {
  /** 1-based, so a locator reads "page 42" and means it. */
  number: number;
  body: string;
}

export interface Extraction {
  pages: Page[];
  /** Why there is no text, where there is none. Never null when pages is empty. */
  says: string | null;
}

const decoder = new TextDecoder("utf-8", { fatal: false });
const utf16le = new TextDecoder("utf-16le");
const utf16be = new TextDecoder("utf-16be");

/**
 * Bytes to a string, honouring a byte-order mark.
 *
 * Windows exports UTF-16 far more often than anybody expects, and decoded as
 * UTF-8 it arrives as text separated by replacement characters — which looks
 * like a corrupt file rather than a wrong decoder.
 */
export function decodeText(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return utf16le.decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return utf16be.decode(bytes.subarray(2));
  }
  // A UTF-8 BOM is stripped, because it arrives as an invisible character at
  // the front of the first line and breaks a locator's first word.
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return decoder.decode(bytes.subarray(3));
  }
  return decoder.decode(bytes);
}

/** Plain text, split into pages on form feeds where a printer put them. */
export function extractText(bytes: Uint8Array): Extraction {
  const text = decodeText(bytes);
  if (text.trim() === "") return { pages: [], says: "The file holds no text." };

  // \f is what a printed export uses between pages. Splitting on it means a
  // locator says "page 3" and matches what somebody holding the printout sees.
  const parts = text.split("\f");
  return {
    pages: parts
      .map((body, index) => ({ number: index + 1, body: body.trim() }))
      .filter((page) => page.body !== ""),
    says: null,
  };
}

/**
 * A .docx, which is a zip of XML.
 *
 * Paragraphs are `<w:p>` and the text inside them is in `<w:t>`. Everything
 * else — styling, revision marks, comments — is discarded, and comments
 * being discarded is worth knowing: a tracked-changes document read this way
 * loses the argument in its margin.
 */
export function extractWord(bytes: Uint8Array): Extraction {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return { pages: [], says: "It is named as a Word document but is not a readable one." };
  }

  const document = files["word/document.xml"];
  if (!document) {
    return {
      pages: [],
      says: "It is a zip archive with no word/document.xml, so it is not a Word document.",
    };
  }

  const xml = decodeText(document);
  const paragraphs: string[] = [];
  for (const block of xml.split(/<w:p[ >]/).slice(1)) {
    const runs = [...block.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
      .map((match) => match[1] ?? "");
    const line = unescapeXml(runs.join("")).trim();
    if (line !== "") paragraphs.push(line);
  }

  if (paragraphs.length === 0) {
    return { pages: [], says: "The document holds no text, only images or formatting." };
  }

  // One page. Word stores no page boundaries — they are computed at layout
  // time by whatever opens it — so a page number here would be invented, and a
  // locator saying "page 7" of a document with no pages is worse than one
  // saying "paragraph 30".
  return { pages: [{ number: 1, body: paragraphs.join("\n\n") }], says: null };
}

function unescapeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export interface ArchiveEntry {
  name: string;
  bytes: Uint8Array;
}

/**
 * What is inside a zip.
 *
 * Directories and the metadata files an operating system slips in are dropped:
 * a case folder zipped on a Mac arrives with a __MACOSX tree shadowing every
 * real file, and importing both would double every source in the case.
 */
export function readArchive(bytes: Uint8Array): { entries: ArchiveEntry[]; says: string | null } {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return { entries: [], says: "The archive could not be opened." };
  }

  const entries = Object.entries(files)
    .filter(([name, content]) => {
      if (name.endsWith("/")) return false;
      if (content.length === 0) return false;
      const base = name.split("/").pop() ?? "";
      if (base.startsWith(".")) return false;
      if (name.startsWith("__MACOSX/")) return false;
      if (base === "Thumbs.db" || base === "desktop.ini") return false;
      return true;
    })
    .map(([name, content]) => ({ name, bytes: content }));

  return {
    entries,
    says: entries.length === 0 ? "The archive holds no files." : null,
  };
}
