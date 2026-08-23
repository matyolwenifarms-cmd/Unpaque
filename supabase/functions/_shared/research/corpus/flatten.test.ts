import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PAGE_JOINER, citeAt, flattenPages, pageAt } from "./flatten.ts";

const MIGRATION = readFileSync(
  "supabase/migrations/20260823100000_coding_a_paper.sql",
  "utf8",
);

const PAGES = [
  { number: 1, body: "page one text" },
  { number: 2, body: "page two text" },
  { number: 3, body: "page three" },
];

describe("flattening a paper", () => {
  it("joins the pages and records where each begins", () => {
    const { body, pageStarts } = flattenPages(PAGES);
    expect(body).toBe("page one text\n\npage two text\n\npage three");
    expect(pageStarts).toEqual([0, 15, 30]);
  });

  it("puts every page start on the first character of that page", () => {
    const { body, pageStarts } = flattenPages(PAGES);
    for (const [index, page] of PAGES.entries()) {
      expect(body.slice(pageStarts[index]!, pageStarts[index]! + page.body.length))
        .toBe(page.body);
    }
  });

  it("handles one page, and none", () => {
    expect(flattenPages([{ number: 1, body: "only" }])).toEqual({ body: "only", pageStarts: [0] });
    expect(flattenPages([])).toEqual({ body: "", pageStarts: [] });
  });
});

// The same table of cases the SQL suite asserts against `public.page_at`. The
// two implementations must not drift, and the boundary is the half most likely
// to: either convention is defensible, and only one of them is right in both.
describe("reading an offset back to a page", () => {
  const starts = [0, 15];

  it("reads an offset on the first page as page 1", () => {
    expect(pageAt(starts, 3)).toBe(1);
  });

  it("reads an offset past the boundary as page 2", () => {
    expect(pageAt(starts, 20)).toBe(2);
  });

  it("gives the boundary itself to the page it opens", () => {
    expect(pageAt(starts, 15)).toBe(2);
  });

  it("does not run off the end", () => {
    expect(pageAt(starts, 10_000)).toBe(2);
    expect(pageAt([], 5)).toBe(1);
  });

  it("agrees with itself over a whole flattened document", () => {
    const { pageStarts } = flattenPages(PAGES);
    expect(pageAt(pageStarts, 0)).toBe(1);
    expect(pageAt(pageStarts, 14)).toBe(1);
    expect(pageAt(pageStarts, 15)).toBe(2);
    expect(pageAt(pageStarts, 29)).toBe(2);
    expect(pageAt(pageStarts, 30)).toBe(3);
  });
});

describe("the database still holds the other half", () => {
  it("defines page_at, and defines it the same way round", () => {
    expect(MIGRATION).toContain("create or replace function public.page_at");
    // `<=`, so the boundary belongs to the page it opens. A `<` here and the
    // two implementations disagree by one page on every page break.
    expect(MIGRATION).toMatch(/where p_page_starts\[i\] <= p_offset/);
  });

  it("refuses a map that does not start at nought or does not increase", () => {
    expect(MIGRATION).toContain("p_page_starts[1] = 0");
    expect(MIGRATION).toMatch(/p_page_starts\[i\] <= p_page_starts\[i - 1\]/);
  });

  // Negative control for the three readers above.
  it("finds none of that in a migration that has none of it", () => {
    expect(/create or replace function public\.page_at/.test("select 1;")).toBe(false);
    expect(/where p_page_starts\[i\] <= p_offset/.test("select 1;")).toBe(false);
  });
});

describe("citing a coding", () => {
  it("names the page for a document read out of a paper", () => {
    expect(citeAt(flattenPages(PAGES).pageStarts, 16)).toBe("page 2");
  });

  // A transcript has no pages, and inventing "page 1" for one is a locator
  // that looks checkable and is not.
  it("says nothing for a transcript that was pasted in", () => {
    expect(citeAt(null, 16)).toBeNull();
    expect(citeAt([], 16)).toBeNull();
  });

  it("uses the joiner the flattener uses", () => {
    expect(PAGE_JOINER).toBe("\n\n");
  });
});
