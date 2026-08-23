import { describe, expect, it } from "vitest";
import { readProposal, readingNotes } from "./citations.ts";

// A proposal with the four things that go wrong, and a contents page, because
// a contents page is what breaks a forward search for the reference list.
const PROPOSAL = `Contents

1. Introduction
2. Method
References

Introduction

Media framing of protest has been studied widely (Smith, 2020). Later work
extended this to broadcast coverage (Smith & Cole, 2021), and Ndlovu (2019)
showed the same pattern in South Africa. Van der Merwe (2018) disagreed.
References to the original transcripts were checked against the recordings.

Method

The design follows Smith (2020) throughout.

References

Ndlovu, T. (2019). Framing the student movement. Journal of African Media,
12(3), 45-67. https://doi.org/10.1234/jam.2019.45
Smith, J. Q. (2020). Protest and the press. Cambridge University Press.
Cambridge, MA: MIT Press.
Smith, J. Q., & Cole, R. (2021). Broadcast framing. Media Studies, 8(1), 1-20.
Adeyemi, F. (2015). An earlier draft's leftover. Lagos University Press.
`;

describe("reading citations out of the text", () => {
  it("reads both the bracketed and the narrative form", () => {
    const { inText } = readProposal(PROPOSAL);
    const named = inText.map((citation) => `${citation.author} ${citation.year}`);
    expect(named).toContain("Smith 2020");
    expect(named).toContain("Ndlovu 2019");
  });

  it("counts one work once, and says how often it is cited", () => {
    const { inText } = readProposal(PROPOSAL);
    const smith = inText.find((citation) => citation.year === 2020);
    expect(smith?.author).toBe("Smith");
    // Twice in the body. The reference list says it a third time, and that
    // one must not count — otherwise every listed work looks well used.
    expect(smith?.count).toBe(2);
  });

  it("treats the et al. and two-author forms as the first author", () => {
    const reading = readProposal(
      "Work continued (Smith et al., 2020) and again (Smith and Cole, 2020).\n" +
        "\nReferences\n\nSmith, J. (2020). A paper. Journal.\n",
    );
    expect(reading.inText).toHaveLength(1);
    expect(reading.inText[0]!.count).toBe(2);
    expect(reading.citedNotListed).toHaveLength(0);
  });

  it("reads a surname that is more than one word", () => {
    const { inText } = readProposal(PROPOSAL);
    expect(inText.map((citation) => citation.author)).toContain("Van der Merwe");
  });

  // Negative control for the year bound. Without it a bracketed figure or
  // section number is a citation, and a document with numbered exhibits
  // arrives full of references nobody wrote.
  it("does not read a bracketed number as a year", () => {
    const reading = readProposal(
      "See Table (1234) and Annexure (0007) for the figures.\n" +
        "\nReferences\n\nSmith, J. (2020). A paper. Journal.\n",
    );
    expect(reading.inText).toHaveLength(0);
  });

  // Negative control for the surname prefix. A rule that let any words run in
  // front of the name captured "shown by Smith", which then matched nothing
  // in the reference list and reported a present work as missing.
  it("does not swallow the words in front of a narrative citation", () => {
    const reading = readProposal(
      "As shown by Smith (2020), the effect holds.\n" +
        "\nReferences\n\nSmith, J. (2020). A paper. Journal.\n",
    );
    expect(reading.inText.map((citation) => citation.author)).toEqual(["Smith"]);
    expect(reading.citedNotListed).toHaveLength(0);
  });
});

describe("finding where the reference list starts", () => {
  it("searches backwards, so a contents page does not split the document", () => {
    const reading = readProposal(PROPOSAL);
    expect(reading.foundList).toBe(true);
    // Four entries, not the whole proposal read as a bibliography.
    expect(reading.listed).toHaveLength(4);
    expect(reading.inText.length).toBeGreaterThan(0);
  });

  // Negative control for the anchors: the body of this proposal contains the
  // sentence "References to the original transcripts were checked", and a
  // heading rule that merely looked for the word would split there.
  it("does not treat a sentence containing the word as a heading", () => {
    const reading = readProposal(
      "References to the original transcripts were checked (Smith, 2020).\n",
    );
    expect(reading.foundList).toBe(false);
    expect(reading.listed).toHaveLength(0);
  });

  it("accepts a numbered heading and the longer spellings", () => {
    for (const heading of ["7. References", "Bibliography", "List of References", "WORKS CITED"]) {
      const reading = readProposal(
        `Cited once (Smith, 2020).\n\n${heading}\n\nSmith, J. (2020). A paper. Journal.\n`,
      );
      expect(reading.foundList, heading).toBe(true);
      expect(reading.listed, heading).toHaveLength(1);
    }
  });

  it("reports no list when the document has none", () => {
    const reading = readProposal("Cited once (Smith, 2020) and no list follows.\n");
    expect(reading.foundList).toBe(false);
  });
});

