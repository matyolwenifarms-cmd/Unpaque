// Reading a proposal's citations, and finding what a supervisor finds first.
//
// A student hands over a proposal and wants to know whether the references are
// all right. Most of what a supervisor checks on a first pass is not judgement
// at all — it is arithmetic that nobody does because doing it by hand across
// forty references is an evening's work:
//
//   * something cited in the text and missing from the list
//   * something in the list that the text never cites
//   * a DOI that does not resolve
//
// All three are decidable, and the first two need nothing but the document. So
// they are done here, exactly, and the parts that need a model — is this
// reference the right one, is this passage well argued — are not attempted.
//
// **What this cannot do is match a citation to a listed reference with
// certainty.** "Smith, 2020" in the text and "Smith, J. Q. (2020)" in the list
// are the same work; "Smith, 2020" and "Smith, R. (2020)" may be two different
// people. Every match here is by surname and year, and where that is ambiguous
// it is reported as ambiguous rather than resolved — because telling a
// student a reference is missing when it is present, under a name they spelled
// differently, wastes an afternoon and teaches them to distrust the tool.
//
// It also reads a little more than it should. `South Africa (2020)` and `the
// Companies Act (2008)` have the shape of a narrative citation and are counted
// as one. The sentence the student reads says so, because a finding that looks
// wrong and is not explained is worse than no finding at all.

/** A DOI, as it appears in the wild. */
const DOI = /\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/g;

/**
 * A year a document could plausibly cite.
 *
 * Bounded rather than `\d{4}` so that `Section 1234 (1234)` and a bracketed
 * figure number are not read as citations. The bound costs nothing: a
 * proposal citing a 14th-century manuscript cites a modern edition of it.
 */
const YEAR = String.raw`1[5-9]\d{2}|20\d{2}`;

/**
 * A surname, including the particles real ones have.
 *
 * The particle list is closed and spelled both ways rather than matched
 * case-insensitively, because the obvious `[\p{L}]+\s+` prefix swallows
 * whatever precedes the name: in "as shown by Smith (2020)" it captures
 * "shown by Smith", and the author then matches nothing in the reference
 * list. Van der Merwe and De la Rey are worth two lines of constant.
 */
const PARTICLE =
  String.raw`[Vv]an|[Vv]on|[Dd]er|[Dd]en|[Dd]e|[Dd]el|[Dd]u|[Dd]a|[Dd]i|[Dd]os|[Ll]a|[Ll]e|[Ee]l|[Aa]l|[Bb]in|[Ii]bn|[Tt]er|[Tt]e`;
const SURNAME = String.raw`(?:(?:PARTICLE)\s+){0,2}[A-Z][\p{L}'’-]+`.replace(
  "PARTICLE",
  PARTICLE,
);

/**
 * One author, or the two-name and et al. forms a citation is written in.
 *
 * `et al.` is its own branch rather than another connector, because nothing
 * follows it: `(Smith et al., 2020)` has a comma where a second surname would
 * be, so a pattern requiring a name after the connector matches none of the
 * three-or-more-author citations in a proposal at all.
 */
const AUTHOR = String.raw`SURNAME(?:\s+et al\.?|\s+(?:and|&)\s+SURNAME)?`.replaceAll(
  "SURNAME",
  SURNAME,
);

/** (Smith, 2020), (Smith & Cole, 2020), (Smith et al., 2020), Smith (2020). */
const IN_TEXT = new RegExp(
  String.raw`\(\s*(AUTHOR)\s*,?\s*(YEAR)[a-z]?\s*\)|(AUTHOR)\s*\(\s*(YEAR)[a-z]?\s*\)`
    .replaceAll("AUTHOR", AUTHOR)
    .replaceAll("YEAR", YEAR),
  "gu",
);

/** Below this many citations, how often each is used says nothing. */
const MIN_FOR_ONCE_ONLY = 10;

/** Where a reference list starts. A section number in front of it is normal. */
const LIST_HEADING =
  /^\s*(?:\d+\.?\s*)?(?:list of references|reference list|references|bibliography|works cited)\s*:?\s*$/i;

/** `[1]`, `(1)` or `1.` in front of an entry, in the numbered styles. */
const ENUMERATOR = String.raw`(?:\[\d+\]|\(\d+\)|\d+\.)?\s*`;

/**
 * Where a new reference-list entry begins.
 *
 * A surname, a comma, and then something that can only be an author: an
 * initial (`Smith, J.`), a given name before the year (`Smith, John (2020)`),
 * or a second author (`Smith, John, & Cole, R.`).
 *
 * Requiring what comes *after* the comma is the whole point. A rule that
 * looked only for a capitalised word and a comma starts a new reference at
 * `Cambridge, MA: MIT Press.` — which is the second line of the reference
 * above it — and so reports one reference as two, the first of them
 * truncated before its year.
 */
