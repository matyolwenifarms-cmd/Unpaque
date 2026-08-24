// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EMPTY, type StudySnapshot } from "@shared/research/status/status.ts";
import { StudyStatus } from "./StudyStatus.tsx";

const loadSnapshot = vi.fn();
vi.mock("@/lib/status-api.ts", () => ({
  loadSnapshot: (...a: unknown[]) => loadSnapshot(...a),
}));

const snapshot = (over: Partial<StudySnapshot> = {}) => ({
  ok: true as const,
  data: { ...EMPTY, ...over },
});

beforeEach(() => {
  loadSnapshot.mockReset();
  loadSnapshot.mockResolvedValue(snapshot());
});

const panel = () =>
  screen.getByRole("region", { name: /What this study holds|Nothing in this study|No study open/ });

describe("what a study holds", () => {
  // A first visit. Returning nothing here left that visitor facing eight tabs
  // and no way to tell which was theirs, which is the thing this replaces.
  it("offers the one thing that works with no study and no account", async () => {
    const onStage = vi.fn();
    const user = userEvent.setup();
    render(<StudyStatus studyId={null} onStage={onStage} />);

    expect(screen.getByText(/No study open/)).toBeTruthy();
    expect(screen.getByText(/here in your browser/)).toBeTruthy();
    expect(loadSnapshot).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Read a proposal/ }));
    expect(onStage).toHaveBeenCalledWith("proposal");
  });

  it("describes the work rather than listing counts", async () => {
    loadSnapshot.mockResolvedValue(snapshot({ papers: 12, papersWithoutText: 2, references: 24 }));
    render(<StudyStatus studyId="s1" onStage={vi.fn()} />);
    await screen.findByText(/12 papers held/);
    expect(panel().textContent).toContain("2 of them have no text layer");
    expect(panel().textContent).toContain("24 references kept");
  });

  // The decision the panel rests on: a to-do list the researcher did not write
  // is six reproaches for a study that legitimately never opens six stages.
  it("says nothing about the stages this study does not use", async () => {
    loadSnapshot.mockResolvedValue(snapshot({ documents: 3, codes: 8, codings: 40 }));
    render(<StudyStatus studyId="s1" onStage={vi.fn()} />);
    await screen.findByText(/3 documents open for coding/);
    expect(panel().textContent).not.toMatch(/screen/i);
    expect(panel().textContent).not.toMatch(/analys/i);
  });

  // Without this the panel reads as the whole product, and a stage it never
  // mentions becomes a stage somebody believes does not exist.
  it("says the full list is still there", async () => {
    loadSnapshot.mockResolvedValue(snapshot({ papers: 3 }));
    render(<StudyStatus studyId="s1" onStage={vi.fn()} />);
    await screen.findByText(/3 papers held/);
    expect(panel().textContent)
      .toContain("Every stage is available below, whether or not it appears here");
  });
});

describe("each line is a way in", () => {
  it("takes you to the stage that owns it", async () => {
    const onStage = vi.fn();
    const user = userEvent.setup();
    loadSnapshot.mockResolvedValue(snapshot({ papers: 5, documents: 2, codes: 3 }));
    render(<StudyStatus studyId="s1" onStage={onStage} />);

    await user.click(await screen.findByText(/5 papers held/));
    expect(onStage).toHaveBeenCalledWith("papers");

    await user.click(screen.getByText(/2 documents open for coding/));
    expect(onStage).toHaveBeenLastCalledWith("code");
  });

  it("names the stage each line leads to", async () => {
    loadSnapshot.mockResolvedValue(snapshot({ papers: 5 }));
    render(<StudyStatus studyId="s1" onStage={vi.fn()} />);
    await screen.findByText(/5 papers held/);
    expect(within(panel()).getByText("Papers")).toBeVisible();
  });

  it("follows the one thing offered next", async () => {
    const onStage = vi.fn();
    const user = userEvent.setup();
    render(<StudyStatus studyId="s1" onStage={onStage} />);
    await user.click(await screen.findByText(/Hand over a proposal/));
    expect(onStage).toHaveBeenCalledWith("proposal");
  });
});

describe("when it cannot count", () => {
  // Every stage is still reachable from the list below, so a panel that could
  // not count is an absence rather than a failure worth alarming anybody
  // about.
  it("says so quietly and points at the stages", async () => {
    loadSnapshot.mockResolvedValue({ ok: false, message: "connection refused" });
    render(<StudyStatus studyId="s1" onStage={vi.fn()} />);
    expect(await screen.findByText(/could not be counted just now/)).toBeTruthy();
    expect(screen.getByText(/The stages below all still work/)).toBeTruthy();
    // Not the raw error. "connection refused" tells a researcher nothing they
    // can act on.
    expect(document.body.textContent).not.toContain("connection refused");
  });

  it("re-counts when the reload key changes", async () => {
    const { rerender } = render(
      <StudyStatus studyId="s1" onStage={vi.fn()} reloadKey="papers" />,
    );
    await waitFor(() => expect(loadSnapshot).toHaveBeenCalledTimes(1));
    rerender(<StudyStatus studyId="s1" onStage={vi.fn()} reloadKey="code" />);
    await waitFor(() => expect(loadSnapshot).toHaveBeenCalledTimes(2));
  });
});
