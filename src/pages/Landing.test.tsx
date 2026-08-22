// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Landing from "./Landing.tsx";

const draw = () => render(<MemoryRouter><Landing /></MemoryRouter>);

describe("the landing page", () => {
  // Set in type, not dropped in as an image: it stays sharp at any size,
  // adapts to a light-mode reader, and reads as the word it is.
  it("renders the wordmark as readable text, not an image", () => {
    draw();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/^Unpaque$/);
    expect(heading.querySelector("img")).toBeNull();
  });

  // Scoped to the plate: Unpack's own card says the same words, because it is
  // the feature the platform is named after.
  it("carries the tagline from the logo, on the plate", () => {
    draw();
    const plate = screen.getByRole("region", { name: "Unpaque" });
    expect(within(plate).getByText(/communication diagnostics/i)).toBeInTheDocument();
  });

  // The links live on the plate, beneath the tagline. The cards below it
  // describe the features; they are not a second set of navigation.
  it("offers a way into all three features, from the plate", () => {
    draw();
    const plate = screen.getByRole("region", { name: "Unpaque" });
    // Anchored: the accessible name is the tab plus its one-word category, so
    // "Research literature" matches and a revert to "The Researcher literature"
    // does not. An unanchored /Research/ would pass either way.
    expect(within(plate).getByRole("link", { name: /^Unpack\b/ })).toHaveAttribute("href", "/unpack");
    expect(within(plate).getByRole("link", { name: /^Research\b/ })).toHaveAttribute("href", "/research");
    expect(within(plate).getByRole("link", { name: /^Detect\b/ })).toHaveAttribute("href", "/cases");
  });

  it("puts them below the tagline, not above it", () => {
    draw();
    const plate = screen.getByRole("region", { name: "Unpaque" });
    const tagline = within(plate).getByText(/communication diagnostics/i);
    const nav = within(plate).getByRole("navigation", { name: /features/i });
    // Node.DOCUMENT_POSITION_FOLLOWING — the nav comes after the tagline.
    expect(tagline.compareDocumentPosition(nav) & 4).toBeTruthy();
  });

  it("says what Research will not do, on the way in", () => {
    draw();
    expect(screen.getByText(/none of them come from a language model/i)).toBeInTheDocument();
  });
});
