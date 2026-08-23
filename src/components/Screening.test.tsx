// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Screening } from "./Screening.tsx";

const api = {
  loadScreening: vi.fn(),
  addToScreening: vi.fn(),
  decide: vi.fn(),
  dropScreened: vi.fn(),
};
vi.mock("@/lib/screening-api.ts", () => ({
  loadScreening: (...a: unknown[]) => api.loadScreening(...a),
  addToScreening: (...a: unknown[]) => api.addToScreening(...a),
  decide: (...a: unknown[]) => api.decide(...a),
  dropScreened: (...a: unknown[]) => api.dropScreened(...a),
}));

let next = 0;
const row = (state: string, reason?: string) => {
  next += 1;
  return {
    id: `r${next}`,
    label: `Paper ${next}`,
    state,
    foundVia: "Scopus",
    doi: null,
    ...(reason === undefined ? {} : { reason }),
  };
};
const many = (state: string, count: number, reason?: string) =>
  Array.from({ length: count }, () => row(state, reason));

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  api.loadScreening.mockResolvedValue({ ok: true, data: [] });
  api.decide.mockResolvedValue({ ok: true, data: null });
  api.addToScreening.mockResolvedValue({ ok: true, data: 3 });
});

describe("a review still being screened", () => {
  // The refusal that makes the diagram trustworthy. PRISMA has no box for a
  // record nobody has decided about, so the subtractions do not hold and there
  // is no picture to draw.
  it("draws no diagram while records are undecided, and says why", async () => {
    api.loadScreening.mockResolvedValue({
      ok: true,
      data: [...many("identified", 30), ...many("excluded_on_title", 5), ...many("included", 2)],
    });
    render(<Screening studyId="s1" />);
    const panel = await screen.findByRole("region", { name: "The flow" });
    await waitFor(() => expect(panel.textContent).toContain("30 not yet screened"));
    expect(panel.textContent).toContain("no box for a record nobody has decided about");
    expect(panel.textContent).not.toContain("records identified.");
  });

  // The boxes are still shown, because they are what the reviewer is working
  // through and they are useful long before the diagram exists.
  it("still counts the boxes so progress is visible", async () => {
    api.loadScreening.mockResolvedValue({ ok: true, data: many("identified", 4) });
    render(<Screening studyId="s1" />);
    const panel = await screen.findByRole("region", { name: "The flow" });
    // Visible, not merely present. `getByText` finds a hidden element quite
    // happily, so an assertion that only checks the DOM passes over a panel
    // nobody can see.
    expect(within(panel).getByText("Not yet screened")).toBeVisible();
    await waitFor(() => expect(within(panel).getAllByText("4")[0]).toBeVisible());
  });
});

describe("a review that has been screened through", () => {
  const DONE = [
    ...many("duplicate", 2),
    ...many("excluded_on_title", 5),
    ...many("excluded_on_full_text", 1, "Wrong population"),
    ...many("included", 2),
  ];

  it("writes the flow out as sentences a methods section can use", async () => {
    api.loadScreening.mockResolvedValue({ ok: true, data: DONE });
    render(<Screening studyId="s1" />);
    const panel = await screen.findByRole("region", { name: "The flow" });
    await waitFor(() => expect(panel.textContent).toContain("10 records identified."));
    expect(panel.textContent).toContain("2 duplicates removed, leaving 8 to screen.");
    expect(panel.textContent).toContain("2 included in the review.");
    expect(panel.textContent).toContain("Wrong population: 1.");
  });

  // No number on this screen is typed by anybody. The counts come from the
  // decisions, so a diagram cannot disagree with them.
  it("takes no numbers from the reviewer at all", async () => {
    api.loadScreening.mockResolvedValue({ ok: true, data: DONE });
    render(<Screening studyId="s1" />);
    await screen.findByRole("region", { name: "The flow" });
    for (const field of screen.queryAllByRole("spinbutton")) {
      expect(field).toBeUndefined();
    }
    expect(screen.queryByLabelText(/number of records/i)).toBeNull();
  });
});

describe("deciding about a record", () => {
  it("offers only the moves that make sense from where it is", async () => {
    api.loadScreening.mockResolvedValue({ ok: true, data: [row("identified")] });
    render(<Screening studyId="s1" />);
    expect(await screen.findByRole("button", { name: "Exclude on title" })).toBeTruthy();
    // A record nobody has read cannot be excluded at full text.
    expect(screen.queryByRole("button", { name: "Exclude at full text" })).toBeNull();
  });

  it("will not exclude a full text without a reason", async () => {
    const user = userEvent.setup();
    api.loadScreening.mockResolvedValue({ ok: true, data: [row("assessed")] });
    render(<Screening studyId="s1" />);
    await user.click(await screen.findByRole("button", { name: "Exclude at full text" }));

    expect(await screen.findByText(/PRISMA asks for a reason against every full-text exclusion/))
      .toBeTruthy();
    expect(api.decide).not.toHaveBeenCalled();
  });

  it("records the exclusion once a reason is given", async () => {
    const user = userEvent.setup();
    api.loadScreening.mockResolvedValue({ ok: true, data: [row("assessed")] });
    render(<Screening studyId="s1" />);
    await user.type(await screen.findByLabelText(/Reason for excluding/), "Wrong population");
    await user.click(screen.getByRole("button", { name: "Exclude at full text" }));

    await waitFor(() => expect(api.decide).toHaveBeenCalledTimes(1));
    expect(api.decide.mock.calls[0]).toEqual([
      expect.any(String),
      "excluded_on_full_text",
      "Wrong population",
    ]);
  });

  it("does not ask for a reason on a title exclusion, because PRISMA does not", async () => {
    const user = userEvent.setup();
    api.loadScreening.mockResolvedValue({ ok: true, data: [row("identified")] });
    render(<Screening studyId="s1" />);
    await user.click(await screen.findByRole("button", { name: "Exclude on title" }));
    await waitFor(() => expect(api.decide).toHaveBeenCalledTimes(1));
    expect(api.decide.mock.calls[0]![1]).toBe("excluded_on_title");
  });
});

describe("getting records in", () => {
  it("takes a pasted list, one per line, with where they came from", async () => {
    const user = userEvent.setup();
    render(<Screening studyId="s1" />);
    await user.type(await screen.findByLabelText("Titles to screen"), "First paper{enter}Second paper");
    await user.type(screen.getByLabelText("Where they came from"), "Scopus");
    await user.click(screen.getByRole("button", { name: "Add them" }));

    await waitFor(() => expect(api.addToScreening).toHaveBeenCalledTimes(1));
    const [, labels, source] = api.addToScreening.mock.calls[0]!;
    expect(labels).toEqual(["First paper", "Second paper"]);
    expect(source).toBe("Scopus");
  });

  it("says nothing can be screened until a study is open", () => {
    render(<Screening studyId={null} />);
    expect(screen.getByText(/Open a study above/)).toBeTruthy();
    expect(api.loadScreening).not.toHaveBeenCalled();
  });
});
