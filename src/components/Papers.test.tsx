// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Papers } from "./Papers.tsx";

const api = {
  loadSources: vi.fn(),
  loadRelations: vi.fn(),
  loadPages: vi.fn(),
  addSource: vi.fn(),
  addRelation: vi.fn(),
  dropSource: vi.fn(),
  dropRelation: vi.fn(),
};
vi.mock("@/lib/corpus-api.ts", async () => {
  const actual = await vi.importActual<typeof import("@/lib/corpus-api.ts")>("@/lib/corpus-api.ts");
  return {
    ...actual,
    loadSources: (...a: unknown[]) => api.loadSources(...a),
    loadRelations: (...a: unknown[]) => api.loadRelations(...a),
    loadPages: (...a: unknown[]) => api.loadPages(...a),
    addSource: (...a: unknown[]) => api.addSource(...a),
    addRelation: (...a: unknown[]) => api.addRelation(...a),
    dropSource: (...a: unknown[]) => api.dropSource(...a),
    dropRelation: (...a: unknown[]) => api.dropRelation(...a),
  };
});

const SOURCES = [
  { id: "a", name: "Ndlovu 2019", kind: "pdf" as const, doi: "10.1234/a", pageCount: 2, addedAt: "2026-08-01" },
  { id: "b", name: "Smith 2020", kind: "pdf" as const, doi: null, pageCount: 2, addedAt: "2026-08-02" },
];

const PAGES: Record<string, { number: number; body: string }[]> = {
  a: [
    { number: 1, body: "Background to the study." },
    { number: 2, body: "The cohort reported 40 incidents across the stations." },
  ],
  b: [
    { number: 1, body: "A review of the literature." },
    { number: 2, body: "The cohort reported 52 incidents across the stations." },
  ],
};

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  api.loadSources.mockResolvedValue({ ok: true, data: SOURCES });
  api.loadRelations.mockResolvedValue({ ok: true, data: [] });
  api.loadPages.mockImplementation(async (id: string) => ({ ok: true, data: PAGES[id] ?? [] }));
  api.addRelation.mockResolvedValue({ ok: true, data: null });
  api.dropRelation.mockResolvedValue({ ok: true, data: null });
});

describe("the papers a study holds", () => {
  it("says nothing can be held until a study is open", () => {
    render(<Papers studyId={null} />);
    expect(screen.getByText(/Open a study above/)).toBeTruthy();
    expect(api.loadSources).not.toHaveBeenCalled();
  });

  // A scan has no text and nothing to compare. Asking the server for its
  // pages is a round trip per scan that can only ever come back empty.
  it("does not go looking for pages in a paper that has none", async () => {
    api.loadSources.mockResolvedValue({
      ok: true,
      data: [...SOURCES, { id: "c", name: "photocopy.pdf", kind: "pdf" as const, doi: null, pageCount: 0, addedAt: "2026-08-03" }],
    });
    render(<Papers studyId="s1" />);
    await screen.findByText("photocopy.pdf");
    await waitFor(() => expect(api.loadPages).toHaveBeenCalled());
    expect(api.loadPages.mock.calls.map((call) => call[0])).not.toContain("c");
  });

  it("lists them, with what was read out of each", async () => {
    render(<Papers studyId="s1" />);
    expect(await screen.findByText("Ndlovu 2019")).toBeTruthy();
    expect(screen.getByText(/2 pages · 10.1234\/a/)).toBeTruthy();
  });
});

describe("figures that disagree", () => {
  it("asks about two papers reporting different numbers for the same thing", async () => {
    render(<Papers studyId="s1" />);
    const question = await screen.findByText(/gives 40 on page 2/);
    expect(question.textContent).toContain("Smith 2020");
    expect(question.textContent).toContain("52");
  });

  // The wording is the design. A disagreeing figure is not a contradiction,
  // and a screen that presented it as one would be asserting something it
  // cannot see.
  it("presents it as a question rather than a finding", async () => {
    render(<Papers studyId="s1" />);
    await screen.findByText(/gives 40 on page 2/);
    const panel = screen.getByRole("region", { name: "Figures that disagree" });
    expect(panel.textContent).toContain("a question for you rather than a finding");
    expect(panel.textContent).toContain("not a contradiction");
  });

  it("does not let an empty list read as agreement", async () => {
    api.loadPages.mockResolvedValue({ ok: true, data: [{ number: 1, body: "No figures here." }] });
    render(<Papers studyId="s1" />);
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Figures that disagree" }).textContent)
        .toContain("still not appear here"));
  });
});

describe("recording what the reviewer decides", () => {
  it("will not record one without a reason", async () => {
    const user = userEvent.setup();
    render(<Papers studyId="s1" />);
    await user.click(await screen.findByRole("button", { name: "Record a contradiction" }));

    const form = screen.getByRole("region", { name: /contradicts/ });
    const why = within(form).getByLabelText("Why");
    await user.clear(why);
    await user.type(why, "differs");

    expect(within(form).getByRole("button", { name: "Record it" })).toBeDisabled();
    expect(form.textContent).toContain("the start of a reason rather than one");
    expect(api.addRelation).not.toHaveBeenCalled();
  });

  it("puts the direction in the heading, because an arrow does not carry it", async () => {
    const user = userEvent.setup();
    render(<Papers studyId="s1" />);
    await user.click(await screen.findByRole("button", { name: "Record a contradiction" }));
    expect(screen.getByRole("heading", { name: "Ndlovu 2019 contradicts Smith 2020" })).toBeTruthy();
    expect(screen.getByText(/says the first does the contradicting, not the second/)).toBeTruthy();
  });

  it("records it, with the reason, in the direction shown", async () => {
    const user = userEvent.setup();
    render(<Papers studyId="s1" />);
    await user.click(await screen.findByRole("button", { name: "Record a contradiction" }));
    await user.click(screen.getByRole("button", { name: "Record it" }));

    await waitFor(() => expect(api.addRelation).toHaveBeenCalledTimes(1));
    const [, sent] = api.addRelation.mock.calls[0]!;
    expect(sent).toMatchObject({ relation: "contradicts", sourceId: "a", targetId: "b" });
    expect((sent as { basis: string }).basis).toContain("40");
    expect((sent as { basis: string }).basis).toContain("52");
  });

  it("marks a pair it has already been asked about", async () => {
    api.loadRelations.mockResolvedValue({
      ok: true,
      data: [{ id: "r1", relation: "contradicts", sourceId: "b", targetId: "a", basis: "Recorded the other way round.", createdAt: "2026-08-03" }],
    });
    render(<Papers studyId="s1" />);
    expect(await screen.findByText(/already recorded something between these two/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Record a contradiction" })).toBeNull();
  });

  it("shows what has been recorded, with the direction and the reason", async () => {
    api.loadRelations.mockResolvedValue({
      ok: true,
      data: [{ id: "r1", relation: "corroborates", sourceId: "a", targetId: "b", basis: "Both use the same framing categories.", createdAt: "2026-08-03" }],
    });
    render(<Papers studyId="s1" />);
    expect(await screen.findByText("Ndlovu 2019 corroborates Smith 2020")).toBeTruthy();
    expect(screen.getByText("Both use the same framing categories.")).toBeTruthy();
  });
});
