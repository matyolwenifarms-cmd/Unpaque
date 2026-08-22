import { describe, expect, it } from "vitest";
import { describe as summarise } from "./describe.ts";
import { independentT, oneWayAnova, pearson } from "./tests.ts";
import {
  apaBounded,
  apaNumber,
  apaP,
  apaSentence,
  descriptivesTable,
  resultsSection,
} from "./apa.ts";
import type { Finding } from "./result.ts";

function findingOf(outcome: ReturnType<typeof independentT>): Finding {
  if (!outcome.ok) throw new Error(outcome.reason);
  return outcome.finding;
}

const CONTROL = [12, 15, 11, 14, 13, 12, 16, 11];
const TREATMENT = [19, 21, 18, 22, 20, 19, 23, 21];

describe("APA number formatting", () => {
  // A p cannot exceed 1, so the leading zero carries no information and APA
  // drops it. Getting this wrong is the commonest reason a results section
  // comes back marked.
  it("drops the leading zero from p and gives three decimals", () => {
    expect(apaP(0.034)).toBe("*p* = .034");
    expect(apaP(0.5)).toBe("*p* = .500");
    expect(apaP(0.049)).toBe("*p* = .049");
  });

  // Below .001 the exact value is an artefact of the arithmetic rather than a
  // fact about the data, so the convention is the inequality.
  it("uses the inequality below .001, not a fourth decimal", () => {
    expect(apaP(0.0004)).toBe("*p* < .001");
    expect(apaP(1e-12)).toBe("*p* < .001");
    expect(apaP(0.001)).toBe("*p* = .001");
  });

  it("drops the leading zero from bounded coefficients and keeps the sign", () => {
    expect(apaBounded(0.42)).toBe(".42");
    expect(apaBounded(-0.42)).toBe("-.42");
    expect(apaBounded(0.994, 3)).toBe(".994");
  });

  it("keeps the leading zero on unbounded statistics", () => {
    expect(apaNumber(0.42)).toBe("0.42");
    expect(apaNumber(-2.5)).toBe("-2.50");
  });
});

