// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProposalReview } from "./ProposalReview.tsx";

// The network is the only thing mocked. Everything below runs the real
// reader, the real supervisor pass and the real report.
const checkDois = vi.fn();
const searchReferences = vi.fn();
vi.mock("@/lib/research-api.ts", () => ({
  checkDois: (dois: readonly string[]) => checkDois(dois),
  searchReferences: (query: string) => searchReferences(query),
}));

const PROPOSAL = `Chapter Three: Methodology

This study adopts an interpretivist paradigm. Twelve participants will be
recruited through purposive sampling from four community radio stations, and
the framing of protest coverage will be analysed. Positivism dominated the
earlier literature, but this study does not work in it.

References

Ndlovu, T. (2019). Framing the student movement. Journal of African Media, 12(3), 45-67. https://doi.org/10.1234/jam.2019.45
Smith, J. Q. (2020). Protest and the press. Media Studies, 8(1), 1-20.
`;

async function paste(text: string) {
  const user = userEvent.setup();
  await user.click(screen.getByText("Or paste the text"));
  const box = screen.getByLabelText("Proposal text");
  // `paste` rather than `type`: userEvent types one key at a time, and this is
  // eight hundred characters.
  await user.click(box);
  await user.paste(text);
  await user.click(screen.getByRole("button", { name: "Read it" }));
}

beforeEach(() => {
  checkDois.mockReset();
  searchReferences.mockReset();
  checkDois.mockResolvedValue({ status: "ok", checks: [], total: 0 });
  searchReferences.mockResolvedValue({ status: "error", code: "offline", message: "no" });
});

describe("handing over a proposal", () => {
  it("shows what it read, and marks a paradigm it only saw mentioned", async () => {
    render(<ProposalReview />);
    await paste(PROPOSAL);

    expect(await screen.findByText("What it read")).toBeTruthy();
    expect(screen.getByText("Interpretivism")).toBeTruthy();
    expect(screen.getByText("Purposive")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    // The proposal never writes its question out, and that gap is shown as a
    // gap rather than filled in from the prose.
    expect(screen.getAllByText("Not stated").length).toBeGreaterThan(0);
  });

  it("reports the reference arithmetic", async () => {
    render(<ProposalReview />);
    await paste(PROPOSAL);

    const found = await screen.findByText(/listed and never cited/);
    expect(found.textContent).toContain("Ndlovu (2019)");
    expect(found.textContent).toContain("Smith (2020)");
  });

  // The refusal that matters most on this screen. An unreachable checking
  // service must never reach a student as a claim about their references.
  it("never turns a failed check into a claim about a reference", async () => {
    checkDois.mockResolvedValue({ status: "error", code: "offline", message: "Could not reach it." });
    render(<ProposalReview />);
    await paste(PROPOSAL);

    const report = (await screen.findByText("What a first reading finds")).parentElement!;
    expect(report.textContent).toContain("could not be checked");
    expect(report.textContent).toContain("Nothing follows from that about whether it exists");
    expect(report.textContent).not.toContain("did not resolve");
  });

  it("says a DOI did not resolve when the agency is what said so", async () => {
    checkDois.mockResolvedValue({
      status: "ok",
      checks: [{ doi: "10.1234/jam.2019.45", kind: "absent" }],
      total: 1,
    });
    render(<ProposalReview />);
    await paste(PROPOSAL);

    const report = (await screen.findByText("What a first reading finds")).parentElement!;
    expect(report.textContent).toContain("did not resolve");
    expect(report.textContent).toContain("10.1234/jam.2019.45");
  });

  it("asks about every identifier in one call", async () => {
    render(<ProposalReview />);
    await paste(PROPOSAL);
    await screen.findByText("What it read");
    expect(checkDois).toHaveBeenCalledTimes(1);
    expect(checkDois.mock.calls[0]![0]).toEqual(["10.1234/jam.2019.45"]);
  });

  it("says the search did not run rather than showing an empty shelf", async () => {
    render(<ProposalReview />);
    await paste(PROPOSAL);

    const report = (await screen.findByText("What a first reading finds")).parentElement!;
    expect(report.textContent).toContain("No related work was looked for");
    expect(screen.queryByText("Work you do not cite")).toBeNull();
  });

  it("suggests only work the proposal does not already cite", async () => {
    searchReferences.mockResolvedValue({
      status: "ok",
      reportedTotal: 2,
      notes: [],
      references: [
        {
          id: "already", source: "openalex", doi: "10.1234/jam.2019.45",
          title: "Framing the student movement", authors: [{ name: "T Ndlovu" }], year: 2019,
          preprint: false, retraction: "none", openAccess: false,
          verification: "verified", availability: "metadata_only", sources: ["openalex"],
        },
        {
          id: "new", source: "openalex", doi: "10.9999/x",
          title: "Community radio and the politics of protest",
          authors: [{ name: "Lerato Dube" }], year: 2022, citedByCount: 31,
          preprint: false, retraction: "none", openAccess: false,
          verification: "verified", availability: "metadata_only", sources: ["openalex"],
        },
      ],
    });
    render(<ProposalReview />);
    await paste(PROPOSAL);

    expect(await screen.findByText("Work you do not cite")).toBeTruthy();
    expect(screen.getByText("Community radio and the politics of protest")).toBeTruthy();
    expect(screen.queryByText("Framing the student movement")).toBeNull();
  });

  it("offers to keep a suggestion only when a study is open", async () => {
    searchReferences.mockResolvedValue({
      status: "ok", reportedTotal: 1, notes: [],
      references: [{
        id: "new", source: "openalex", doi: "10.9999/x", title: "A relevant paper",
        authors: [{ name: "Lerato Dube" }], year: 2022,
        preprint: false, retraction: "none", openAccess: false,
        verification: "verified", availability: "metadata_only", sources: ["openalex"],
      }],
    });

    const onKeep = vi.fn();
    const { unmount } = render(<ProposalReview />);
    await paste(PROPOSAL);
    await screen.findByText("A relevant paper");
    expect(screen.queryByRole("button", { name: /Keep for this study/ })).toBeNull();
    unmount();

    render(<ProposalReview onKeep={onKeep} kept={new Set()} />);
    await paste(PROPOSAL);
    const keep = await screen.findByRole("button", { name: "Keep for this study" });
    await userEvent.setup().click(keep);
    expect(onKeep).toHaveBeenCalledOnce();
  });

  // Honesty rule 1: the gap where rewriting would be must announce itself.
  it("says on screen that it does not rewrite anything", async () => {
    render(<ProposalReview />);
    await paste(PROPOSAL);

    const panel = (await screen.findByText("What this does not do")).parentElement!;
    expect(panel.textContent).toContain("does not rewrite your sentences");
    expect(panel.textContent).toContain("surname and year");
  });
});