const ENTRY_START = new RegExp(
  String.raw`^ENUMERATORSURNAME,\s*(?:[A-Z]\.|SURNAME\s*[,(]|SURNAME\s+&)`
    .replace("ENUMERATOR", ENUMERATOR)
    .replaceAll("SURNAME", SURNAME),
  "u",
);

const ENTRY_SURNAME = new RegExp(
  String.raw`^ENUMERATOR(SURNAME)\s*,`
    .replace("ENUMERATOR", ENUMERATOR)
    .replace("SURNAME", SURNAME),
  "u",
);

export interface InTextCitation {
  /** The surname as written, which is how it will be matched. */
  author: string;
  year: number;
  /** How many times it appears. A work cited once may be a work skimmed. */
  count: number;
}

export interface ListedReference {
  /** The entry as written, so it can be shown back verbatim. */
  raw: string;
  /** First author's surname, where one could be read. */
  surname: string | null;
  year: number | null;
  doi: string | null;
}

export interface ProposalReading {
  inText: InTextCitation[];
  listed: ListedReference[];
  /**
   * Cited in the text and absent from the list. The classic slip, and the one
   * an examiner notices.
   */
  citedNotListed: InTextCitation[];
  /** Listed and never cited. Usually a reference kept from an earlier draft. */
  listedNotCited: ListedReference[];
  /** Every DOI found anywhere, for checking against the providers. */
  dois: string[];
  /** Whether a reference list was found at all. */
  foundList: boolean;
}

function normaliseSurname(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+(?:et al\.?|and|&)(?:\s.*)?$/u, "")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Where the reference list begins, or the end of the document.
 *
 * The heading is searched for from the end backwards, because a proposal
 * often mentions the word "references" in its methodology — "references to
 * the original transcript were checked" — and splitting there would treat
 * half the document as a bibliography.
 */
export function splitAtList(text: string): { body: string; list: string; foundList: boolean } {
  const lines = text.split("\n");
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (LIST_HEADING.test(lines[index]!)) {
      return {
        body: lines.slice(0, index).join("\n"),
        list: lines.slice(index + 1).join("\n"),
        foundList: true,
      };
    }
  }
  return { body: text, list: "", foundList: false };
}

/**
 * One reference-list entry per run of lines.
 *
 * A bibliography arrives from a PDF as a flat run of lines: some entries fit
 * on one line, some wrap onto two or three under a hanging indent, and the
 * indent itself is usually lost in extraction. So an entry is found by where
 * the next one *starts*, not by blank lines — a list that mixes wrapped and
 * unwrapped entries, which is every real list, has no blank lines to split on,
 * and splitting on every newline turns each wrapped entry into a reference
 * plus a fragment.
 *
 * Where no line looks like the start of an entry at all — a list of
 * corporate authors, `World Health Organization. (2021).` — only blank
 * lines split, which is the right answer for the well-formatted case and no
 * worse than guessing for the rest.
 */
function entriesIn(list: string): string[] {
  const lines = list.split("\n").map((line) => line.trim());
  const anyStart = lines.some((line) => ENTRY_START.test(line));

  const entries: string[] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length > 0) entries.push(current.join(" "));
    current = [];
  };

  for (const line of lines) {
    if (line === "") {
      flush();
      continue;
    }
    if (anyStart && ENTRY_START.test(line)) flush();
    current.push(line);
  }
  flush();

  // Shorter than this is a page number, a running head, or the tail of a
  // heading — never a reference.
  return entries.filter((entry) => entry.length > 12);
}

function readEntry(raw: string): ListedReference {
  const surname = ENTRY_SURNAME.exec(raw)?.[1] ?? null;
  const year =
    /\((\d{4})[a-z]?\)/.exec(raw)?.[1] ?? new RegExp(String.raw`\b(YEAR)\b`.replace("YEAR", YEAR)).exec(raw)?.[1] ?? null;
  const doi = new RegExp(DOI.source).exec(raw)?.[0] ?? null;
  return {
    raw: raw.trim(),
    surname,
    year: year === null ? null : Number.parseInt(year, 10),
    // A trailing full stop is part of the sentence, not of the identifier, and
    // a DOI ending in one resolves to nothing.
    doi: doi === null ? null : doi.replace(/[.,;)]+$/, "").toLowerCase(),
  };
}

/**
 * The prose of a proposal with its citations taken out.
 *
 * For the literature search, and it changes what comes back completely. The
 * terms drawn from a whole proposal are half bibliography: `Smith`, `Ndlovu`,
 * `Cole`, `Cambridge`, `Journal`. Searching for those returns work by people
 * the student already cites, which is the one thing a suggestion list must
 * not be made of. The reference list goes first, then the citations inside
 * the prose — including the narrative form, where the surname is part of
 * the sentence and survives deleting the bracketed year on its own.
 */
export function proseOf(text: string): string {
  return splitAtList(text).body.replace(IN_TEXT, " ").replace(/\s+/g, " ").trim();
}

