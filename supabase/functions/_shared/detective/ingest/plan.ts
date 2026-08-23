// One pile of files in, a list somebody can check out.
//
// This is what the upload portal is for: a police officer or a documentary
// researcher hands over a folder — dockets, statements, a zip somebody
// emailed them, photographs of paper — and gets back a list saying what each
// one appears to be, what was read out of it, and what was not.
//
// **Nothing here imports anything.** It produces a plan, and the person
// confirms it. That is the whole design: a docket filed as a witness statement
// corrupts independent support, contradiction detection and the timeline, and
// the officer can tell in two seconds what no heuristic can. The machine shows
// its reasons and gets out of the way.
//
// The other rule is that **a file that yields no text is still a source.** Most
// of a real case file is photographs of paper. Dropping them would quietly
// shrink the case to whatever happened to be typed, so they arrive marked
// rather than missing.

import { detect, type Detection, type FileKind } from "../../ingest/kind.ts";
import { extractText, extractWord, readArchive, type Page, type ReadPdf } from "../../ingest/extract.ts";
import { DEFAULT_READ_TIMEOUT_MS, TIMED_OUT, inSeconds, withinTime } from "../../ingest/timeout.ts";

export type { ReadPdf };
import { readByFormat, readDocument, type Reading } from "./classify.ts";

export interface IncomingFile {
  name: string;
  bytes: Uint8Array;
}

export interface PlannedSource {
  /** Stable within a plan, so the review screen can address one row. */
  id: string;
  name: string;
  /** Where it came from, when it was inside an archive. */
  within?: string;
  size: number;
  detection: Detection;
  reading: Reading;
  pages: Page[];
  /** Why there is no text, where there is none. */
  says: string | null;
  /** Same bytes as an earlier file in this plan. */
  duplicateOf?: string;
  contentHash: string;
}

export interface Plan {
  sources: PlannedSource[];
  /** Files that were opened as archives rather than imported. */
  archives: string[];
  /** Nothing to import, and why. */
  says: string | null;
}

/** How deep a nested archive is followed. */
export const MAX_ARCHIVE_DEPTH = 3;

async function hash(bytes: Uint8Array): Promise<string> {
  // Copied into a fresh buffer: a Uint8Array view over a larger ArrayBuffer
  // hashes the whole buffer, so two different files sharing one allocation
  // would hash identically.
  const copy = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}


/**
 * Read a pile of files, expanding archives, and say what each one is.
 *
 * `readPdf` is passed in rather than imported: pdfjs is a megabyte and exists
 * only where there is a DOM or a Node, and this module is imported by the Edge
 * Runtime too. Absent, a PDF arrives as a source with no text and says so —
 * which is the same state a scan arrives in, and correct.
 */
export interface PlanOptions {
  /**
   * How long one file gets before the rest of the upload goes on without it.
   *
   * Settable so a test can use fifty milliseconds. Left at the default it is
   * thirty seconds, which is long enough for a three-hundred-page bundle on a
   * slow machine and short enough that somebody watching a spinner finds out.
   */
  readTimeoutMs?: number;
}

