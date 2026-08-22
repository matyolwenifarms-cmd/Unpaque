// The results section, written from the findings rather than generated.
//
// This is the part of "write it up" that is mechanical, and it is a larger part
// than it looks. APA 7 chapter 6 fixes almost every choice: which statistics
// are italicised, how many decimals a p carries, that a proportion never gets a
// leading zero, that an exact p is preferred to an inequality except below
// .001, that a confidence interval is written 95% CI [a, b] with a comma and
// no units repeated. None of that needs judgement. Getting it wrong is the
// commonest reason a results section comes back from a supervisor.
//
// What is deliberately **not** here: the discussion. Interpretation is the
// researcher's argument and a model's guess at it would be exactly the thing
// §8 is about — a tool one positioning decision away from producing work a
// student submits as their own. This writes what the numbers say. What they
// mean is not a formatting problem.
//
// Markdown for italics, because the output has to survive being pasted into
// Word, Google Docs and a plain-text field, and asterisks are the one
// convention all three either honour or leave legible.

import type { Descriptives } from "./describe.ts";
import { familyOf } from "./corrections.ts";
import type { Finding } from "./result.ts";

/**
 * A p-value in APA form.
 *
 * Three decimals, no leading zero — a p cannot exceed 1, so the zero carries
 * no information and APA drops it. Below .001 the convention is the inequality
 * rather than a fourth decimal, because the exact value there is an artefact
 * of the arithmetic rather than a fact about the data.
 */
export function apaP(p: number): string {
  if (!Number.isFinite(p)) return "*p* = —";
  if (p < 0.001) return "*p* < .001";
  return `*p* = ${p.toFixed(3).replace(/^0/, "")}`;
}

/** A statistic to two decimals, which is APA's default for test statistics. */
export function apaNumber(value: number, places = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(places);
}

/**
 * A correlation or other bounded coefficient: no leading zero, two decimals.
 *
 * Same rule as p and for the same reason — r, η² and V cannot exceed 1.
 */
export function apaBounded(value: number, places = 2): string {
  if (!Number.isFinite(value)) return "—";
  const fixed = Math.abs(value).toFixed(places).replace(/^0/, "");
  return value < 0 ? `-${fixed}` : fixed;
}

const EFFECT_SYMBOLS: Record<string, string> = {
  cohens_d: "*d*",
  hedges_g: "*g*",
  pearson_r: "*r*",
  spearman_rho: "*r*~s~",
  eta_squared: "η²",
  partial_eta_squared: "η²~p~",
  cramers_v: "*V*",
  odds_ratio: "*OR*",
  cohens_w: "*w*",
};

/** Bounded coefficients drop the leading zero; d and g do not, being unbounded. */
const UNBOUNDED = new Set(["cohens_d", "hedges_g", "odds_ratio"]);

/** Effects that measure how two things go together rather than how far apart. */
const ASSOCIATION = new Set([
  "pearson_r", "spearman_rho", "cramers_v", "cohens_w", "eta_squared", "partial_eta_squared",
]);

/** One finding as the sentence a results section carries. */
export function apaSentence(finding: Finding): string {
  const df = typeof finding.degreesOfFreedom === "number"
    ? apaNumber(finding.degreesOfFreedom, Number.isInteger(finding.degreesOfFreedom) ? 0 : 2)
    : `${finding.degreesOfFreedom.between}, ${finding.degreesOfFreedom.within}`;

  const symbol = finding.statistic.symbol === "χ²" ? "χ²" : `*${finding.statistic.symbol}*`;
  const statistic = `${symbol}(${df}) = ${apaNumber(finding.statistic.value)}`;

  const effectSymbol = EFFECT_SYMBOLS[finding.effect.kind] ?? finding.effect.kind;
  const effectValue = UNBOUNDED.has(finding.effect.kind)
    ? apaNumber(finding.effect.value)
    : apaBounded(finding.effect.value);
  const effect = `${effectSymbol} = ${effectValue}`;

  // The interval formats like the estimate it surrounds. A correlation
  // reported as r = .98 with 95% CI [0.93, 0.99] is inconsistent on the page
  // in a way a marker notices — the leading zero is dropped for the same
  // reason in both places, that the quantity cannot exceed 1.
  const bounded = !UNBOUNDED.has(finding.effect.kind) && ASSOCIATION.has(finding.effect.kind);
  const format = bounded ? apaBounded : apaNumber;
  const ci = `95% CI [${format(finding.interval.lower)}, ${format(finding.interval.upper)}]`;

  // A correlation does not test a difference. Hard-coding "difference" put
  // "The difference was statistically significant" under an *r*, which is not
  // a wording slip — it is the wrong claim about what was tested.
  const noun = ASSOCIATION.has(finding.effect.kind) ? "association" : "difference";

  // "was not statistically significant", never "there was no difference". A
  // failure to reject says this study did not detect one; it says nothing
  // about whether one exists, and the two sentences are not interchangeable
  // however often they are swapped.
  const verdict = finding.p < 0.05
    ? `The ${noun} was statistically significant`
    : `The ${noun} was not statistically significant`;

  return `${statistic}, ${apaP(finding.p)}, ${effect}, ${ci}. ${verdict}.`;
}

