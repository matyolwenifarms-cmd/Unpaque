// Flattening a paper for coding, without losing the page.
//
// The coding surface works over one flat body and stores a coding as a pair of
// offsets into it. A paper is stored as pages. Coding a paper means flattening
// it, and flattening it naively throws away the one thing pages were kept for:
// a quotation that says "page 42" and means it.
//
// So the flattening is recorded rather than performed and forgotten.
// `pageStarts[i]` is where page i + 1 begins in the body, which makes every
// offset reversible. Nothing stores a page number against a coding, because a
// derived value kept beside the thing it derives from is a value that can
// disagree with it — and here that disagreement is a citation pointing at a
// page the sentence is not on.
//
// `page_at()` in `20260823100000_coding_a_paper.sql` is the same arithmetic in
// SQL, and `flatten.test.ts` holds the two to the same table of cases.

/** Between pages. Two newlines, so a paragraph break is still a paragraph break. */
export const PAGE_JOINER = "\n\n";

export interface Flattened {
  body: string;
  /** Character offset where each page begins. Always starts at 0. */
  pageStarts: number[];
}

export function flattenPages(pages: readonly { number: number; body: string }[]): Flattened {
  const parts: string[] = [];
  const pageStarts: number[] = [];
  let at = 0;

  for (const page of pages) {
    pageStarts.push(at);
    parts.push(page.body);
    at += page.body.length + PAGE_JOINER.length;
  }

  return { body: parts.join(PAGE_JOINER), pageStarts };
}

/**
 * Which page an offset falls on, 1-based.
 *
 * The boundary belongs to the page it opens, not the one it closes. Either
 * convention is defensible and the two must not differ between here and the
 * database, so it is stated rather than left to whichever comparison each
 * happened to be written with: the page is the last one whose start is not
 * greater than the offset.
 *
 * The whole array is walked rather than stopped at the first start past the
 * offset. Stopping early gives the same answer for every map the check
 * constraint allows — they increase, so nothing after the first miss can
 * match either — which makes the early exit a branch no input can
 * distinguish. It came out.
 */
export function pageAt(pageStarts: readonly number[], offset: number): number {
  let page = 1;
  for (let index = 0; index < pageStarts.length; index += 1) {
    if (pageStarts[index]! <= offset) page = index + 1;
  }
  return page;
}

/**
 * Where a coding sits, as a citation.
 *
 * Returns nothing for a document that was pasted rather than read out of a
 * paper. A transcript has no pages, and inventing "page 1" for one is a
 * locator that looks checkable and is not.
 */
export function citeAt(
  pageStarts: readonly number[] | null | undefined,
  offset: number,
): string | null {
  if (!pageStarts || pageStarts.length === 0) return null;
  return `page ${pageAt(pageStarts, offset)}`;
}
