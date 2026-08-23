import { describe, expect, it } from "vitest";
import { checkCoherence } from "../method/coherence.ts";
import {
  ALLOCATION_WORDS,
  PARADIGM_WORDS,
  QUESTION_WORDS,
  SAMPLING_WORDS,
  SATURATION_WORDS,
  THEORY_WORDS,
  designFrom,
  designNotes,
  readDesign,
  sentencesIn,
} from "./design.ts";
import type { Read } from "./design.ts";

// A methodology chapter in the register they are actually written in: a
// literature review in front of it that names a different paradigm, and its
// own procedure in the passive voice throughout.
const PROPOSAL = `Chapter Two: Literature Review

Positivism dominated early media research, and much of the work of the 1970s
was conducted within it. Later scholarship moved away from that position.

Chapter Three: Methodology

This study adopts an interpretivist paradigm (Creswell, 2014). Data will be
analysed using critical discourse analysis, following Fairclough. Twelve
participants will be recruited through purposive sampling. Interviewing
continues until data saturation is reached.

The research question is: how do community broadcasters describe the
obligations they owe the audiences they serve?

Chapter Four: Findings

Findings will be reported thematically.
`;

describe("reading the paradigm", () => {
  it("reads the one the study declares", () => {
    const reading = readDesign(PROPOSAL);
    expect(reading.paradigm?.value).toBe("interpretivism");
    expect(reading.paradigm?.how).toBe("declared");
  });

  // Negative control for the declared-beats-mentioned rule. The literature
  // review names positivism first, and a reader that took the earliest match
  // in the document would report this study as positivist.
  it("does not let the literature review decide it", () => {
    const reading = readDesign(PROPOSAL);
    expect(reading.paradigm?.value).not.toBe("positivism");
  });

  it("reports a paradigm that is only mentioned as only mentioned", () => {
    const reading = readDesign("Positivism dominated early media research.\n");
    expect(reading.paradigm?.value).toBe("positivism");
    expect(reading.paradigm?.how).toBe("mentioned");
  });

  // Negative control for the earliest-position rule. Both of these contain a
  // shorter paradigm word inside the longer one, and the shorter one is the
  // reading a naive scan produces.
  it("does not read critical realism as realism, or post-positivism as positivism", () => {
    expect(readDesign("This study takes a critical realist position.\n").paradigm?.value)
      .toBe("critical_realism");
    expect(readDesign("This study is post-positivist in orientation.\n").paradigm?.value)
      .toBe("post_positivism");
  });
});

describe("reading the rest of the design", () => {
  it("reads a theory named in the passive voice inside the methodology chapter", () => {
    const reading = readDesign(PROPOSAL);
    expect(reading.theory?.value).toBe("critical_discourse_theory");
    // The sentence says nothing about whose study it is. Sitting in the
    // methodology chapter is what makes it a declaration.
    expect(reading.theory?.how).toBe("declared");
    expect(reading.theory?.evidence).not.toMatch(/this study/i);
  });

  // Negative control for the section rule: with no methodology heading, the
  // same passive sentence is not a declaration.
  it("does not take the same sentence as a declaration outside that chapter", () => {
    const reading = readDesign(
      "Data will be analysed using critical discourse analysis, following Fairclough.\n",
    );
    expect(reading.theory?.value).toBe("critical_discourse_theory");
    expect(reading.theory?.how).toBe("mentioned");
  });

  it("does not read critical discourse analysis as plain discourse analysis", () => {
    const reading = readDesign("Methodology\n\nCritical discourse analysis is used.\n");
    expect(reading.theory?.value).toBe("critical_discourse_theory");
  });

  it("reads the sampling approach", () => {
    expect(readDesign(PROPOSAL).sampling?.value).toBe("purposive");
  });

  it("reads a sample size written as a word, and one written as n", () => {
    expect(readDesign(PROPOSAL).sampleSize?.value).toBe(12);
    expect(readDesign("Method\n\nA survey of n = 240 was administered.\n").sampleSize?.value)
      .toBe(240);
  });

  // Negative control for the counted-noun requirement: a bare number in a
  // methodology chapter is not a sample size.
  it("does not read a duration or a page count as a sample", () => {
    expect(readDesign("Method\n\nFieldwork ran for 12 months across 3 sites.\n").sampleSize)
      .toBeNull();
  });

  it("reads a saturation claim", () => {
    expect(readDesign(PROPOSAL).claimsSaturation?.value).toBe(true);
  });
});