/** What a proposal cites, what it lists, and where the two disagree. */
export function readProposal(text: string): ProposalReading {
  const { body, list, foundList } = splitAtList(text);

  const counts = new Map<string, InTextCitation>();
  for (const match of body.matchAll(IN_TEXT)) {
    const author = match[1] ?? match[3];
    const year = match[2] ?? match[4];
    if (!author || !year) continue;
    const key = normaliseSurname(author) + " " + year;
    const held = counts.get(key);
    if (held) held.count += 1;
    else counts.set(key, { author: author.replace(/\s+/g, " ").trim(), year: Number.parseInt(year, 10), count: 1 });
  }

  const inText = [...counts.values()].sort((a, b) => b.count - a.count || a.author.localeCompare(b.author));
  const listed = entriesIn(list).map(readEntry);

  const listedKeys = new Set(
    listed
      .filter((entry) => entry.surname !== null && entry.year !== null)
      .map((entry) => normaliseSurname(entry.surname!) + " " + entry.year),
  );

  const citedNotListed = inText.filter(
    (citation) => !listedKeys.has(normaliseSurname(citation.author) + " " + citation.year),
  );

  const citedKeys = new Set(
    inText.map((citation) => normaliseSurname(citation.author) + " " + citation.year),
  );
  const listedNotCited = listed.filter(
    (entry) =>
      entry.surname !== null &&
      entry.year !== null &&
      !citedKeys.has(normaliseSurname(entry.surname) + " " + entry.year),
  );

  const dois = [
    ...new Set(
      [...text.matchAll(DOI)].map((match) => match[0].replace(/[.,;)]+$/, "").toLowerCase()),
    ),
  ];

  return { inText, listed, citedNotListed, listedNotCited, dois, foundList };
}

/**
 * What to say about a reading, in the order a supervisor would say it.
 *
 * The absent reference list comes first and stops everything else, because
 * without one "cited but not listed" is every citation in the document, and
 * telling a student that forty references are missing when the problem is that
 * nothing found the list is worse than saying nothing.
 */
export function readingNotes(reading: ProposalReading): string[] {
  if (!reading.foundList) {
    return [
      "No reference list was found, so nothing could be checked against one. A heading reading References or Bibliography on its own line is what this looks for.",
    ];
  }

  // The same trap one step further in: the heading was found, and nothing
  // under it parsed. Every citation would then read as missing.
  if (reading.listed.length === 0) {
    return [
      "A reference list heading was found, but no entries could be read under it. Nothing was checked against the list, because with no entries every citation in the text would be reported as missing.",
    ];
  }

  const notes: string[] = [];

  if (reading.citedNotListed.length > 0) {
    const named = reading.citedNotListed
      .slice(0, 5)
      .map((citation) => citation.author + " (" + String(citation.year) + ")")
      .join(", ");
    const andOthers = reading.citedNotListed.length > 5 ? ", and others" : "";
    notes.push(
      `${reading.citedNotListed.length} ${reading.citedNotListed.length === 1 ? "work is" : "works are"} cited in the text and not in the reference list: ${named}${andOthers}. Matching is by surname and year, so a name spelled differently in the two places shows up here as well as a genuine omission — and so does a capitalised phrase in front of a bracketed year, like an Act or a place name.`,
    );
  }

  if (reading.listedNotCited.length > 0) {
    // Named, like the other side of the arithmetic. A count on its own sends
    // the student back through forty entries to work out which one it meant.
    const named = reading.listedNotCited
      .slice(0, 5)
      .map((entry) => `${entry.surname} (${String(entry.year)})`)
      .join(", ");
    const andOthers = reading.listedNotCited.length > 5 ? ", and others" : "";
    notes.push(
      `${reading.listedNotCited.length} ${reading.listedNotCited.length === 1 ? "reference is" : "references are"} listed and never cited: ${named}${andOthers}. That is usually a reference kept from an earlier draft.`,
    );
  }

  if (reading.dois.length === 0) {
    notes.push(
      `None of the ${reading.listed.length} ${reading.listed.length === 1 ? "reference carries" : "references carry"} a DOI, so none of them can be checked automatically. That is common in older references and is not itself a problem.`,
    );
  }

  // Only worth saying over a list long enough for the pattern to mean
  // something. On six citations "5 of 6 appear once" is arithmetic about a
  // short introduction, and a report that reports nothing is a report that
  // gets skimmed.
  const onceOnly = reading.inText.filter((citation) => citation.count === 1).length;
  if (reading.inText.length >= MIN_FOR_ONCE_ONLY && onceOnly >= reading.inText.length / 2) {
    notes.push(
      onceOnly === reading.inText.length
        ? `Every one of the ${onceOnly} works cited is cited once. A work cited once may have been read; it may also have been found in somebody else's reference list.`
        : `${onceOnly} of the ${reading.inText.length} works cited appear once. A work cited once may have been read; it may also have been found in somebody else's reference list.`,
    );
  }

  return notes;
}
