// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parseDataset, type Dataset } from "@shared/research/analytics/dataset.ts";
import { AnalyseData } from "./AnalyseData.tsx";
import { DatasetSummary } from "./DatasetSummary.tsx";

function load(csv: string): Dataset {
  const outcome = parseDataset(csv);
  if (!outcome.ok) throw new Error(outcome.reason);
  return outcome.dataset;
}

const TWO_ARMS = load([
  "arm,score,age",
  "control,12,21", "control,15,34", "control,11,29", "control,14,41",
  "treatment,19,25", "treatment,21,38", "treatment,18,31", "treatment,22,27",
].join("\n"));

const THREE_ARMS = load([
  "arm,score",
  "a,10", "a,12", "a,11", "b,20", "b,22", "b,21", "c,30", "c,32", "c,29",
].join("\n"));

describe("what was read", () => {
  // The commonest way a quantitative analysis goes wrong is not the test — it
  // is that the file was not what the researcher thought.
  it("shows every column, how it was read, and what is missing", () => {
    const withGaps = load("id,score,note\n1,10,ok\n2,,fine\n3,12,\n");
    render(<DatasetSummary dataset={withGaps} />);
    const table = screen.getByRole("table");
    expect(within(table).getByRole("rowheader", { name: "score" })).toBeInTheDocument();
    expect(screen.getByText(/3 rows, 3 columns/)).toBeInTheDocument();
  });

  it("surfaces the notes about how the file was read", () => {
    const semicolons = load("a;b\n1;2\n3;4\n");
    render(<DatasetSummary dataset={semicolons} />);
    expect(screen.getByText(/not comma-delimited/)).toBeInTheDocument();
  });
});

