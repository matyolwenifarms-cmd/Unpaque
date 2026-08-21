// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReferenceList } from "./ReferenceList.tsx";
import type { SearchedReference } from "@/lib/research-api.ts";

function reference(overrides: Partial<SearchedReference> = {}): SearchedReference {
  return {
    id: "doi:10.1000/abc",
    source: "crossref",
    sources: ["crossref", "openalex"],
    doi: "10.1000/abc",
    title: "A paper about framing",
    authors: [{ name: "Ada Researcher" }, { name: "Bo Colleague" }],
    year: 2024,
    venue: "Journal of Fixtures",
    preprint: false,
    retraction: "none",
    openAccess: false,
    verification: "verified",
    availability: "metadata_only",
    caveat: null,
    quotationCaveat: null,
    ...overrides,
  } as SearchedReference;
}

describe("a reference row", () => {
  it("shows title, authors, year and venue", () => {
    render(<ReferenceList references={[reference()]} />);
    expect(screen.getByText("A paper about framing")).toBeInTheDocument();
    expect(screen.getByText(/Ada Researcher, Bo Colleague · 2024 · Journal of Fixtures/)).toBeInTheDocument();
  });

  it("abbreviates a long author list rather than truncating silently", () => {
    render(<ReferenceList references={[reference({
      authors: [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }, { name: "E" }],
    })]} />);
    expect(screen.getByText(/A, B, C and 2 others/)).toBeInTheDocument();
  });

  it("says so rather than showing an empty line when there are no authors", () => {
    render(<ReferenceList references={[reference({ authors: [] })]} />);
    expect(screen.getByText(/No authors listed/)).toBeInTheDocument();
  });

  it("keeps the provenance visible", () => {
    render(<ReferenceList references={[reference()]} />);
    expect(screen.getByText("crossref + openalex")).toBeInTheDocument();
  });

  it("marks an unverified reference as unverified", () => {
    render(<ReferenceList references={[reference({ verification: "provider_only" })]} />);
    expect(screen.getByText("unverified")).toBeInTheDocument();
  });

  it("links a DOI to where it resolves", () => {
    render(<ReferenceList references={[reference()]} />);
    expect(screen.getByRole("link", { name: /10\.1000\/abc/ }))
      .toHaveAttribute("href", "https://doi.org/10.1000/abc");
  });

  it("offers a full-text link only when there is one", () => {
    const { rerender } = render(<ReferenceList references={[reference()]} />);
    expect(screen.queryByRole("link", { name: /full text/i })).not.toBeInTheDocument();
    rerender(<ReferenceList references={[reference({
      availability: "full_text",
      fullText: { url: "https://x/1.pdf", version: "published" },
    })]} />);
    expect(screen.getByRole("link", { name: /full text/i })).toHaveAttribute("href", "https://x/1.pdf");
  });
});

describe("caveats", () => {
  // Retraction is the one that gets destructive colouring. Colouring every
  // caveat the same teaches a reader to skim past the one that matters.
  it("renders a retraction with a warning icon and destructive styling", () => {
    const { container } = render(<ReferenceList references={[reference({
      retraction: "confirmed", caveat: "Retracted",
    })]} />);
    const caveat = screen.getByText("Retracted");
    expect(caveat.closest("p")?.className).toMatch(/red/);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders a contested retraction as severe too — it is still a reason not to cite", () => {
    render(<ReferenceList references={[reference({
      retraction: "contested",
      caveat: "Possibly retracted — sources disagree, check before citing",
    })]} />);
    expect(screen.getByText(/Possibly retracted/).closest("p")?.className).toMatch(/red/);
  });

  it("renders a preprint label without destructive colouring", () => {
    render(<ReferenceList references={[reference({
      preprint: true, caveat: "Preprint — not peer reviewed",
    })]} />);
    expect(screen.getByText(/Preprint/).closest("p")?.className).not.toMatch(/red/);
  });

  it("shows the quotation caveat only where there is full text to quote", () => {
    const { rerender } = render(<ReferenceList references={[reference({
      quotationCaveat: "Accepted manuscript — wording and pagination may differ",
    })]} />);
    expect(screen.queryByText(/Accepted manuscript/)).not.toBeInTheDocument();

    rerender(<ReferenceList references={[reference({
      availability: "full_text",
      fullText: { url: "https://x/1.pdf", version: "accepted" },
      quotationCaveat: "Accepted manuscript — wording and pagination may differ",
    })]} />);
    expect(screen.getByText(/Accepted manuscript/)).toBeInTheDocument();
  });
});