describe("reading the entries", () => {
  it("joins a wrapped entry back together instead of reading it as two", () => {
    const { listed } = readProposal(PROPOSAL);
    const smith = listed.find((entry) => entry.year === 2020);
    expect(smith?.raw).toContain("Protest and the press");
    expect(smith?.raw).toContain("MIT Press");
  });

  // Negative control for the entry-start rule, and the defect that motivated
  // it: a continuation line beginning with a place name and a comma.
  it("does not start a new entry at a continuation line", () => {
    const { listed } = readProposal(PROPOSAL);
    expect(listed.map((entry) => entry.surname)).not.toContain("Cambridge");
    expect(listed).toHaveLength(4);
  });

  it("reads the surname, the year and the DOI", () => {
    const { listed } = readProposal(PROPOSAL);
    const ndlovu = listed.find((entry) => entry.surname === "Ndlovu");
    expect(ndlovu?.year).toBe(2019);
    expect(ndlovu?.doi).toBe("10.1234/jam.2019.45");
  });

  it("takes a trailing full stop off a DOI, because it does not resolve with one", () => {
    const reading = readProposal(
      "Cited (Smith, 2020).\n\nReferences\n\nSmith, J. (2020). A paper. https://doi.org/10.1000/abc.def.\n",
    );
    expect(reading.dois).toEqual(["10.1000/abc.def"]);
  });

  it("falls back to blank lines when nothing looks like an author", () => {
    const reading = readProposal(
      "Cited (Health, 2021).\n\nReferences\n\n" +
        "World Health Organization. (2021). A global report.\nGeneva: WHO Press.\n\n" +
        "United Nations. (2019). Another report.\n",
    );
    expect(reading.listed).toHaveLength(2);
    expect(reading.listed[0]!.raw).toContain("Geneva");
  });
});

describe("what a supervisor finds first", () => {
  it("names what is cited and not listed", () => {
    const { citedNotListed } = readProposal(PROPOSAL);
    expect(citedNotListed.map((citation) => citation.author)).toEqual(["Van der Merwe"]);
  });

  it("names what is listed and never cited", () => {
    const { listedNotCited } = readProposal(PROPOSAL);
    expect(listedNotCited.map((entry) => entry.surname)).toEqual(["Adeyemi"]);
  });

  // The pair that keeps the matcher honest: it must find a work written one
  // way in the text and another in the list, and it must still be able to say
  // missing. A matcher that never reported anything would pass the first of
  // these on its own.
  it("matches across initials, so a present reference is not called missing", () => {
    const reading = readProposal(
      "Argued before (Smith, 2020).\n\nReferences\n\nSmith, J. Q. (2020). A paper. Journal.\n",
    );
    expect(reading.citedNotListed).toHaveLength(0);
  });

  it("still reports a work that really is absent", () => {
    const reading = readProposal(
      "Argued before (Ngcobo, 2020).\n\nReferences\n\nSmith, J. Q. (2020). A paper. Journal.\n",
    );
    expect(reading.citedNotListed.map((citation) => citation.author)).toEqual(["Ngcobo"]);
  });

  it("collects every DOI once, however often it appears", () => {
    const reading = readProposal(
      "See https://doi.org/10.1234/JAM.2019.45 for the data.\n\nReferences\n\n" +
        "Ndlovu, T. (2019). A paper. Journal. https://doi.org/10.1234/jam.2019.45\n",
    );
    expect(reading.dois).toEqual(["10.1234/jam.2019.45"]);
  });
});

describe("the sentences a student reads", () => {
  it("says nothing when there is nothing to say", () => {
    const reading = readProposal(
      "Smith (2020) and Cole (2021) agree. Smith (2020) is central, and Cole (2021) is too.\n\n" +
        "References\n\n" +
        "Smith, J. (2020). One. Journal. https://doi.org/10.1000/aaa\n" +
        "Cole, R. (2021). Two. Journal. https://doi.org/10.2000/bbb\n",
    );
    expect(readingNotes(reading)).toEqual([]);
  });

  it("stops at the absent list, because otherwise every citation reads as missing", () => {
    const reading = readProposal("Argued before (Smith, 2020) and again (Cole, 2021).\n");
    const notes = readingNotes(reading);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain("No reference list was found");
    // The trap this guards: two citations, neither listed, and no list.
    expect(reading.citedNotListed).toHaveLength(2);
  });

  it("stops again when the heading is there and nothing under it parses", () => {
    const reading = readProposal("Argued before (Smith, 2020).\n\nReferences\n\n1.\n");
    expect(reading.foundList).toBe(true);
    expect(reading.listed).toHaveLength(0);
    const notes = readingNotes(reading);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain("no entries could be read");
  });

  it("inflects, because a report that says 1 works are is a report nobody trusts", () => {
    const notes = readingNotes(readProposal(PROPOSAL));
    expect(notes.some((note) => note.startsWith("1 work is cited in the text"))).toBe(true);
    expect(notes.some((note) => note.startsWith("1 reference is listed"))).toBe(true);
    expect(notes.join(" ")).not.toMatch(/\b1 \w+s are\b/);
  });

  it("explains why a match may be spurious, rather than leaving the student to guess", () => {
    const notes = readingNotes(readProposal(PROPOSAL));
    const missing = notes.find((note) => note.includes("not in the reference list"));
    expect(missing).toContain("surname and year");
    expect(missing).toContain("Act or a place name");
  });

  it("names five and then stops counting them out", () => {
    const body = Array.from(
      { length: 8 },
      (_, index) => `A claim (Author${String.fromCharCode(65 + index)}, 200${index}).`,
    ).join(" ");
    const notes = readingNotes(
      readProposal(`${body}\n\nReferences\n\nSmith, J. (1999). A paper. Journal.\n`),
    );
    const missing = notes.find((note) => note.includes("not in the reference list"))!;
    expect(missing).toContain("8 works are");
    expect(missing).toContain(", and others");
    expect(missing.match(/Author[A-H] \(200\d\)/g)).toHaveLength(5);
  });

  it("says when nothing can be checked automatically", () => {
    const reading = readProposal(
      "Argued before (Smith, 2020).\n\nReferences\n\nSmith, J. (2020). A paper. Journal.\n",
    );
    const notes = readingNotes(reading);
    expect(notes.some((note) => note.includes("does not carry") || note.includes("carries"))).toBe(true);
    expect(notes.join(" ")).toContain("is not itself a problem");
  });
});
