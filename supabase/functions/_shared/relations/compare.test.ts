import { describe, expect, it } from "vitest";
import {
  differsOnlyInWording,
  normaliseStatement,
  numbersIn,
  numericDisagreements,
  overlap,
} from "./compare.ts";

describe("normalising a statement for comparison", () => {
  it("folds case, whitespace and typographic punctuation", () => {
    expect(normaliseStatement("The  meeting  was RESCHEDULED."))
      .toBe(normaliseStatement("the meeting was rescheduled"));
    expect(normaliseStatement("it was Smith’s van"))
      .toBe(normaliseStatement("it was Smith's van"));
  });

  it("keeps an apostrophe and a hyphen inside a word", () => {
    expect(normaliseStatement("twenty-two o'clock")).toBe("twenty-two o'clock");
  });

  // The bug this guards: an em dash becomes a hyphen, and a hyphen standing
  // alone survives as a word, making punctuation the difference between two
  // identical accounts.
  it("drops a dash left standing on its own", () => {
    expect(differsOnlyInWording("he left — quickly", "he left quickly")).toBe(true);
  });

  it("drops only the filler words, and not the content ones", () => {
    expect(normaliseStatement("the van was approximately there")).toBe("van was there");
    expect(normaliseStatement("no van was there")).toContain("no");
  });
});

describe("two statements that say the same thing", () => {
  it("recognises a rephrasing", () => {
    expect(differsOnlyInWording("The meeting was moved.", "the meeting was moved"))
      .toBe(true);
  });

  // The whole point of the conservative design: it answers "are these plainly
  // the same", not "do these mean the same". A synonym is a different
  // statement here, and must be.
  it("does not claim two different sentences are the same", () => {
    expect(differsOnlyInWording("the meeting was moved", "the meeting was cancelled"))
      .toBe(false);
    expect(differsOnlyInWording("he arrived at nine", "he arrived at ten")).toBe(false);
  });
});

describe("finding the numbers in a statement", () => {
  it("carries the words either side, so context survives", () => {
    const found = numbersIn("the ward reported 40 cases in March");
    expect(found).toHaveLength(1);
    expect(found[0]!.value).toBe(40);
    expect(found[0]!.context).toContain("ward");
    expect(found[0]!.context).toContain("cases");
  });

  it("finds nothing in a statement with no numbers", () => {
    expect(numbersIn("the ward reported several cases")).toEqual([]);
  });

  it("measures how much two contexts share", () => {
    expect(overlap("ward reported cases", "ward reported cases")).toBe(1);
    expect(overlap("ward reported cases", "contract ran months")).toBe(0);
    expect(overlap("", "anything")).toBe(0);
  });
});

describe("numbers that disagree about the same thing", () => {
  it("reports two figures for the same quantity", () => {
    const found = numericDisagreements(
      "the ward reported 40 cases in March",
      "the ward reported 52 cases in March",
    );
    expect(found).toHaveLength(1);
    expect(found[0]!.left.value).toBe(40);
    expect(found[0]!.right.value).toBe(52);
  });

  // The conservative half, and the reason the context threshold exists. Both
  // sentences contain a number and they contradict nothing.
  it("says nothing about two numbers describing different things", () => {
    // Digits, not words. "forty" and "forty-two" have no numeric token in
    // them at all, so a fixture written that way passes whatever the context
    // threshold does and proves nothing about it.
    expect(numericDisagreements(
      "40 were affected by the outage",
      "the contract ran for 42 months",
    )).toEqual([]);
  });

  it("says nothing when the figures agree", () => {
    expect(numericDisagreements(
      "the ward reported 40 cases in March",
      "the ward reported 40 cases in March",
    )).toEqual([]);
  });

  // A pair of values is reported once. Four findings saying the same thing is
  // how a reader learns to skim them.
  it("reports a pair of values once, however often they appear", () => {
    const found = numericDisagreements(
      "the ward reported 40 cases; the ward reported 40 cases again",
      "the ward reported 52 cases; the ward reported 52 cases again",
    );
    expect(found).toHaveLength(1);
  });

  it("takes a stricter or looser threshold when the caller sets one", () => {
    const loose = numericDisagreements(
      "40 were affected by the outage",
      "the contract ran for 42 months",
      { contextOverlap: 0 },
    );
    expect(loose.length).toBeGreaterThan(0);

    const strict = numericDisagreements(
      "the ward reported 40 cases in March",
      "the ward reported 52 cases in April",
      { contextOverlap: 1 },
    );
    expect(strict).toEqual([]);
  });
});