describe("sampling and allocation are not the same thing", () => {
  it("does not read random allocation as random sampling", () => {
    const reading = readDesign("Method\n\nParticipants were randomly assigned to two arms.\n");
    expect(reading.randomised?.value).toBe(true);
    expect(reading.sampling).toBeNull();
  });

  it("does not read random sampling as random allocation", () => {
    const reading = readDesign("Method\n\nA stratified random sample of schools was drawn.\n");
    expect(reading.sampling?.value).toBe("statistical");
    expect(reading.randomised).toBeNull();
  });

  it("says so when a proposal claims both", () => {
    const notes = designNotes(
      readDesign(
        "Method\n\nA stratified random sample of schools was drawn. Pupils were then randomly assigned to two arms.\n",
      ),
    );
    expect(notes.some((note) => note.includes("only allocation supports a causal claim"))).toBe(true);
  });

  it("reads a quasi-experimental design as not randomised", () => {
    expect(readDesign("Method\n\nA quasi-experimental design is used.\n").randomised?.value)
      .toBe(false);
  });
});

describe("the question type is read only from a question", () => {
  it("reads it from the research question", () => {
    expect(readDesign(PROPOSAL).questionType?.value).toBe("exploratory");
  });

  it("reads a causal question as causal", () => {
    const reading = readDesign(
      "Method\n\nThe research question is: what is the effect of feedback on marks?\n",
    );
    expect(reading.questionType?.value).toBe("causal");
  });

  // Negative control, and the reason the restriction exists: nearly every
  // proposal ever written says "explores" in its opening paragraph.
  it("does not classify a study from the word explores in a statement", () => {
    const reading = readDesign(
      "Method\n\nThis study explores how teachers describe the effect of feedback.\n",
    );
    expect(reading.questionType).toBeNull();
    expect(reading.notStated).toContain("the research question, written as a question");
  });
});

describe("evidence", () => {
  it("always contains the words it was read from", () => {
    for (const text of [PROPOSAL, "Positivism dominated early research.\n", `Method\n\n${"filler ".repeat(200)}using purposive sampling ${"more ".repeat(200)}.\n`]) {
      const reading = readDesign(text);
      const reads: (Read<unknown> | null)[] = [
        reading.paradigm, reading.theory, reading.sampling,
        reading.sampleSize, reading.questionType, reading.randomised,
        reading.claimsSaturation,
      ];
      for (const read of reads) {
        if (read === null) continue;
        expect(read.evidence, read.phrase).toContain(read.phrase);
      }
    }
  });

  it("windows a runaway sentence rather than cutting the front off it", () => {
    const reading = readDesign(
      `Method\n\n${"filler ".repeat(300)}using purposive sampling ${"more ".repeat(300)}.\n`,
    );
    expect(reading.sampling?.evidence).toContain("purposive sampling");
    expect(reading.sampling!.evidence.length).toBeLessThan(400);
  });
});

describe("handing the design to the coherence check", () => {
  it("gives it the declared fields", () => {
    const design = designFrom(readDesign(PROPOSAL));
    expect(design).not.toBeNull();
    expect(design!.paradigm).toBe("interpretivism");
    expect(design!.sampling).toBe("purposive");
    expect(design!.sampleSize).toBe(12);
  });

  it("refuses when nothing declared a paradigm, because there is nothing to check against", () => {
    const reading = readDesign("Positivism dominated early media research.\n");
    expect(reading.paradigm?.how).toBe("mentioned");
    expect(designFrom(reading)).toBeNull();
  });

  // Negative control for the refusal above: a mentioned paradigm must not
  // reach the coherence check, because the tension it raises would be about
  // somebody else's study.
  it("raises no tension against a paradigm the study never claimed", () => {
    const design = designFrom(
      readDesign("Positivism dominated early research. Twelve participants were interviewed.\n"),
    );
    expect(design).toBeNull();
  });

  it("finds the real tension when the design is declared and pulls apart", () => {
    const design = designFrom(
      readDesign(
        "Chapter Three: Methodology\n\nThis study adopts an interpretivist paradigm. A stratified random sample of n = 400 was drawn.\n",
      ),
    );
    expect(design).not.toBeNull();
    const tensions = checkCoherence(design!);
    expect(tensions.length).toBeGreaterThan(0);
  });
});

describe("what the student is told", () => {
  it("names what the proposal never states", () => {
    const reading = readDesign("Method\n\nThis study adopts an interpretivist paradigm.\n");
    expect(reading.notStated).toContain("how the sample was chosen");
    expect(reading.notStated).toContain("how large the sample is");
    const notes = designNotes(reading);
    expect(notes.some((note) => note.includes("how large the sample is"))).toBe(true);
  });

  it("does not list an absent random allocation as a gap", () => {
    const reading = readDesign(PROPOSAL);
    expect(reading.randomised).toBeNull();
    expect(reading.notStated.join(" ")).not.toMatch(/allocation/i);
  });

  it("explains why a mentioned paradigm turned the check off", () => {
    const notes = designNotes(readDesign("Positivism dominated early media research.\n"));
    expect(notes[0]).toContain("not in a sentence about this study");
    expect(notes[0]).toContain("coherence check was not run");
  });

  it("says the reading is by phrase, not by meaning", () => {
    const notes = designNotes(readDesign("Method\n\nThis study is interpretivist.\n"));
    expect(notes.join(" ")).toContain("reads phrases, not meaning");
  });
});