export async function planImport(
  files: readonly IncomingFile[],
  readPdf?: ReadPdf,
  options: PlanOptions = {},
): Promise<Plan> {
  const readTimeoutMs = options.readTimeoutMs ?? DEFAULT_READ_TIMEOUT_MS;
  const sources: PlannedSource[] = [];
  const archives: string[] = [];
  const seen = new Map<string, string>();
  let counter = 0;

  async function take(file: IncomingFile, within: string | undefined, depth: number): Promise<void> {
    const detection = detect(file.name, file.bytes);

    if (detection.kind === "archive") {
      if (depth >= MAX_ARCHIVE_DEPTH) {
        // Not silently skipped. A bundle nested deeper than this is unusual
        // enough that somebody should look at it rather than wonder later why
        // a hundred files are missing.
        sources.push(await planned(file, within, detection, [], `Archives nested more than ${MAX_ARCHIVE_DEPTH} deep are not opened. Unzip this one and upload what is inside.`));
        return;
      }
      const archive = readArchive(file.bytes);
      archives.push(file.name);
      if (archive.says !== null) {
        sources.push(await planned(file, within, detection, [], archive.says));
        return;
      }
      for (const entry of archive.entries) {
        await take({ name: entry.name, bytes: entry.bytes }, file.name, depth + 1);
      }
      return;
    }

    if (detection.kind === "word") {
      const extraction = extractWord(file.bytes);
      sources.push(await planned(file, within, detection, extraction.pages, extraction.says));
      return;
    }

    if (detection.kind === "text" || detection.kind === "email") {
      const extraction = extractText(file.bytes);
      sources.push(await planned(file, within, detection, extraction.pages, extraction.says));
      return;
    }

    if (detection.kind === "pdf" && readPdf) {
      const pages = await withinTime(readPdf(file.bytes), readTimeoutMs);
      if (pages === TIMED_OUT) {
        sources.push(await planned(
          file, within, detection, [],
          `Reading this PDF took longer than ${inSeconds(readTimeoutMs)} and was given up on. The rest of the upload is unaffected. It may be very long, or damaged.`,
        ));
        return;
      }
      sources.push(await planned(
        file, within, detection, pages,
        pages.length === 0 ? "The PDF has no text layer, so it is probably a scan. Nothing has read what is in it." : null,
      ));
      return;
    }

    sources.push(await planned(
      file, within, detection, [],
      detection.kind === "pdf"
        ? "Nothing read this PDF."
        : `No text is extracted from ${detection.kind.replace(/_/g, " ")} files.`,
    ));
  }

  async function planned(
    file: IncomingFile,
    within: string | undefined,
    detection: Detection,
    pages: Page[],
    says: string | null,
  ): Promise<PlannedSource> {
    const contentHash = await hash(file.bytes);
    const duplicateOf = seen.get(contentHash);
    if (duplicateOf === undefined) seen.set(contentHash, file.name);

    const text = pages.map((page) => page.body).join("\n\n");
    return {
      id: `f${(counter += 1)}`,
      name: file.name,
      ...(within === undefined ? {} : { within }),
      size: file.bytes.length,
      detection,
      reading: text.trim() === "" ? readByFormat(detection.kind) : readDocument(text),
      pages,
      says,
      ...(duplicateOf === undefined ? {} : { duplicateOf }),
      contentHash,
    };
  }

  for (const file of files) {
    // Each file on its own. A batch is a folder somebody dragged in, and one
    // unreadable document among forty is a fact about that document -- not a
    // reason to lose the other thirty-nine, which is what an unguarded await
    // in this loop did.
    try {
      await take(file, undefined, 0);
    } catch (error) {
      sources.push(await planned(
        file, undefined, detect(file.name, file.bytes), [],
        `This file could not be read: ${error instanceof Error ? error.message : String(error)}. The rest of the upload is unaffected.`,
      ));
    }
  }

  return {
    sources,
    archives,
    says: sources.length === 0
      ? files.length === 0
        ? "No files were chosen."
        : "Nothing in what was uploaded could be imported."
      : null,
  };
}

/** What the review screen says at the top, so nobody has to count rows. */
export function summarise(plan: Plan): string {
  const total = plan.sources.length;
  if (total === 0) return plan.says ?? "Nothing to import.";

  const parts = [`${total} ${total === 1 ? "file" : "files"}`];
  if (plan.archives.length > 0) {
    parts.push(`from ${plan.archives.length} ${plan.archives.length === 1 ? "archive" : "archives"}`);
  }

  const withoutText = plan.sources.filter((source) => source.pages.length === 0).length;
  const duplicates = plan.sources.filter((source) => source.duplicateOf !== undefined).length;
  const disagreements = plan.sources.filter((source) => source.detection.disagreement).length;

  const notes: string[] = [];
  // Said as a count rather than left to be discovered row by row. A researcher
  // with forty files will not read forty rows, and these three are the ones
  // that change what they should do next.
  if (withoutText > 0) {
    notes.push(`${withoutText} held no readable text, which for a scan is expected`);
  }
  if (duplicates > 0) notes.push(`${duplicates} are copies of another file here`);
  if (disagreements > 0) {
    notes.push(`${disagreements} are not the format their name claims`);
  }

  return notes.length === 0
    ? `${parts.join(" ")}, all readable.`
    : `${parts.join(" ")}. ${notes.join("; ")}.`;
}

/** The kinds nothing can read text out of, for the screen to explain once. */
export const UNREADABLE_KINDS: readonly FileKind[] = [
  "image", "spreadsheet", "presentation", "rich_text", "unknown",
];
