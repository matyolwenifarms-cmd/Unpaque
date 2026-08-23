// A reference list in APA form, from records a provider actually returned.
//
// Transcription, and the kind students lose marks on: the ampersand before the
// last author, the initials, the italics on the journal and not the article,
// the DOI as a URL. None of it is judgement and all of it is fiddly.
//
// What this will not do is invent the parts a record does not carry. A missing
// year is "(n.d.)", which is what APA says and what an examiner expects to
// see; guessing one from a nearby field would put a wrong date in a
// bibliography, and a wrong date is worse than an absent one because nobody
// checks it.

import type { Author, Reference } from "../reference.ts";

/**
 * A name as APA writes it: surname, then initials.
 *
 * Providers return "Jane Q. Smith", "Smith, Jane", and occasionally a single
 * word. The single word is left exactly as it is — a corporate author, or a
 * name with one part, and forcing initials onto either produces nonsense.
 */
export function apaAuthor(author: Author): string {
  const name = author.name.trim().replace(/\s+/g, " ");
  if (name === "") return "";

  // Already "Surname, A. B." — providers do return this form.
  if (name.includes(",")) return name;

  const parts = name.split(" ");
  if (parts.length === 1) return name;

  const surname = parts[parts.length - 1]!;
  const initials = parts
    .slice(0, -1)
    .map((part) => `${part.charAt(0).toUpperCase()}.`)
    .join(" ");
  return `${surname}, ${initials}`;
}

/**
 * The author string, with APA's rules about how many to name.
 *
 * Up to twenty are listed; from twenty-one, the first nineteen then an ellipsis
 * then the last. That rule looks arbitrary and is exactly the sort of thing
 * somebody hand-formatting a bibliography gets wrong at two in the morning.
 */
export function apaAuthors(authors: readonly Author[]): string {
  const names = authors.map(apaAuthor).filter((name) => name !== "");
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]}, & ${names[1]}`;
  if (names.length <= 20) {
    return `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
  }
  return `${names.slice(0, 19).join(", ")}, . . . ${names[names.length - 1]}`;
}

/** One entry. */
export function apaReference(reference: Reference): string {
  const authors = apaAuthors(reference.authors);
  const year = reference.year === undefined ? "n.d." : String(reference.year);
  // The title keeps the capitalisation the provider gave it. APA sentence-cases
  // article titles, and lower-casing here would wreck every proper noun and
  // every acronym in the corpus — "A study of NHS waiting times" is not
  // improved by becoming "A study of nhs waiting times".
  const title = reference.title.trim().replace(/\.\s*$/, "");
  const parts = [authors === "" ? null : authors, `(${year}).`, `${title}.`]
    .filter((part): part is string => part !== null);

  if (reference.venue?.trim()) parts.push(`*${reference.venue.trim()}*.`);
  if (reference.doi) parts.push(`https://doi.org/${reference.doi}`);

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * The list, alphabetical by the first author's surname.
 *
 * Sorted here rather than left in relevance order, because a reference list is
 * alphabetical and one in search-result order is the clearest possible signal
 * that it was pasted out of a tool.
 */
export function referenceList(references: readonly Reference[]): string {
  if (references.length === 0) return "## References\n\nNo references have been added yet.\n";

  const entries = references
    .map((reference) => ({ key: apaAuthor(reference.authors[0] ?? { name: "" }).toLowerCase(), line: apaReference(reference) }))
    .sort((a, b) => a.key.localeCompare(b.key) || a.line.localeCompare(b.line))
    .map((entry) => entry.line);

  return `## References\n\n${entries.join("\n\n")}\n`;
}
