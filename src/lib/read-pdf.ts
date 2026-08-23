import type { Page, ReadPdf } from "@shared/ingest/extract.ts";

/**
 * A PDF's text, one entry per page.
 *
 * Loaded on demand and never at startup. pdfjs is about a megabyte, and the
 * overwhelming majority of people who open a case never upload a PDF —
 * making everybody download it so that some can is the kind of cost that lands
 * on whoever has the worst connection.
 *
 * The worker is disabled deliberately. It is faster with one, and setting one
 * up means shipping a second bundle and telling Vite where it went; on a
 * document a person is waiting for, correctness of the page numbering matters
 * and a second of parsing does not. If this ever handles a thousand-page bundle
 * routinely, that is when to pay for the worker.
 */
export const readPdf: ReadPdf = async (bytes) => {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "";

  const document = await pdfjs.getDocument({
    // Copied, because pdfjs transfers the buffer it is given and the caller
    // still needs these bytes to hash them.
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    isEvalSupported: false,
  }).promise;

  const pages: Page[] = [];
  for (let number = 1; number <= document.numPages; number += 1) {
    const page = await document.getPage(number);
    const content = await page.getTextContent();

    // Joined by the gaps pdfjs reports rather than by spaces. A PDF stores
    // words as separately positioned runs, so naive joining gives
    // "T h e v a n" on some documents and "Thevanleft" on others.
    let text = "";
    let lastY: number | null = null;
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) text += "\n";
      text += item.str;
      if (item.hasEOL) text += "\n";
      lastY = y;
    }

    const body = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    // A blank page is dropped rather than numbered, and the numbering still
    // matches the document: page 3 stays page 3 when page 2 is a blank divider.
    if (body !== "") pages.push({ number, body });
  }

  await document.destroy();
  return pages;
};