/** A group's descriptives, in the form APA wants them inline. */
export function apaDescriptives(label: string, stats: Descriptives): string {
  return `${label} (*n* = ${stats.n}, *M* = ${apaNumber(stats.mean)}, *SD* = ${apaNumber(stats.sd)})`;
}

export interface ReportInput {
  findings: Finding[];
  /** Named groups or variables, for the descriptives paragraph. */
  descriptives?: Array<{ label: string; stats: Descriptives }>;
  /** Rows in the file, before any procedure dropped anything. */
  rowsInFile?: number;
}

/**
 * A results section, in markdown.
 *
 * Structured the way APA orders one: what was collected, what was checked,
 * what was found, and what qualifies it. The qualifications are inside the
 * section rather than after it, because a limitation that lives in its own
 * paragraph at the end is a limitation the reader has already formed their
 * conclusion without.
 */
export function resultsSection(input: ReportInput): string {
  const parts: string[] = ["## Results"];

  if (input.descriptives?.length) {
    const described = input.descriptives.map(({ label, stats }) => apaDescriptives(label, stats));
    parts.push(
      `Descriptive statistics were as follows: ${sentenceList(described)}.` +
        (input.rowsInFile
          ? ` The file held ${input.rowsInFile} rows; the *n* reported for each analysis is the number of complete observations it used.`
          : ""),
    );
  }

  if (input.findings.length === 0) {
    parts.push("*No analyses have been run yet.*");
    return parts.join("\n\n");
  }

  // Assumptions before results, which is the order APA asks for and the order
  // that matters: a reader who meets the p first has already believed it.
  const unmet = input.findings.flatMap((finding) =>
    finding.assumptions
      .filter((check) => check.status === "unmet")
      .map((check) => `${finding.test}: ${check.detail}`),
  );
  const unknown = input.findings.flatMap((finding) =>
    finding.assumptions
      .filter((check) => check.status === "not_assessable" && /Independence/.test(check.name))
      .map(() => finding.test),
  );

  const assumptionLines: string[] = [];
  if (unmet.length > 0) {
    assumptionLines.push(
      `Assumptions were checked before testing. The following were not met: ${unmet.join(" ")}`,
    );
  } else {
    assumptionLines.push("Assumptions were checked before testing and none was violated.");
  }
  if (unknown.length > 0) {
    assumptionLines.push(
      "Independence of observations cannot be established from the data and rests on the sampling procedure described in the method.",
    );
  }
  parts.push(assumptionLines.join(" "));

  for (const finding of input.findings) {
    parts.push(`${finding.test}. ${apaSentence(finding)}`);
  }

  const comparisons = Math.max(...input.findings.map((finding) => finding.comparisons), 1);
  if (comparisons > 1) {
    const family = familyOf(comparisons);
    parts.push(
      `${comparisons} comparisons were conducted. Reported *p* values are uncorrected; across a family of this size the probability of at least one false positive is ${Math.round(family.familywiseError * 100)}% if no effect is present.`,
    );
  }

  const nonSignificant = input.findings.filter((finding) => finding.p >= 0.05).length;
  if (nonSignificant > 0) {
    parts.push(
      `${nonSignificant === input.findings.length ? "These analyses" : `${nonSignificant} of these analyses`} did not detect an effect. A non-significant result is not evidence that no effect exists; it indicates that this study, at this sample size, did not detect one.`,
    );
  }

  return parts.join("\n\n");
}

/**
 * A descriptives table, APA Table 1.
 *
 * Markdown rather than HTML: it pastes into Word as a table, into Google Docs
 * as a table, and into a plain-text field as something still readable.
 */
export function descriptivesTable(rows: Array<{ label: string; stats: Descriptives }>): string {
  if (rows.length === 0) return "";
  const header = "| Variable | *n* | *M* | *SD* | Min | Max | Missing |";
  const rule = "|---|---|---|---|---|---|---|";
  const body = rows.map(({ label, stats }) =>
    `| ${label} | ${stats.n} | ${apaNumber(stats.mean)} | ${apaNumber(stats.sd)} | ${apaNumber(stats.min)} | ${apaNumber(stats.max)} | ${stats.missing} |`,
  );
  return ["**Table 1**", "", "*Descriptive statistics*", "", header, rule, ...body].join("\n");
}

function sentenceList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  // No comma before "and" on a list of two — "a, and b" is not a serial comma,
  // it is a comma splice, and the first version of this produced one on every
  // two-group study. The serial comma applies from three items, which is where
  // its absence creates a real ambiguity and where APA asks for it.
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
