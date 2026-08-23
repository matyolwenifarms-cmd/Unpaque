import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addToScreening,
  decide,
  dropScreened,
  loadScreening,
  type ScreeningRow,
} from "@/lib/screening-api.ts";
import {
  flowOf,
  problems,
  readFlow,
  type ScreeningState,
} from "@shared/research/prisma/flow.ts";
import { cn } from "@/lib/utils.ts";

/** What a reviewer can do to a record, in the words they would use. */
const MOVES: { state: ScreeningState; label: string; needsReason?: boolean }[] = [
  { state: "duplicate", label: "Duplicate" },
  { state: "excluded_on_title", label: "Exclude on title" },
  { state: "assessed", label: "Read the full text" },
  { state: "excluded_on_full_text", label: "Exclude at full text", needsReason: true },
  { state: "included", label: "Include" },
];

const BOXES: { state: ScreeningState; label: string }[] = [
  { state: "identified", label: "Not yet screened" },
  { state: "duplicate", label: "Duplicates" },
  { state: "excluded_on_title", label: "Excluded on title" },
  { state: "assessed", label: "Read, not yet decided" },
  { state: "excluded_on_full_text", label: "Excluded at full text" },
  { state: "included", label: "Included" },
];

/**
 * Screening, and the PRISMA diagram counted from it.
 *
 * Nothing on this screen is a number anybody types. The reviewer decides about
 * records and the diagram is arithmetic over those decisions, so the state
 * where the picture disagrees with the decisions has nowhere to live — which
 * is the single most common correction sent back on a systematic review.
 *
 * **And there is no diagram until every record has been decided.** PRISMA has
 * no box for a record nobody has looked at, so with thirty titles unscreened
 * the subtractions do not hold and any picture drawn from them is one the
 * reviewer would have to explain. Until then the screen says how many are
 * waiting, which is the useful thing anyway.
 */
