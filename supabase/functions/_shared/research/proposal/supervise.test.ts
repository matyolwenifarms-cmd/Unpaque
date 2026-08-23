import { describe, expect, it, vi } from "vitest";
import type { ResolveOutcome } from "../providers/crossref.ts";
import type { Reference } from "../reference.ts";
import type { LiteratureResult } from "../search.ts";
import { superviseNotes, superviseProposal } from "./supervise.ts";

const PROPOSAL = `Chapter Three: Methodology

This study adopts an interpretivist paradigm. Twelve participants will be
recruited through purposive sampling, and the framing of protest in community
radio broadcasting will be analysed.

References

Ndlovu, T. (2019). Framing the student movement. Journal of African Media, 12(3), 45-67. https://doi.org/10.1234/jam.2019.45
Smith, J. Q. (2020). Protest and the press. Media Studies, 8(1), 1-20. https://doi.org/10.5678/ms.2020.1
`;

const ref = (over: Partial<Reference> = {}): Reference => ({
  id: "r1",
  source: "openalex",
  title: "A paper about something",
  authors: [{ name: "Jane Mokoena" }],
  year: 2023,
  preprint: false,
  retraction: "none",
  openAccess: false,
  verification: "provider_only",
  availability: "metadata_only",
  ...over,
});

const found = (over: Partial<Reference> = {}): ResolveOutcome => ({
  state: "found",
  retracted: false,
  record: ref(over),
});

const results = (references: Reference[]): LiteratureResult => ({
  references: references.map((reference) => ({ ...reference, sources: [reference.source] })),
  reportedTotal: references.length,
  notes: [],
});

describe("checking the identifiers", () => {
  it("resolves what resolves", async () => {
    const supervision = await superviseProposal(PROPOSAL, { resolve: async () => found() });
    expect(supervision.checks).toHaveLength(2);
    expect(supervision.checks.every((check) => check.kind === "resolved")).toBe(true);
  });

  it("reports what the agency says does not exist", async () => {
    const supervision = await superviseProposal(PROPOSAL, {
      resolve: async (doi) => (doi.startsWith("10.1234") ? { state: "not_found" } : found()),
    });
    expect(supervision.checks.filter((check) => check.kind === "absent")).toHaveLength(1);
    expect(superviseNotes(supervision).join(" ")).toContain("did not resolve");
  });

  // The reason DoiCheck has four states. An unreachable agency must never
  // become a sentence telling a student their reference does not exist.
  it("never turns an unreachable agency into an accusation", async () => {
    const supervision = await superviseProposal(PROPOSAL, {
      resolve: async () => ({ state: "unreachable" }),
    });
    expect(supervision.checks.every((check) => check.kind === "unchecked")).toBe(true);
    const notes = superviseNotes(supervision).join(" ");
    expect(notes).not.toContain("did not resolve");
    expect(notes).toContain("Nothing follows from that about whether they exist");
  });

  it("treats a resolver that throws the same way", async () => {
    const supervision = await superviseProposal(PROPOSAL, {
      resolve: async () => {
        throw new Error("socket hang up");
      },
    });
    expect(supervision.checks.every((check) => check.kind === "unchecked")).toBe(true);
    expect(superviseNotes(supervision).join(" ")).not.toContain("did not resolve");
  });

  it("names a retracted reference, and says it can still be cited", async () => {
    const supervision = await superviseProposal(PROPOSAL, {
      resolve: async (doi) =>
        doi.startsWith("10.1234")
          ? { state: "found", retracted: true, record: ref() }
          : found(),
    });
    const notes = superviseNotes(supervision).join(" ");
    expect(notes).toContain("registered as retracted");
    expect(notes).toContain("10.1234/jam.2019.45");
    expect(notes).toContain("cited as retracted");
  });

  it("says how many of how many it checked, rather than implying all of them", async () => {
    const supervision = await superviseProposal(PROPOSAL, {
      resolve: async () => found(),
      maxChecks: 1,
    });
    expect(supervision.checks).toHaveLength(1);
    expect(supervision.doiTotal).toBe(2);
    expect(superviseNotes(supervision).join(" ")).toContain(
      "The first of the 2 DOIs in the proposal was checked",
    );
  });

  it("checks nothing, and claims nothing, without a resolver", async () => {
    const supervision = await superviseProposal(PROPOSAL);
    expect(supervision.checks).toEqual([]);
    expect(superviseNotes(supervision).join(" ")).not.toContain("resolved at the registration agency");
  });
});

