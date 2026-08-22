import { describe, expect, it } from "vitest";
import { MAX_TERMS, VERBATIM_LIMIT, queryTermsFrom } from "./terms.ts";

describe("turning a paste into a query", () => {
  it("leaves a typed query exactly alone", () => {
    const result = queryTermsFrom("media framing of protest movements");
    expect(result.reduced).toBe(false);
    expect(result.query).toBe("media framing of protest movements");
  });

  it("trims and collapses whitespace without calling that a reduction", () => {
    const result = queryTermsFrom("  media   framing\n\nof protest  ");
    expect(result.reduced).toBe(false);
    expect(result.query).toBe("media framing of protest");
  });

  // The case that produced the bug: a proposal pasted whole.
  it("reduces a pasted proposal to its subject", () => {
    const proposal = `
      This study examines media framing of student protest movements in South
      African news coverage. The research aims to analyse how framing devices in
      press reporting shape public understanding of protest. The study will
      examine framing in three newspapers, and the analysis will consider how
      protest coverage constructs legitimacy. The literature on media framing of
      protest is extensive, and this dissertation seeks to contribute to it.
    `;
    const result = queryTermsFrom(proposal);
    expect(result.reduced).toBe(true);
    expect(result.terms).toContain("framing");
    expect(result.terms).toContain("protest");
    expect(result.terms).toContain("media");
    // The register of a proposal must not survive into the query: these are in
    // the title of everything and therefore select nothing.
    for (const noise of ["study", "research", "analysis", "literature", "dissertation", "examine"]) {
      expect(result.terms).not.toContain(noise);
    }
    expect(result.query).not.toMatch(/\bthis\b|\bthe\b|\bwill\b/i);
  });

  it("caps the number of terms", () => {
    const long = Array.from({ length: 60 }, (_, index) => `distinctword${index}`).join(" ");
    const result = queryTermsFrom(long);
    expect(result.terms.length).toBe(MAX_TERMS);
  });

  it("ranks by how often a term is used, then by where it first appears", () => {
    const text = `alpha ${"bravo ".repeat(5)}${"charlie ".repeat(3)}`.padEnd(VERBATIM_LIMIT + 40, " delta");
    const result = queryTermsFrom(text);
    expect(result.terms.indexOf("bravo")).toBeLessThan(result.terms.indexOf("charlie"));
  });

  it("is stable: the same paste produces the same query", () => {
    const paste = "framing framing protest protest media coverage legitimacy ".repeat(6);
    expect(queryTermsFrom(paste).query).toBe(queryTermsFrom(paste).query);
  });

  // \w would cut this word in half and drop the accented terms entirely, and a
  // literature is not only in English.
  it("keeps non-ASCII words whole", () => {
    const text = `Öffentlichkeit und Medienrahmung ${"Öffentlichkeit ".repeat(10)}`.padEnd(
      VERBATIM_LIMIT + 20,
      " Medienrahmung",
    );
    const result = queryTermsFrom(text);
    expect(result.reduced).toBe(true);
    expect(result.terms).toContain("Öffentlichkeit");
  });

  // A query of "" would return the corpus ordered by nothing at all.
  it("falls back to the original when every word is a stopword", () => {
    const text = "the study of the research of the analysis of the study ".repeat(4);
    const result = queryTermsFrom(text);
    expect(result.query).not.toBe("");
    expect(result.reduced).toBe(false);
  });

  it("drops bare numbers and very short words", () => {
    const text = `2019 2020 framing of protest ${"framing protest legitimacy ".repeat(8)}`;
    const result = queryTermsFrom(text);
    expect(result.terms).not.toContain("2019");
    expect(result.terms).not.toContain("of");
  });
});
