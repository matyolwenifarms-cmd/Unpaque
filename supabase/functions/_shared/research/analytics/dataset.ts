// Reading the file a researcher actually has.
//
// Not a general CSV library: a parser for the export that comes out of Qualtrics,
// Google Forms, SPSS and Excel, which is a narrower and messier problem. The
// things it has to survive are all things that have silently corrupted somebody's
// data set before:
//
// - **A byte-order mark.** Excel writes one. Unstripped, the first column is
//   named "\uFEFFParticipantID" — written here as the escape, because a
//   character nobody can see is a character nobody can review — and every
//   lookup for "ParticipantID" misses.
// - **Semicolons.** Excel on a machine with a comma decimal separator writes
//   semicolon-delimited files and still calls them .csv. Detected, not assumed.
// - **Quoted fields containing the delimiter or a newline.** A free-text answer
//   with a comma in it, split naively, shifts every column after it by one for
//   that row only — which looks like bad data rather than a parsing bug.
// - **Two header rows.** Qualtrics writes the question text as a second row.
//   Not guessed at, but the type inference sees it and the column reports as
//   text, which is the visible symptom.
//
// Type inference is deliberately conservative. A column is numeric only if
// *every* non-missing value parses as a number, because one stray "N/A" in a
// thousand rows silently turning a scale into a categorical variable is better
// than a mean computed over 999 values and one zero.

export const COLUMN_KINDS = ["numeric", "categorical", "text", "empty"] as const;
export type ColumnKind = (typeof COLUMN_KINDS)[number];

export interface Column {
  name: string;
  kind: ColumnKind;
  /** Values present, after missing. */
  n: number;
  missing: number;
  /** For categorical: how many distinct values. */
  distinct: number;
  /** For categorical, the levels, up to a cap. Ordered by frequency. */
  levels?: Array<{ value: string; count: number }>;
  /** Raw cells, in row order, missing included as null. */
  values: Array<string | null>;
}

export interface Dataset {
  columns: Column[];
  rows: number;
  /** Anything the reader should know about how this was read. */
  notes: string[];
}

export type ParseOutcome =
  | { ok: true; dataset: Dataset }
  | { ok: false; reason: string };

/** Above this, a column of distinct strings is free text rather than a variable. */
export const MAX_LEVELS = 30;

/** What counts as absent. Deliberately explicit: silence here becomes a zero. */
const MISSING = new Set(["", "na", "n/a", "#n/a", "null", "nil", "none", ".", "-", "--", "missing"]);

export function isMissing(value: string): boolean {
  return MISSING.has(value.trim().toLowerCase());
}

/**
 * Split delimited text into rows of fields.
 *
 * Written out rather than split on the delimiter, because splitting is wrong
 * for any file containing a quoted field — and the free-text answer with a
 * comma in it is in every real survey export.
 */
