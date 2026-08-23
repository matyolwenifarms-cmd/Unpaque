// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parseDataset, type Dataset } from "@shared/research/analytics/dataset.ts";
import { DataReview } from "./DataReview.tsx";

function load(csv: string): Dataset {
  const outcome = parseDataset(csv);
  if (!outcome.ok) throw new Error(outcome.reason);
  return outcome.dataset;
}

const rows = (count: number, make: (index: number) => string) =>
  Array.from({ length: count }, (_, index) => make(index)).join("\n");

// A file with everything wrong with it that a real export has wrong with it.
const MESSY = load(
  `participant_id,site,gender,arm,age,score\n${rows(40, (i) =>
    `P${i},clinic,${["Male", "male"][i % 2]},${["control", "treatment"][i % 2]},${20 + i},${i % 5 === 0 ? "" : i}`)}\n` +
    `PX,clinic,Male,control,Prefer not to say,7\n`,
);

const CLEAN = load(
  `arm,score,age\n${rows(40, (i) => `${["control", "treatment"][i % 2]},${i * 3},${20 + (i % 25)}`)}\n`,
);

describe("what is worth knowing before running anything", () => {
  const health = () =>
    within(screen.getByRole("region", { name: /What is worth knowing/ }));

  it("names the column a single answer turned into a category", () => {
    render(<DataReview dataset={MESSY} />);
    const said = health().getByText(/are numbers, but/).textContent ?? "";
    expect(said).toContain("age");
    expect(said).toContain("Prefer not to say");
  });

  it("names two levels that are the same word", () => {
    render(<DataReview dataset={MESSY} />);
    expect(health().getByText(/the same word written differently/).textContent)
      .toContain('"Male"');
  });

  it("gives each finding something to do about it", () => {
    render(<DataReview dataset={MESSY} />);
    expect(health().getByText(/Make the capitalisation the same in the file/)).toBeTruthy();
    expect(health().getByText(/If they are missing data, blank them or write NA/)).toBeTruthy();
  });

  // A clean file must not read as a sound study. The panel is about the shape
  // of the spreadsheet and nothing else, and it has to say so.
  it("does not let a clean file read as a sound analysis", () => {
    render(<DataReview dataset={CLEAN} />);
    expect(screen.getByText(/whether the data answers your question is a different question/))
      .toBeTruthy();
  });
});

describe("what the data could answer", () => {
  it("lists the pairs a test could run on, with the measure first", () => {
    render(<DataReview dataset={CLEAN} />);
    expect(screen.getByText("Independent-samples t-test")).toBeTruthy();
    // The chip puts "by" in its own span, so the text is split across nodes.
    // Read the list items rather than matching a string that never exists in
    // one of them.
    const chips = Array.from(document.querySelectorAll("li"))
      .map((node) => (node.textContent ?? "").replace(/\s+/g, " ").trim());
    expect(chips).toContain("score by arm");
    expect(chips).toContain("age by arm");
  });

  // The refusal this panel exists to carry. Without these two sentences it is
  // a menu of ninety comparisons with a small number waiting in one of them.
  it("says it has run nothing, and what choosing from the list would do", () => {
    render(<DataReview dataset={CLEAN} />);
    expect(screen.getByText(/Nothing here has been run/)).toBeTruthy();
    expect(screen.getByText(/keeping the ones that came out small/)).toBeTruthy();
    expect(screen.getByText(/Which of them answers your question is a decision this cannot make/))
      .toBeTruthy();
  });

  it("never puts a number about a result on the screen", () => {
    const { container } = render(<DataReview dataset={CLEAN} />);
    expect(container.textContent ?? "").not.toMatch(/\bp\s*[=<]|\br\s*=|significan/i);
  });

  it("says which columns it left out, and why, when asked", async () => {
    const user = userEvent.setup();
    render(<DataReview dataset={MESSY} />);
    const summary = screen.getByText(/columns were left out of these pairs/);
    await user.click(summary);
    // Scoped to the disclosure. The same sentence appears in the panel above,
    // so an unscoped query passes whether or not the reason is rendered here.
    const details = within(summary.closest("details")!);
    // Pointed at, not repeated: each of these already has its sentence in the
    // panel above, and printing it twice on one screen is padding. Named
    // together, too, rather than four lines each ending the same way.
    expect(details.getByText(/participant_id, site, gender and age/)).toBeTruthy();
    expect(details.queryByText(/shape of a row identifier/)).toBeNull();
    expect(details.getAllByText(/each for the reason given above/)).toHaveLength(1);
  });

  it("does not offer a test on a column it has just called broken", () => {
    render(<DataReview dataset={MESSY} />);
    const chips = Array.from(document.querySelectorAll("li"))
      .map((node) => (node.textContent ?? "").replace(/\s+/g, " ").trim());
    expect(chips.some((chip) => /\bby gender$/.test(chip))).toBe(false);
    expect(chips.some((chip) => /^gender by /.test(chip))).toBe(false);
  });

  it("does not offer a paired t-test, and says why not", () => {
    render(<DataReview dataset={CLEAN} />);
    expect(screen.queryByText("Paired-samples t-test")).toBeNull();
    expect(screen.getByText(/same measurement for the same person at two times/)).toBeTruthy();
  });
});