export function Screening({ studyId }: { studyId: string | null }) {
  const [rows, setRows] = useState<ScreeningRow[]>([]);
  const [pasted, setPasted] = useState("");
  const [foundVia, setFoundVia] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const refresh = useCallback(async (id: string) => {
    const result = await loadScreening(id);
    if (result.ok) setRows(result.data);
    else setProblem(result.message);
  }, []);

  useEffect(() => {
    if (studyId === null) {
      setRows([]);
      return;
    }
    void refresh(studyId);
  }, [studyId, refresh]);

  const flow = useMemo(() => flowOf(rows), [rows]);
  const notes = useMemo(() => problems(rows), [rows]);
  const counted = useMemo(() => {
    const map = new Map<ScreeningState, number>();
    for (const row of rows) map.set(row.state, (map.get(row.state) ?? 0) + 1);
    return map;
  }, [rows]);

  async function move(row: ScreeningRow, state: ScreeningState) {
    if (studyId === null) return;
    const needsReason = state === "excluded_on_full_text";
    const reason = (reasons[row.id] ?? "").trim();
    if (needsReason && reason.length < 3) {
      setProblem(
        "PRISMA asks for a reason against every full-text exclusion. Say which criterion it failed.",
      );
      return;
    }
    setWorking(true);
    const result = await decide(row.id, state, needsReason ? reason : undefined);
    setWorking(false);
    if (!result.ok) {
      setProblem(result.message);
      return;
    }
    setProblem(null);
    await refresh(studyId);
  }

  if (studyId === null) {
    return (
      <div className="rounded-lg border border-rule bg-raised p-5">
        <p className="text-sm">
          Open a study above to screen records into it. Screening belongs to a study, because a
          PRISMA diagram describes one review.
        </p>
      </div>
    );
  }

  const undecided = rows.filter((row) => row.state === "identified" || row.state === "assessed");

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-rule bg-raised p-4">
        <h3 className="text-sm font-medium">Records to screen</h3>
        <p className="mt-1 text-sm text-muted">
          One title per line. Paste them straight out of whatever you searched; nothing here needs
          them formatted.
        </p>
        <textarea
          value={pasted}
          rows={4}
          aria-label="Titles to screen"
          onChange={(event) => setPasted(event.target.value)}
          className="mt-2 w-full rounded-md border border-rule bg-paper p-2 text-sm"
        />
        <label className="mt-2 block text-sm">
          Where they came from
          <input
            type="text"
            value={foundVia}
            placeholder="Scopus, a reference list, a hand search"
            aria-label="Where they came from"
            onChange={(event) => setFoundVia(event.target.value)}
            className="mt-1 w-full rounded-md border border-rule bg-paper px-2 py-1 text-sm"
          />
        </label>
        {/* PRISMA 2020 reports records from databases separately from records
            found other ways, and without this they cannot be. */}
        <button
          type="button"
          disabled={working || pasted.trim() === ""}
          onClick={async () => {
            setWorking(true);
            const result = await addToScreening(studyId, pasted.split("\n"), foundVia);
            setWorking(false);
            if (!result.ok) {
              setProblem(result.message);
              return;
            }
            setPasted("");
            await refresh(studyId);
          }}
          className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-40"
        >
          Add them
        </button>
      </section>

      {problem !== null && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {problem}
        </p>
      )}

      <section aria-labelledby="diagram" className="rounded-lg border border-rule bg-raised p-4">
        <h3 id="diagram" className="text-sm font-medium">The flow</h3>

        {flow.kind === "in_progress" ? (
          <p className="mt-1 text-sm">{flow.says}</p>
        ) : (
          <ol className="mt-2 space-y-1 text-sm">
            {readFlow(flow.counts).map((line) => (
              <li key={line} className={cn(line.startsWith("  ") && "pl-4 text-muted")}>
                {line.trim()}
              </li>
            ))}
          </ol>
        )}

        {/* Shown either way. The boxes are what a reviewer is working through,
            and they are useful long before the diagram exists. */}
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BOXES.map((box) => (
            <div key={box.state} className="rounded-md border border-rule bg-paper p-2">
              <dt className="text-xs text-muted">{box.label}</dt>
              <dd className="text-lg font-medium">{counted.get(box.state) ?? 0}</dd>
            </div>
          ))}
        </dl>

        {notes.length > 0 && (
          <ul className="mt-3 space-y-1.5 text-sm text-muted">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      </section>

      {undecided.length > 0 && (
        <section aria-labelledby="deciding" className="rounded-lg border border-rule bg-raised p-4">
          <h3 id="deciding" className="text-sm font-medium">
            {undecided.length} waiting on you
          </h3>
          <ul className="mt-3 space-y-2">
            {undecided.map((row) => (
              <li key={row.id} className="rounded-lg border border-rule bg-paper p-3">
                <p className="text-sm">{row.label}</p>
                {row.foundVia !== null && (
                  <p className="mt-0.5 text-xs text-muted">Found via {row.foundVia}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {MOVES.filter((option) =>
                    row.state === "identified"
                      ? option.state !== "excluded_on_full_text" && option.state !== "included"
                      : option.state === "excluded_on_full_text" || option.state === "included")
                    .map((option) => (
                      <button
                        key={option.state}
                        type="button"
                        disabled={working}
                        onClick={() => void move(row, option.state)}
                        className="rounded-md border border-rule px-2.5 py-1 text-xs hover:border-accent disabled:opacity-40"
                      >
                        {option.label}
                      </button>
                    ))}
                </div>
                {row.state === "assessed" && (
                  <input
                    type="text"
                    value={reasons[row.id] ?? ""}
                    placeholder="Reason, if you exclude it"
                    aria-label={`Reason for excluding ${row.label}`}
                    onChange={(event) =>
                      setReasons((was) => ({ ...was, [row.id]: event.target.value }))}
                    className="mt-2 w-full rounded border border-rule bg-raised px-2 py-1 text-xs"
                  />
                )}
                <button
                  type="button"
                  onClick={async () => {
                    await dropScreened(row.id);
                    await refresh(studyId);
                  }}
                  className="mt-2 text-xs text-muted underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