export function splitDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let index = 0;

  while (index < text.length) {
    const character = text[index]!;

    if (quoted) {
      if (character === '"') {
        // A doubled quote inside a quoted field is one literal quote.
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }
      field += character;
      index += 1;
      continue;
    }

    if (character === '"' && field === "") {
      quoted = true;
      index += 1;
      continue;
    }
    if (character === delimiter) {
      row.push(field);
      field = "";
      index += 1;
      continue;
    }
    if (character === "\r") {
      // CRLF and lone CR both end the row. A file written on Windows and read
      // on a line-feed split leaves a \r on the last field of every row, which
      // makes "yes\r" and "yes" different categories.
      if (text[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      index += 1;
      continue;
    }
    if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      index += 1;
      continue;
    }
    field += character;
    index += 1;
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Which delimiter this file uses.
 *
 * By counting occurrences on the header line rather than assuming a comma:
 * Excel on a machine with a comma decimal separator writes semicolons and
 * still names the file .csv, and read as comma-delimited that file is one
 * column whose name is the whole header.
 */
export function detectDelimiter(firstLine: string): string {
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = 0;
  for (const candidate of candidates) {
    // Counted outside quotes, so a header containing "Age, in years" does not
    // vote for the comma it contains.
    const count = splitDelimited(firstLine, candidate).at(0)?.length ?? 1;
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }
  return best;
}

export function parseDataset(input: string): ParseOutcome {
  // Excel writes a byte-order mark. Left in, the first column is named
  // "\uFEFFid" and never matches anything the researcher types. The escape,
  // not the character: an invisible literal in a regex is unreviewable.
  const text = input.replace(/^\uFEFF/, "");
  if (text.trim() === "") return { ok: false, reason: "The file is empty." };

  const notes: string[] = [];
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);
  if (delimiter !== ",") {
    notes.push(
      `Read as ${delimiter === "\t" ? "tab" : `"${delimiter}"`}-delimited, not comma-delimited.`,
    );
  }

  const grid = splitDelimited(text, delimiter).filter(
    (row) => row.length > 1 || (row[0] ?? "").trim() !== "",
  );
  if (grid.length < 2) return { ok: false, reason: "There is a header but no data underneath it." };

  const header = grid[0]!.map((name, index) => {
    const trimmed = name.trim();
    return trimmed === "" ? `column ${index + 1}` : trimmed;
  });

  // Duplicate names make every subsequent lookup ambiguous, and a survey tool
  // that exports two questions with the same label is not unusual.
  const seen = new Map<string, number>();
  const names = header.map((name) => {
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    return count === 0 ? name : `${name} (${count + 1})`;
  });
  if (names.some((name, index) => name !== header[index])) {
    notes.push("Some columns shared a name; the repeats have been numbered.");
  }

  const body = grid.slice(1);
  const ragged = body.filter((row) => row.length !== names.length).length;
  if (ragged > 0) {
    notes.push(
      `${ragged} row(s) do not have ${names.length} fields. Missing cells are treated as absent; extra fields are ignored.`,
    );
  }

  const columns: Column[] = names.map((name, index) => {
    const values = body.map((row) => {
      const cell = row[index];
      if (cell === undefined) return null;
      return isMissing(cell) ? null : cell.trim();
    });
    return summarise(name, values);
  });

  return { ok: true, dataset: { columns, rows: body.length, notes } };
}

function summarise(name: string, values: Array<string | null>): Column {
  const present = values.filter((value): value is string => value !== null);
  const missing = values.length - present.length;

  if (present.length === 0) {
    return { name, kind: "empty", n: 0, missing, distinct: 0, values };
  }

  // Every non-missing value, or it is not numeric. One stray "N/A" turning a
  // scale into a categorical variable is a visible problem; a mean over 999
  // values and one silent zero is not.
  const allNumeric = present.every((value) => Number.isFinite(toNumber(value)));

  const counts = new Map<string, number>();
  for (const value of present) counts.set(value, (counts.get(value) ?? 0) + 1);
  const distinct = counts.size;

  if (allNumeric) {
    return { name, kind: "numeric", n: present.length, missing, distinct, values };
  }
  if (distinct <= MAX_LEVELS) {
    const levels = [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    return { name, kind: "categorical", n: present.length, missing, distinct, levels, values };
  }
  return { name, kind: "text", n: present.length, missing, distinct, values };
}

/**
 * A number from a cell, tolerating what spreadsheets put in one.
 *
 * Thousands separators and a trailing percent sign both appear in real
 * exports. A comma decimal separator is deliberately **not** handled: "1,5"
 * could be one-and-a-half or one thousand five hundred and there is no way to
 * tell from the cell, so it stays non-numeric and the column reports as
 * categorical — visible, rather than wrong by a factor of a thousand.
 */
export function toNumber(value: string): number {
  const trimmed = value.trim().replace(/\s/g, "");
  if (trimmed === "") return Number.NaN;
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(trimmed)) return Number(trimmed.replace(/,/g, ""));
  if (/%$/.test(trimmed)) {
    const number = Number(trimmed.slice(0, -1));
    return Number.isFinite(number) ? number / 100 : Number.NaN;
  }
  return Number(trimmed);
}

/** A numeric column's values, ready for the procedures. */
export function numericValues(column: Column): number[] {
  return column.values
    .map((value) => (value === null ? Number.NaN : toNumber(value)))
    .filter((value) => Number.isFinite(value));
}

/**
 * Split one numeric column by the levels of a categorical one.
 *
 * Row-wise, so a row missing either half drops out of both — which is the
 * behaviour a between-groups test needs and the one that is wrong if the two
 * columns are filtered separately.
 */
export function groupBy(outcome: Column, factor: Column): Array<{ level: string; values: number[] }> {
  const groups = new Map<string, number[]>();
  for (let row = 0; row < outcome.values.length; row += 1) {
    const level = factor.values[row];
    const raw = outcome.values[row];
    // `raw === undefined` as well as null: a ragged row is shorter than the
    // header, so an index past its end reads undefined rather than null.
    if (level === null || level === undefined || raw === null || raw === undefined) continue;
    const value = toNumber(raw);
    if (!Number.isFinite(value)) continue;
    const bucket = groups.get(level);
    if (bucket) bucket.push(value);
    else groups.set(level, [value]);
  }
  return [...groups.entries()]
    .map(([level, values]) => ({ level, values }))
    .sort((a, b) => a.level.localeCompare(b.level));
}