describe("one finding as a sentence", () => {
  it("carries the statistic, p, effect size and interval", () => {
    const sentence = apaSentence(findingOf(independentT(CONTROL, TREATMENT)));
    expect(sentence).toMatch(/\*t\*\(\d/);
    expect(sentence).toMatch(/\*p\* < \.001/);
    expect(sentence).toMatch(/\*g\* = /);
    expect(sentence).toMatch(/95% CI \[-?\d/);
    expect(sentence).toMatch(/statistically significant/);
  });

  it("writes ANOVA's two degrees of freedom", () => {
    const outcome = oneWayAnova([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]);
    if (!outcome.ok) throw new Error("fixture");
    const sentence = apaSentence(outcome.finding);
    expect(sentence).toMatch(/\*F\*\(2, 9\)/);
    expect(sentence).toMatch(/η² = \./);
  });

  it("does not italicise chi-square, which is a Greek letter and stays roman", () => {
    const outcome = pearson([1, 2, 3, 4, 5, 6], [2, 3, 5, 4, 6, 8]);
    if (!outcome.ok) throw new Error("fixture");
    expect(apaSentence(outcome.finding)).toMatch(/\*r\* = /);
  });

  // "was not statistically significant", never "there was no difference".
  it("never writes a null result as an absence", () => {
    const outcome = independentT([1, 2, 3, 4, 5], [1, 2, 3, 4, 6]);
    const sentence = apaSentence(findingOf(outcome));
    expect(sentence).toMatch(/not statistically significant/);
    expect(sentence).not.toMatch(/no difference|no effect/i);
  });
});

describe("the results section", () => {
  const findings = [findingOf(independentT(CONTROL, TREATMENT))];
  const descriptives = [
    { label: "Control", stats: summarise(CONTROL)! },
    { label: "Treatment", stats: summarise(TREATMENT)! },
  ];

  it("opens with the descriptives in APA form", () => {
    const section = resultsSection({ findings, descriptives, rowsInFile: 16 });
    expect(section).toMatch(/^## Results/);
    expect(section).toMatch(/Control \(\*n\* = 8, \*M\* = 13\.00, \*SD\* = 1\.85\)/);
    expect(section).toMatch(/The file held 16 rows/);
  });

  // A reader who meets the p first has already believed it.
  it("puts the assumptions before the results", () => {
    const section = resultsSection({ findings, descriptives });
    expect(section.indexOf("Assumptions were checked")).toBeLessThan(section.indexOf("*p*"));
  });

  it("names an unmet assumption rather than leaving it to the tables", () => {
    const skewed = Array.from({ length: 60 }, (_, i) => Math.exp(i / 12));
    const outcome = independentT(skewed, skewed.map((v) => v * 1.4));
    const section = resultsSection({ findings: [findingOf(outcome)] });
    expect(section).toMatch(/were not met/);
  });

  it("states the family-wise error rate when more than one test was run", () => {
    const many = [findingOf(independentT(CONTROL, TREATMENT, { comparisons: 20 }))];
    const section = resultsSection({ findings: many });
    expect(section).toMatch(/20 comparisons were conducted/);
    expect(section).toMatch(/64%/);
    expect(section).toMatch(/uncorrected/);
  });

  it("says what a non-significant result does not mean", () => {
    const null_ = [findingOf(independentT([1, 2, 3, 4, 5], [1, 2, 3, 4, 6]))];
    const section = resultsSection({ findings: null_ });
    expect(section).toMatch(/not evidence that no effect exists/);
  });

  it("says so plainly when nothing has been run", () => {
    expect(resultsSection({ findings: [] })).toMatch(/No analyses have been run yet/);
  });

  // The discussion is the researcher's argument. A tool that drafted it would
  // be one positioning decision from producing work a student submits as their
  // own — §8 of the specification, and the reason this stops here.
  it("writes no discussion and draws no conclusion", () => {
    const section = resultsSection({ findings, descriptives });
    expect(section).not.toMatch(/## Discussion|we conclude|this suggests that|implies that/i);
  });
});

describe("the descriptives table", () => {
  it("is markdown that survives a paste into Word", () => {
    const table = descriptivesTable([{ label: "Score", stats: summarise(CONTROL)! }]);
    expect(table).toMatch(/\*\*Table 1\*\*/);
    expect(table).toMatch(/\| Variable \| \*n\* \| \*M\* \| \*SD\* \| Min \| Max \| Missing \|/);
    expect(table).toMatch(/\| Score \| 8 \| 13\.00 \| 1\.85 \| 11\.00 \| 16\.00 \| 0 \|/);
  });

  it("is empty when there is nothing to tabulate", () => {
    expect(descriptivesTable([])).toBe("");
  });
});

// Four defects visible only once a real results section was generated end to
// end. Each reads as prose and is wrong about what was done.
describe("what a generated section got wrong before anyone read one", () => {
  it("calls a correlation an association, not a difference", () => {
    const outcome = pearson([1, 2, 3, 4, 5, 6, 7], [2, 3, 5, 4, 6, 8, 9]);
    if (!outcome.ok) throw new Error("fixture");
    const sentence = apaSentence(outcome.finding);
    expect(sentence).toMatch(/The association was/);
    // Not a wording slip: "the difference" under an *r* is the wrong claim
    // about what was tested.
    expect(sentence).not.toMatch(/The difference/);
  });

  it("still calls a group comparison a difference", () => {
    expect(apaSentence(findingOf(independentT(CONTROL, TREATMENT)))).toMatch(/The difference was/);
  });

  // r = .98 with 95% CI [0.93, 0.99] is inconsistent on the page in a way a
  // marker notices. The zero is dropped for the same reason in both places.
  it("formats a bounded interval like the coefficient it surrounds", () => {
    // A moderate correlation on purpose. The first fixture here was near-
    // perfect, so the upper bound rounded to 1.00 and had no leading zero to
    // drop — the assertion failed against correct output.
    const outcome = pearson(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      [3, 2, 5, 4, 7, 5, 8, 7, 10, 9, 11, 10],
    );
    if (!outcome.ok) throw new Error("fixture");
    const sentence = apaSentence(outcome.finding);
    expect(sentence).toMatch(/95% CI \[\.\d\d, \.\d\d\]/);
    expect(sentence).not.toMatch(/95% CI \[0\./);
  });

  it("keeps the leading zero on an unbounded interval, which can exceed 1", () => {
    expect(apaSentence(findingOf(independentT(CONTROL, TREATMENT)))).toMatch(/95% CI \[-?\d+\.\d\d/);
  });

  it("gives the descriptives sentence a verb", () => {
    const section = resultsSection({
      findings: [],
      descriptives: [{ label: "Score", stats: summarise(CONTROL)! }],
    });
    expect(section).toMatch(/Descriptive statistics were as follows: Score/);
  });

  // "a, and b" is not a serial comma, it is a comma splice — and the first
  // version produced one on every two-group study.
  it("writes a list of two without a comma before and", () => {
    const section = resultsSection({
      findings: [],
      descriptives: [
        { label: "Control", stats: summarise(CONTROL)! },
        { label: "Treatment", stats: summarise(TREATMENT)! },
      ],
    });
    expect(section).toMatch(/\) and Treatment \(/);
    expect(section).not.toMatch(/\), and Treatment/);
  });

  it("uses the serial comma from three items, where APA asks for it", () => {
    const section = resultsSection({
      findings: [],
      descriptives: [
        { label: "A", stats: summarise(CONTROL)! },
        { label: "B", stats: summarise(TREATMENT)! },
        { label: "C", stats: summarise(CONTROL)! },
      ],
    });
    expect(section).toMatch(/\), and C \(/);
  });

  // A table stating the opposite of the truth about its own completeness.
  it("counts missing values in the table rather than reporting none", () => {
    const withGaps = summarise([1, 2, null, 4, "", 5])!;
    const table = descriptivesTable([{ label: "Score", stats: withGaps }]);
    expect(withGaps.missing).toBe(2);
    expect(table).toMatch(/\| Score \| 4 \|.*\| 2 \|/);
  });
});