describe("choosing a procedure", () => {
  async function choose(dataset: Dataset, a: string, b: string) {
    const user = userEvent.setup();
    render(<AnalyseData dataset={dataset} />);
    await user.selectOptions(screen.getByLabelText(/first column/i), a);
    await user.selectOptions(screen.getByLabelText(/second column/i), b);
    return user;
  }

  // A greyed option teaches nothing. The reason is what teaches the rule at
  // the moment it matters.
  it("keeps an impossible procedure visible, with why", async () => {
    await choose(THREE_ARMS, "score", "arm");
    expect(screen.getByText(/has 3 levels.*one-way ANOVA is the corresponding test/i)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Independent-samples t-test" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "One-way ANOVA" })).toBeEnabled();
  });

  it("refuses correlation between a measure and a grouping column, and says which is which", async () => {
    await choose(TWO_ARMS, "score", "arm");
    // Scoped to Pearson's own option: three procedures share this reason, and
    // loosening to getAllByText would stop asserting that Pearson has it.
    const pearson = screen.getByRole("radio", { name: "Pearson correlation" });
    const detail = document.getElementById(pearson.getAttribute("aria-describedby")!)!;
    expect(detail.textContent).toMatch(/"arm" is categorical/);
  });

  it("runs the test and shows n, the effect size, the interval and the p", async () => {
    const user = await choose(TWO_ARMS, "score", "arm");
    await user.click(screen.getByRole("radio", { name: "Independent-samples t-test" }));
    await user.click(screen.getByRole("button", { name: /run it/i }));

    const finding = screen.getByLabelText(/Welch's t-test/i);
    expect(within(finding).getByText("8")).toBeInTheDocument();
    expect(within(finding).getByText(/hedges g/i)).toBeInTheDocument();
    // Twice on purpose: once in the sentence and once as a labelled figure.
    expect(within(finding).getAllByText(/95% CI/i).length).toBeGreaterThan(0);
  });

  // An unmet assumption one click from a p-value is one nobody reads.
  it("shows the assumptions without a disclosure to open", async () => {
    const user = await choose(TWO_ARMS, "score", "arm");
    await user.click(screen.getByRole("radio", { name: "Independent-samples t-test" }));
    await user.click(screen.getByRole("button", { name: /run it/i }));
    // Scoped: the phrase is legitimately in the finding and in the results
    // section, and getAllByText would stop asserting it is in the finding.
    const finding = screen.getByLabelText(/Welch's t-test/i);
    expect(within(finding).getByText(/Independence of observations/)).toBeInTheDocument();
    expect(within(finding).getByText(/no statistic can recover it/)).toBeInTheDocument();
  });

  it("will not run until a procedure that fits is chosen", () => {
    render(<AnalyseData dataset={TWO_ARMS} />);
    expect(screen.getByRole("button", { name: /run it/i })).toBeDisabled();
  });
});

describe("the interpretation is checked against the design", () => {
  async function runOne() {
    const user = userEvent.setup();
    render(<AnalyseData dataset={TWO_ARMS} />);
    await user.selectOptions(screen.getByLabelText(/first column/i), "score");
    await user.selectOptions(screen.getByLabelText(/second column/i), "age");
    await user.click(screen.getByRole("radio", { name: "Pearson correlation" }));
    await user.click(screen.getByRole("button", { name: /run it/i }));
    return user;
  }

  // Checked as they type, not on submit: afterwards it is a conclusion, and
  // people defend conclusions.
  it("refuses a causal sentence on a correlational design, as it is typed", async () => {
    const user = await runOne();
    await user.type(screen.getByLabelText(/interpretation/i), "Age causes higher scores.");
    expect(screen.getByText(/cannot support a claim about cause/)).toBeInTheDocument();
    expect(screen.getByText(/associated with/)).toBeInTheDocument();
  });

  it("accepts the association wording", async () => {
    const user = await runOne();
    await user.type(screen.getByLabelText(/interpretation/i), "Age was associated with higher scores.");
    expect(screen.queryByText(/cannot support a claim about cause/)).toBeNull();
  });

  it("lets a randomised design say causes", async () => {
    const user = await runOne();
    await user.click(screen.getByLabelText(/randomly allocated/i));
    await user.type(screen.getByLabelText(/interpretation/i), "The condition causes higher scores.");
    expect(screen.queryByText(/cannot support a claim about cause/)).toBeNull();
  });
});

describe("the results section", () => {
  async function runOne(user: ReturnType<typeof userEvent.setup>, a: string, b: string, procedure: string) {
    await user.selectOptions(screen.getByLabelText(/first column/i), a);
    await user.selectOptions(screen.getByLabelText(/second column/i), b);
    await user.click(screen.getByRole("radio", { name: procedure }));
    await user.click(screen.getByRole("button", { name: /run it/i }));
  }

  it("appears once an analysis has been run, and not before", async () => {
    const user = userEvent.setup();
    render(<AnalyseData dataset={TWO_ARMS} />);
    expect(screen.queryByLabelText(/results section/i)).toBeNull();

    await runOne(user, "score", "arm", "Independent-samples t-test");
    const results = screen.getByLabelText(/results section/i);
    expect(within(results).getByText(/## Results/)).toBeInTheDocument();
  });

  // A results section held as text drifts from the analyses the moment one is
  // re-run. Here it is a function of the findings, so there is nothing to drift.
  it("keeps every analysis, not only the last", async () => {
    const user = userEvent.setup();
    render(<AnalyseData dataset={TWO_ARMS} />);
    await runOne(user, "score", "arm", "Independent-samples t-test");
    await runOne(user, "score", "age", "Pearson correlation");

    expect(screen.getByText(/2 analyses run on this file/i)).toBeInTheDocument();
    const results = screen.getByLabelText(/results section/i);
    expect(results.textContent).toMatch(/Welch's t-test/);
    expect(results.textContent).toMatch(/Pearson correlation/);
  });

  it("writes p without a leading zero, which is what APA asks for", async () => {
    const user = userEvent.setup();
    render(<AnalyseData dataset={TWO_ARMS} />);
    await runOne(user, "score", "arm", "Independent-samples t-test");
    const results = screen.getByLabelText(/results section/i);
    expect(results.textContent).toMatch(/\*p\* [<=] \.\d|p\* < \.001/);
    expect(results.textContent).not.toMatch(/\*p\* = 0\./);
  });

  // §8. Interpretation is the researcher's argument, and a tool that drafted it
  // would be one positioning decision from producing work somebody submits as
  // their own.
  it("stops at the results and writes no discussion", async () => {
    const user = userEvent.setup();
    render(<AnalyseData dataset={TWO_ARMS} />);
    await runOne(user, "score", "arm", "Independent-samples t-test");
    const results = screen.getByLabelText(/results section/i);
    expect(results.textContent).not.toMatch(/## Discussion|we conclude|this suggests/i);
    expect(screen.getByText(/the discussion is your argument/i)).toBeInTheDocument();
  });

  it("clears the analyses on request", async () => {
    const user = userEvent.setup();
    render(<AnalyseData dataset={TWO_ARMS} />);
    await runOne(user, "score", "arm", "Independent-samples t-test");
    await user.click(screen.getByRole("button", { name: /clear them/i }));
    expect(screen.queryByLabelText(/results section/i)).toBeNull();
  });
});