describe("suggesting work the proposal does not cite", () => {
  it("leaves out what is already cited, by identifier", async () => {
    const supervision = await superviseProposal(PROPOSAL, {
      search: async () =>
        results([
          ref({ id: "a", doi: "10.1234/jam.2019.45", title: "Framing the student movement" }),
          ref({ id: "b", doi: "10.9999/new", title: "Something else entirely" }),
        ]),
    });
    expect(supervision.related.kind).toBe("searched");
    const titles = supervision.related.kind === "searched"
      ? supervision.related.suggestions.map((suggestion) => suggestion.reference.title)
      : [];
    expect(titles).toEqual(["Something else entirely"]);
  });

  it("leaves out what is already listed, by surname and year", async () => {
    const supervision = await superviseProposal(PROPOSAL, {
      search: async () =>
        results([
          // No DOI in common; the same work under a different identifier.
          ref({ id: "a", title: "Framing the student movement", authors: [{ name: "T. Ndlovu" }], year: 2019 }),
          ref({ id: "b", title: "Something else entirely", authors: [{ name: "A. Other" }], year: 2022 }),
        ]),
    });
    const titles = supervision.related.kind === "searched"
      ? supervision.related.suggestions.map((suggestion) => suggestion.reference.title)
      : [];
    expect(titles).toEqual(["Something else entirely"]);
  });

  it("stops at the limit", async () => {
    const many = Array.from({ length: 20 }, (_, index) =>
      ref({ id: `r${index}`, title: `Paper ${index}`, authors: [{ name: `Author${index} Surname${index}` }] }));
    const supervision = await superviseProposal(PROPOSAL, {
      search: async () => results(many),
      maxSuggestions: 3,
    });
    expect(supervision.related.kind === "searched" && supervision.related.suggestions).toHaveLength(3);
  });

  // The refusal in the header, asserted rather than described.
  it("never calls a suggestion better or more relevant than what is cited", async () => {
    const supervision = await superviseProposal(PROPOSAL, {
      search: async () => results([ref({ id: "a", citedByCount: 40 })]),
    });
    const said = supervision.related.kind === "searched"
      ? supervision.related.suggestions.map((suggestion) => suggestion.because).join(" ")
      : "";
    expect(said + superviseNotes(supervision).join(" ")).not.toMatch(/\bbetter\b|\bmore relevant\b|\bbest\b/i);
    expect(superviseNotes(supervision).join(" ")).toContain("not a judgement about whether any of them belongs");
  });

  it("says what it actually searched for, which is not what the student wrote", async () => {
    const search = vi.fn(async () => results([ref({ id: "a" })]));
    const supervision = await superviseProposal(PROPOSAL, { search });
    expect(search).toHaveBeenCalledOnce();
    const terms = supervision.related.kind === "searched" ? supervision.related.searchedFor : [];
    expect(terms).toContain("framing");
    expect(terms).not.toContain("study");
  });

  it("degrades when the search throws, rather than losing the rest of the report", async () => {
    const supervision = await superviseProposal(PROPOSAL, {
      search: async () => {
        throw new Error("upstream 503");
      },
    });
    expect(supervision.related.kind).toBe("not_searched");
    expect(supervision.citations.listed).toHaveLength(2);
    expect(superviseNotes(supervision).length).toBeGreaterThan(0);
  });

  it("says so when the list already has everything the search found", async () => {
    const supervision = await superviseProposal(PROPOSAL, {
      search: async () => results([ref({ id: "a", doi: "10.1234/jam.2019.45" })]),
    });
    expect(superviseNotes(supervision).join(" ")).toContain("does not read");
  });
});

describe("the coherence check", () => {
  it("runs on a declared design, and an empty result means it ran", async () => {
    const supervision = await superviseProposal(PROPOSAL);
    expect(supervision.coherence.kind).toBe("checked");
    expect(superviseNotes(supervision).join(" ")).toContain("pulls against");
  });

  it("says why it did not run, rather than reporting no tensions", async () => {
    const supervision = await superviseProposal("Some prose with no paradigm in it at all.\n");
    expect(supervision.coherence.kind).toBe("not_checked");
    const notes = superviseNotes(supervision).join(" ");
    expect(notes).toContain("The coherence check did not run");
    expect(notes).toContain("does not say which paradigm");
  });

  it("finds the tension in a design that pulls apart", async () => {
    const supervision = await superviseProposal(
      "Methodology\n\nThis study adopts an interpretivist paradigm. A stratified random sample of n = 400 was drawn.\n",
    );
    expect(supervision.coherence.kind === "checked" && supervision.coherence.tensions.length)
      .toBeGreaterThan(0);
  });
});

describe("the order the report is given in", () => {
  it("puts the design before the reference arithmetic", async () => {
    const notes = superviseNotes(await superviseProposal(PROPOSAL));
    const design = notes.findIndex((note) => note.includes("interpretivism"));
    const references = notes.findIndex((note) => note.includes("listed and never cited"));
    expect(design).toBeGreaterThanOrEqual(0);
    expect(references).toBeGreaterThan(design);
  });

  it("produces a report at all with no dependencies of any kind", async () => {
    const supervision = await superviseProposal(PROPOSAL);
    expect(supervision.related.kind).toBe("not_searched");
    expect(supervision.checks).toEqual([]);
    expect(superviseNotes(supervision).length).toBeGreaterThan(2);
  });
});