describe("splitting a proposal into sentences", () => {
  it("does not split at an abbreviation or an initial", () => {
    expect(sentencesIn("Several authors, e.g. Smith, disagree. Others do not.")).toHaveLength(2);
    expect(sentencesIn("It was argued by Smith, J. Q. that this holds.")).toHaveLength(1);
  });

  it("joins a sentence that was wrapped across lines", () => {
    expect(sentencesIn("This study adopts an\ninterpretivist paradigm.")).toEqual([
      "This study adopts an interpretivist paradigm.",
    ]);
  });

  it("returns nothing for nothing", () => {
    expect(sentencesIn("   \n\n  ")).toEqual([]);
  });
});

// The phrase tables are the whole of this module's knowledge, and earliest
// position is the only rule that resolves between them. These two hold that
// arrangement together: every phrase must be read as the value it is listed
// under, and no phrase may start where a phrase of a different value starts.
describe("the phrase tables stay unambiguous", () => {
  const tables = {
    paradigm: PARADIGM_WORDS,
    theory: THEORY_WORDS,
    sampling: SAMPLING_WORDS,
    allocation: ALLOCATION_WORDS,
    question: QUESTION_WORDS,
    saturation: { claimed: SATURATION_WORDS },
  } as const;

  it("has no phrase that is a prefix of another value's phrase", () => {
    const collisions: string[] = [];
    for (const [table, byValue] of Object.entries(tables)) {
      const listed = Object.entries(byValue as Record<string, readonly string[]>)
        .flatMap(([value, phrases]) => phrases.map((phrase) => ({ value, phrase })));
      for (const one of listed) {
        for (const other of listed) {
          // Not skipping an identical pair: the same phrase listed under two
          // values is the worst version of this, and startsWith catches it.
          if (one.value === other.value) continue;
          if (other.phrase.startsWith(one.phrase)) {
            collisions.push(`${table}: "${one.phrase}" (${one.value}) starts "${other.phrase}" (${other.value})`);
          }
        }
      }
    }
    expect(collisions).toEqual([]);
  });

  it("reads every phrase back as the value it is listed under", () => {
    const wrong: string[] = [];

    for (const [value, phrases] of Object.entries(PARADIGM_WORDS)) {
      for (const phrase of phrases) {
        const read = readDesign(`Methodology\n\nThe ${phrase} position is taken.\n`).paradigm;
        if (read?.value !== value) wrong.push(`paradigm "${phrase}" read as ${String(read?.value)}`);
      }
    }
    for (const [value, phrases] of Object.entries(THEORY_WORDS)) {
      for (const phrase of phrases) {
        const read = readDesign(`Methodology\n\nAnalysis uses ${phrase} throughout.\n`).theory;
        if (read?.value !== value) wrong.push(`theory "${phrase}" read as ${String(read?.value)}`);
      }
    }
    for (const [value, phrases] of Object.entries(SAMPLING_WORDS)) {
      for (const phrase of phrases) {
        const read = readDesign(`Methodology\n\nCases came from ${phrase} of the frame.\n`).sampling;
        if (read?.value !== value) wrong.push(`sampling "${phrase}" read as ${String(read?.value)}`);
      }
    }
    for (const [value, phrases] of Object.entries(ALLOCATION_WORDS)) {
      for (const phrase of phrases) {
        const read = readDesign(`Methodology\n\nThe trial was ${phrase} in design.\n`).randomised;
        if (read?.value !== (value === "yes")) {
          wrong.push(`allocation "${phrase}" read as ${String(read?.value)}`);
        }
      }
    }
    for (const [value, phrases] of Object.entries(QUESTION_WORDS)) {
      for (const phrase of phrases) {
        const read = readDesign(`Methodology\n\nWhat about ${phrase} the thing?\n`).questionType;
        if (read?.value !== value) wrong.push(`question "${phrase}" read as ${String(read?.value)}`);
      }
    }
    for (const phrase of SATURATION_WORDS) {
      const read = readDesign(`Methodology\n\nSampling continued and ${phrase} applied.\n`);
      if (read.claimsSaturation?.value !== true) wrong.push(`saturation "${phrase}" not read`);
    }

    expect(wrong).toEqual([]);
  });
});
