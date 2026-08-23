// What a file actually is, read from its bytes.
//
// The first thing an upload portal has to get right, and the one it usually
// gets wrong: **extensions lie**. A docket exported from a case management
// system and saved as `.doc` is a PDF about a third of the time; a `.txt` from
// a Windows machine is often UTF-16; a `.zip` from a phone is sometimes a
// single file with a zip name. Trusting the extension means a police officer's
// upload silently fails to extract and nobody finds out until the case is
// built on nothing.
//
// So the extension is read, the bytes are read, and **a disagreement between
// them is reported rather than resolved.** A renamed file is the interesting
// case: it is either an export quirk or somebody hiding something, and neither
// is a decision this module should make quietly.

export const FILE_KINDS = [
  "pdf", "word", "spreadsheet", "presentation", "archive",
  "image", "text", "rich_text", "email", "unknown",
] as const;
export type FileKind = (typeof FILE_KINDS)[number];

export interface Detection {
  kind: FileKind;
  /** How it was decided, in a sentence somebody can check. */
  because: string;
  /**
   * Set where the extension claims something the bytes do not support.
   *
   * Not resolved silently. A file whose name says .doc and whose bytes say PDF
   * is either an export quirk or somebody hiding something, and both are worth
   * a person seeing.
   */
  disagreement?: string;
}

function startsWith(bytes: Uint8Array, signature: readonly number[], at = 0): boolean {
  if (bytes.length < at + signature.length) return false;
  return signature.every((byte, index) => bytes[at + index] === byte);
}

/** Bytes as ASCII, for looking inside an archive's central directory. */
function asAscii(bytes: Uint8Array, limit = 4096): string {
  let text = "";
  for (let index = 0; index < Math.min(bytes.length, limit); index += 1) {
    text += String.fromCharCode(bytes[index]!);
  }
  return text;
}

const PDF = [0x25, 0x50, 0x44, 0x46]; // %PDF
const ZIP = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04, a local file header
// An archive holding nothing has no local file header at all: it is the
// end-of-central-directory record on its own. Without this it reads as text
// (it has no NUL bytes), and the person is told their empty zip is a text
// file rather than that it is empty.
const ZIP_EMPTY = [0x50, 0x4b, 0x05, 0x06];
const ZIP_SPANNED = [0x50, 0x4b, 0x07, 0x08];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const PNG = [0x89, 0x50, 0x4e, 0x47];
const JPEG = [0xff, 0xd8, 0xff];
const GIF = [0x47, 0x49, 0x46, 0x38];
const RTF = [0x7b, 0x5c, 0x72, 0x74, 0x66]; // {\rtf

/**
 * What an OOXML archive holds.
 *
 * A .docx, .xlsx and .pptx are all zips and differ only in what is inside. The
 * whole file is not scanned: the names appear in the local headers near the
 * front, and reading four kilobytes is enough for every one produced by Office
 * or LibreOffice.
 */
function insideZip(bytes: Uint8Array): FileKind {
  const head = asAscii(bytes);
  if (head.includes("word/")) return "word";
  if (head.includes("xl/")) return "spreadsheet";
  if (head.includes("ppt/")) return "presentation";
  return "archive";
}

const EXTENSION_KINDS: Record<string, FileKind> = {
  pdf: "pdf",
  doc: "word", docx: "word", odt: "word",
  xls: "spreadsheet", xlsx: "spreadsheet", csv: "text", ods: "spreadsheet",
  ppt: "presentation", pptx: "presentation",
  zip: "archive",
  png: "image", jpg: "image", jpeg: "image", gif: "image", tif: "image", tiff: "image",
  txt: "text", md: "text", log: "text",
  rtf: "rich_text",
  eml: "email", msg: "email",
};

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

/**
 * Whether a run of bytes reads as text.
 *
 * A NUL byte in the first few kilobytes is the reliable tell: no text encoding
 * a case file arrives in uses one, and every binary format does. UTF-16 is
 * caught by its byte-order mark rather than by the NULs it is full of, which
 * would otherwise make every Windows-exported .txt look binary.
 */
export function looksLikeText(bytes: Uint8Array): boolean {
  if (startsWith(bytes, [0xff, 0xfe]) || startsWith(bytes, [0xfe, 0xff])) return true;
  const window = Math.min(bytes.length, 4096);
  for (let index = 0; index < window; index += 1) {
    if (bytes[index] === 0) return false;
  }
  return true;
}

/** What this file is, and how that was decided. */
export function detect(name: string, bytes: Uint8Array): Detection {
  const extension = extensionOf(name);
  const claimed = EXTENSION_KINDS[extension];

  const settle = (kind: FileKind, because: string): Detection => {
    // The extension is allowed to be more specific than the bytes — a .csv is
    // text and a .md is text — so a disagreement is only reported where the
    // extension names a different *format*, not a narrower one.
    if (claimed !== undefined && claimed !== kind && !(kind === "text" && claimed === "text")) {
      return {
        kind,
        because,
        disagreement: `The name says ${extension} but the file is ${kind.replace(/_/g, " ")}. Nothing has been renamed; this is what the bytes are.`,
      };
    }
    return { kind, because };
  };

  if (bytes.length === 0) return { kind: "unknown", because: "The file is empty." };
  if (startsWith(bytes, PDF)) return settle("pdf", "It begins with %PDF.");
  if (startsWith(bytes, ZIP_EMPTY)) {
    return settle("archive", "It is a zip archive with nothing in it.");
  }
  if (startsWith(bytes, ZIP_SPANNED)) {
    return settle("archive", "It is a spanned zip archive.");
  }
  if (startsWith(bytes, ZIP)) {
    const inside = insideZip(bytes);
    return settle(
      inside,
      inside === "archive"
        ? "It is a zip archive, and does not hold a Word, Excel or PowerPoint document."
        : `It is a zip archive holding ${inside === "word" ? "word/" : inside === "spreadsheet" ? "xl/" : "ppt/"} entries.`,
    );
  }
  if (startsWith(bytes, OLE)) {
    // The old binary Office formats share one container, and telling .doc from
    // .xls inside it needs the compound-file directory. The extension is the
    // better evidence here and is used, with the container as the reason.
    return {
      kind: claimed ?? "word",
      because: "It is an old binary Office document, and the container does not say which application wrote it.",
    };
  }
  if (startsWith(bytes, RTF)) return settle("rich_text", "It begins with {\\rtf.");
  if (startsWith(bytes, PNG)) return settle("image", "It is a PNG.");
  if (startsWith(bytes, JPEG)) return settle("image", "It is a JPEG.");
  if (startsWith(bytes, GIF)) return settle("image", "It is a GIF.");

  if (looksLikeText(bytes)) {
    const head = asAscii(bytes, 512);
    // An .eml is text with headers. Checked before plain text, because an
    // email holding a case's whole correspondence is a different thing to
    // read than a note.
    if (/^(?:From|To|Subject|Date|Message-ID):/mi.test(head)) {
      return settle("email", "It begins with email headers.");
    }
    return settle("text", "It holds no binary bytes, so it reads as text.");
  }

  return {
    kind: "unknown",
    because: "Its first bytes match no format this recognises, and it is not text.",
    ...(claimed ? { disagreement: `The name says ${extension}, and the bytes do not support it.` } : {}),
  };
}
