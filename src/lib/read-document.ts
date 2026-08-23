import { detect } from "@shared/ingest/kind.ts";
import { extractText, extractWord } from "@shared/ingest/extract.ts";
import { readPdf } from "./read-pdf.ts";

export interface ReadResult {
  text: string;
  /** Why there is no text, where there is none. Never null when text is empty. */
  says: string | null;
}

function textOf(pages: readonly { body: string }[]): string {
  return pages.map((page) => page.body).join("\n\n");
}

function describe(kind: string): string {
  if (kind === "spreadsheet") return "a spreadsheet";
  if (kind === "presentation") return "a presentation";
  if (kind === "archive") return "an archive";
  if (kind === "image") return "an image";
  if (kind === "email") return "an email";
  if (kind === "rich_text") return "a rich text file";
  return "a kind of file this cannot read";
}

/**
 * One document, as text, from whatever a person happened to hand over.
 *
 * The Detect portal has `planImport` for this and it does much more: expands
 * archives, hashes, deduplicates, and classifies each file as a kind of
 * evidence. A student uploading one proposal needs none of it, and the
 * classification in particular would be actively wrong — a proposal is not
 * a witness statement, and putting one of those labels on screen would teach
 * them the tool has misunderstood what they handed over.
 *
 * So this is the small version: what is it, get the text out, and say why
 * there is none when there is none. The distinction between "no text layer"
 * and "could not read it" is kept, because the first is a fact about the
 * document and the second sounds like a fault in the software.
 *
 * Nothing is decoded on a guess. `detect` already routes anything without
 * binary bytes to `text`, so a file that reaches it as `unknown` is not text
 * — and decoding it anyway produces a page of control characters that the
 * report then runs on, finding no references in a document that has forty.
 * Saying what it appears to be, and what this can read, is the whole of the
 * useful answer.
 */
export async function readDocumentFile(file: File): Promise<ReadResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detection = detect(file.name, bytes);

  if (detection.kind === "pdf") {
    const text = textOf(await readPdf(bytes));
    if (text.trim() !== "") return { text, says: null };
    return {
      text: "",
      says: "This PDF has no text layer, so it is probably a scan or a photograph of paper. A proposal exported from a word processor will have one.",
    };
  }

  if (detection.kind === "word" || detection.kind === "text") {
    const extraction = detection.kind === "word" ? extractWord(bytes) : extractText(bytes);
    const text = textOf(extraction.pages);
    return text.trim() === "" ? { text: "", says: extraction.says } : { text, says: null };
  }

  return {
    text: "",
    says: `This looks like ${describe(detection.kind)}, and there is no text in it to read. A PDF, a Word document (.docx) or a plain text file is what this can read.`,
  };
}
