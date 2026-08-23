import { describe, expect, it } from "vitest";
import {
  assembleWriteUp,
  renderWriteUp,
  type Section,
  type Supplied,
} from "./document.ts";
import { findingsSection } from "./findings.ts";
import { assembleThemes, type ThemeDraft } from "../qualitative/themes.ts";
import type { Code } from "../qualitative/codebook.ts";
import type { Coding } from "../qualitative/coding.ts";
import { readSaturation } from "../qualitative/saturation.ts";
import { apaAuthor, apaAuthors, apaReference, referenceList } from "./references.ts";
import type { Reference } from "../reference.ts";

const FULL: Supplied = {
  method: { markdown: "## Methodology\n\nAn interpretivist study.", gaps: ["the justification"] },
  results: { markdown: "## Results\n\nt(38) = 2.11, p = .041.", from: "1 finding on cohort.csv" },
  findings: { markdown: "## Findings\n\nOne theme.", from: "1 theme across 4 transcripts" },
  references: { markdown: "## References\n\nSmith, J. (2020).", count: 1 },
};

const find = (sections: Section[], id: string) => sections.find((section) => section.id === id)!;

describe("what the write-up will and will not write", () => {
  // The refusal is in the type: a section that is the researcher's has no
  // field a body could be put into, so no later change fills them by accident.
  it("marks the introduction, literature, discussion, limitations and conclusion as the researcher's", () => {
    const document = assembleWriteUp("A study", FULL);
    for (const id of ["introduction", "literature", "discussion", "limitations", "conclusion"]) {
      const section = find(document.sections, id);
      expect(section.kind).toBe("yours");
      expect(section).not.toHaveProperty("markdown");
    }
    expect(document.yours).toBe(5);
  });

  it("transcribes the method, results, findings and references when they exist", () => {
    const document = assembleWriteUp("A study", FULL);
    for (const id of ["method", "results", "findings", "references"]) {
      expect(find(document.sections, id).kind).toBe("transcribed");
    }
    expect(document.transcribed).toBe(4);
    expect(document.waiting).toBe(0);
  });

  it("distinguishes work not done yet from work only the researcher can do", () => {
    const document = assembleWriteUp("A study", {});
    expect(find(document.sections, "results").kind).toBe("waiting");
    expect(find(document.sections, "discussion").kind).toBe("yours");
    expect(document.waiting).toBe(4);
    expect(document.transcribed).toBe(0);
  });

  it("says what to do in Unpaque to fill a waiting section", () => {
    const document = assembleWriteUp("A study", {});
    const results = find(document.sections, "results");
    if (results.kind !== "waiting") throw new Error("expected waiting");
    expect(results.says).toMatch(/Run an analysis under Analyse data/);
  });

  // The methodology statement carries its own marked gaps. Stripping them
  // would make a chapter with the argument silently removed read finished.
  it("keeps the method statement's own gaps and counts them", () => {
    const document = assembleWriteUp("A study", FULL);
    const method = find(document.sections, "method");
    if (method.kind !== "transcribed") throw new Error("expected transcribed");
    expect(method.from).toMatch(/1 paragraph inside it is still yours to write/);
  });

  it("reads the order a report is read in", () => {
    expect(assembleWriteUp("A study", FULL).sections.map((section) => section.id)).toEqual([
      "introduction", "literature", "method", "results", "findings",
      "discussion", "limitations", "conclusion", "references",
    ]);
  });

  it("names an untitled study rather than rendering an empty heading", () => {
    expect(assembleWriteUp("   ", {}).title).toBe("Untitled study");
  });
});

