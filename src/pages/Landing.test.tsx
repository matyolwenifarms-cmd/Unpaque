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

  it("offers a way into all three features", () => {
    draw();
    expect(screen.getByRole("link", { name: /Unpack/ })).toHaveAttribute("href", "/unpack");
    expect(screen.getByRole("link", { name: /The Researcher/ })).toHaveAttribute("href", "/research");
    expect(screen.getByRole("link", { name: /The Detective/ })).toHaveAttribute("href", "/cases");
  });

  it("says what The Researcher will not do, on the way in", () => {
    draw();
    expect(screen.getByText(/none of them come from a language model/i)).toBeInTheDocument();
  });
});
