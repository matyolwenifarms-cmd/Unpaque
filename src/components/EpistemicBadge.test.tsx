// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EPISTEMIC_STATUSES } from "@shared/detective/epistemic.ts";
import { EpistemicBadge } from "./EpistemicBadge.tsx";

describe("the epistemic badge", () => {
  it.each([...EPISTEMIC_STATUSES])("renders %s with a label and a tooltip", (status) => {
    const { unmount } = render(<EpistemicBadge status={status} />);
    const badge = screen.getByTitle(/./);
    expect(badge.textContent?.trim()).not.toBe("");
    // The tooltip carries the required behaviour, not just the meaning — that
    // is the half people get wrong about the epistemic model.
    expect(badge.getAttribute("title")?.length).toBeGreaterThan(30);
    unmount();
  });

  // Only a contradiction is a fault. `contested` and `disputed` are states of
  // the evidence, and `unknown` is explicitly a legitimate answer — colouring
  // those red turns §4 into a list of problems, which is its opposite.
  it("reserves destructive colouring for contradicted alone", () => {
    const { container: bad } = render(<EpistemicBadge status="contradicted" />);
    expect(bad.firstElementChild?.className).toMatch(/red/);

    for (const status of ["unknown", "contested", "disputed", "unresolved"] as const) {
      const { container } = render(<EpistemicBadge status={status} />);
      expect(container.firstElementChild?.className).not.toMatch(/red/);
    }
  });

  it("says unknown is a valid state rather than a failure", () => {
    render(<EpistemicBadge status="unknown" />);
    expect(screen.getByTitle(/valid state, not as a failure/i)).toBeInTheDocument();
  });
});