describe("the exported document", () => {
  it("says at the top that it is a skeleton and how much of it is unwritten", () => {
    const markdown = renderWriteUp(assembleWriteUp("A study", FULL));
    expect(markdown).toMatch(/^# A study/);
    expect(markdown).toMatch(/\*\*This is a draft skeleton, not a report\.\*\*/);
    expect(markdown).toMatch(/4 of 9 sections below are assembled from work you did/);
    expect(markdown).toMatch(/The remaining 5 are yours/);
  });

  // The first document generated from this said "the other 6 are yours" when
  // one of the six was a Results section waiting on an analysis nobody had
  // run. Work still to do and work nothing here will ever do are different
  // problems and are counted separately.
  it("does not call a section waiting on your analysis a section only you can write", () => {
    const markdown = renderWriteUp(assembleWriteUp("A study", { ...FULL, results: undefined }));
    expect(markdown).toMatch(/1 is waiting on work not done yet/);
    expect(markdown).toMatch(/The remaining 5 are yours/);
  });

  it("counts several waiting sections in the plural", () => {
    const markdown = renderWriteUp(assembleWriteUp("A study", {}));
    expect(markdown).toMatch(/4 are waiting on work not done yet/);
  });

  // A document exported with silent gaps is one somebody skims and submits.
  it("renders every unwritten section as a visible refusal, not blank space", () => {
    const markdown = renderWriteUp(assembleWriteUp("A study", FULL));
    for (const title of ["Introduction", "Literature review", "Discussion", "Limitations", "Conclusion"]) {
      expect(markdown).toContain(`## ${title}`);
    }
    expect(markdown).toMatch(/> \*\*This section is yours to write\.\*\*/);
    expect((markdown.match(/This section is yours to write/g) ?? [])).toHaveLength(5);
  });

  it("gives the reason it will not write each one", () => {
    const markdown = renderWriteUp(assembleWriteUp("A study", FULL));
    expect(markdown).toMatch(/restate them in longer sentences and call it interpretation/);
    expect(markdown).toMatch(/the one sentence you are answerable for/);
  });

  it("states what each transcribed section was assembled from", () => {
    const markdown = renderWriteUp(assembleWriteUp("A study", FULL));
    expect(markdown).toMatch(/\*Assembled from: 1 finding on cohort\.csv\*/);
    expect(markdown).toMatch(/\*Assembled from: 1 reference, resolved against a bibliographic provider\.\*/);
  });

  // resultsSection() and methodStatement() both open with their own heading.
  it("does not print a heading twice over a section that brought its own", () => {
    const markdown = renderWriteUp(assembleWriteUp("A study", FULL));
    expect(markdown).not.toMatch(/## Results\s*\n+\s*## Results/);
    expect((markdown.match(/^## Results$/gm) ?? [])).toHaveLength(1);
  });

  it("adds a heading to a section that did not bring one", () => {
    const markdown = renderWriteUp(
      assembleWriteUp("A study", { results: { markdown: "t(38) = 2.11.", from: "one finding" } }),
    );
    expect(markdown).toMatch(/## Results\n\nt\(38\) = 2\.11\./);
  });

  it("never writes a conclusion, whatever was supplied", () => {
    const markdown = renderWriteUp(assembleWriteUp("A study", FULL));
    const conclusion = markdown.slice(markdown.indexOf("## Conclusion"));
    expect(conclusion).toMatch(/This section is yours to write/);
    expect(conclusion.slice(0, conclusion.indexOf("## References"))).not.toMatch(/we conclude|this study shows|the findings demonstrate/i);
  });
});

describe("the qualitative findings section", () => {
  const ONE = "The cost was the first thing everyone mentioned, and nobody trusted the process.";
  const TWO = "Cost came up again, though the process itself seemed fine to me.";
  const codes: Code[] = [
    { id: "cost", label: "cost", definition: "d", when: "w", notWhen: "n" },
    { id: "trust", label: "trust", definition: "d", when: "w", notWhen: "n" },
  ];
  const codings: Coding[] = [
    { id: "g1", documentId: "d1", codeId: "cost", start: 4, end: 8 },
    { id: "g2", documentId: "d2", codeId: "cost", start: 0, end: 4 },
    { id: "g3", documentId: "d1", codeId: "trust", start: 60, end: 67 },
  ];
  const documents = new Map([["d1", ONE], ["d2", TWO]]);
  const drafts: ThemeDraft[] = [
    { id: "t1", label: "What it costs you", statement: "Money comes first.", codeIds: ["cost"] },
  ];
  const { themes } = assembleThemes(drafts, codes, codings, documents);
  const saturation = readSaturation(codings, ["d1", "d2"]);
  const nameOf = (id: string) => (id === "d1" ? "P1" : "P2");

  it("writes the theme, its reach and its extracts", () => {
    const markdown = findingsSection({ themes, uncovered: [], saturation, nameOf });
    expect(markdown).toMatch(/### What it costs you/);
    expect(markdown).toMatch(/Money comes first\./);
    expect(markdown).toMatch(/2 extracts across 2 documents/);
    expect(markdown).toMatch(/> cost/);
  });

  // An unattributed quotation in a findings chapter is the one an examiner
  // asks about first.
  it("attributes every extract to the transcript it came from", () => {
    const markdown = findingsSection({ themes, uncovered: [], saturation, nameOf });
    expect(markdown).toMatch(/> — P1/);
    expect(markdown).toMatch(/> — P2/);
  });

  it("names the codes no theme gathered", () => {
    const markdown = findingsSection({ themes, uncovered: [codes[1]!], saturation, nameOf });
    expect(markdown).toMatch(/### Codes outside the themes/);
    expect(markdown).toMatch(/trust was applied to the data and is not gathered under any theme/);
  });

  it("carries the saturation account rather than a verdict", () => {
    const markdown = findingsSection({ themes, uncovered: [], saturation, nameOf });
    expect(markdown).toMatch(/### Saturation/);
    expect(markdown).not.toMatch(/saturation was reached/i);
  });

  // The omission is a number on the page rather than a silence.
  it("caps the extracts and says how many were held back", () => {
    const many: Coding[] = Array.from({ length: 7 }, (_, index) => ({
      id: `m${index}`, documentId: "d1", codeId: "cost", start: index, end: index + 4,
    }));
    const assembled = assembleThemes(drafts, codes, many, documents);
    const markdown = findingsSection({
      themes: assembled.themes, uncovered: [], saturation, nameOf, extractsPerTheme: 2,
    });
    expect(markdown).toMatch(/5 further extracts under this theme are not shown/);
  });

  it("says plainly when nothing has been assembled", () => {
    const markdown = findingsSection({ themes: [], uncovered: [], saturation, nameOf });
    expect(markdown).toMatch(/No themes have been assembled yet/);
    expect(markdown).toMatch(/a theme with no extracts behind it is not written here at all/);
  });
});

describe("references in APA form", () => {
  const ref = (over: Partial<Reference> = {}): Reference => ({
    id: "r1",
    source: "openalex",
    title: "Waiting times and trust in public services",
    authors: [{ name: "Jane Q. Smith" }],
    year: 2020,
    venue: "Journal of Public Administration",
    preprint: false,
    retraction: "none",
    openAccess: false,
    verification: "verified",
    availability: "metadata_only",
    ...over,
  });

  it("puts the surname first and initials after it", () => {
    expect(apaAuthor({ name: "Jane Q. Smith" })).toBe("Smith, J. Q.");
    expect(apaAuthor({ name: "Ntombi Dlamini" })).toBe("Dlamini, N.");
  });

  // Providers return both forms, and re-parsing one already in APA order
  // produces "Jane, S." — a surname turned into an initial.
  it("leaves a name already written surname-first alone", () => {
    expect(apaAuthor({ name: "Smith, Jane Q." })).toBe("Smith, Jane Q.");
  });

  // A corporate author, or a name with one part. Forcing initials onto either
  // produces nonsense.
  it("leaves a single-word name exactly as it is", () => {
    expect(apaAuthor({ name: "UNESCO" })).toBe("UNESCO");
  });

  it("uses an ampersand before the last of several authors", () => {
    expect(apaAuthors([{ name: "Jane Smith" }, { name: "Ben Cole" }])).toBe("Smith, J., & Cole, B.");
    expect(apaAuthors([{ name: "A One" }, { name: "B Two" }, { name: "C Three" }]))
      .toBe("One, A., Two, B., & Three, C.");
  });

  it("elides after nineteen, as APA does past twenty authors", () => {
    const many = Array.from({ length: 25 }, (_, index) => ({ name: `First${index} Last${index}` }));
    const line = apaAuthors(many);
    expect(line).toMatch(/\. \. \. Last24, F\.$/);
    expect(line).toContain("Last18, F.");
    expect(line).not.toContain("Last19, F.");
  });

  it("writes an entry with the journal in italics and the DOI as a URL", () => {
    expect(apaReference(ref({ doi: "10.1234/abc" }))).toBe(
      "Smith, J. Q. (2020). Waiting times and trust in public services. *Journal of Public Administration*. https://doi.org/10.1234/abc",
    );
  });

  // Guessing a year would put a wrong date in a bibliography, and a wrong date
  // is worse than an absent one because nobody checks it.
  it("says n.d. rather than inventing a year", () => {
    expect(apaReference(ref({ year: undefined }))).toMatch(/\(n\.d\.\)\./);
  });

  it("does not double the full stop on a title that brought one", () => {
    expect(apaReference(ref({ title: "A study of waiting." }))).toContain("A study of waiting.");
    expect(apaReference(ref({ title: "A study of waiting." }))).not.toContain("waiting..");
  });

  // Lower-casing to sentence case would wreck every proper noun and acronym in
  // the corpus.
  it("keeps the capitalisation the provider gave the title", () => {
    expect(apaReference(ref({ title: "A study of NHS waiting times" }))).toContain("NHS");
  });

  it("sorts the list alphabetically, not in search-result order", () => {
    const list = referenceList([
      ref({ id: "a", authors: [{ name: "Zoe Young" }] }),
      ref({ id: "b", authors: [{ name: "Adam Best" }] }),
    ]);
    expect(list.indexOf("Best")).toBeLessThan(list.indexOf("Young"));
  });

  it("says plainly when there are none", () => {
    expect(referenceList([])).toMatch(/No references have been added yet/);
  });
});
