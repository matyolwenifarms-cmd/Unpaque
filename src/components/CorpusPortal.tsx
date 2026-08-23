import { useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { planImport, type IncomingFile, type Plan } from "@shared/detective/ingest/plan.ts";
import { readPdf } from "@/lib/read-pdf.ts";
import { sourceKindOf, type NewSource } from "@/lib/corpus-api.ts";
import { normaliseDoi } from "@shared/research/reference.ts";
import { cn } from "@/lib/utils.ts";

/**
 * Hand over the papers. The study keeps the text, never the file.
 *
 * The same engine the Detect portal uses — `planImport` reads a folder or a
 * zip, works out what each file is from its bytes, extracts the text page by
 * page and notices the same document arriving twice. What is different here is
 * what happens afterwards: Detect asks the person to classify each file as a
 * kind of evidence, and a paper is not a kind of evidence. It asks for a DOI
 * instead, and only where the reader wants to give one.
 *
 * **Nothing is stored until they press the button, and the original file is
 * never stored at all.** A study is often a library's licensed PDFs.
 */
export function CorpusPortal({
  onImport,
  working,
}: {
  onImport: (sources: NewSource[]) => void;
  working: boolean;
}) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [reading, setReading] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [dropped, setDropped] = useState<Set<string>>(new Set());
  const [dois, setDois] = useState<Record<string, string>>({});
  const [over, setOver] = useState(false);

  async function read(files: FileList | null) {
    if (!files || files.length === 0) return;
    setReading(true);
    setFailed(null);
    try {
      const incoming: IncomingFile[] = [];
      for (const file of Array.from(files)) {
        incoming.push({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
      }
      const made = await planImport(incoming, readPdf);
      setPlan(made);
      // A duplicate starts unticked. Two copies of one paper in a corpus
      // makes every count drawn from it wrong, quietly.
      setDropped(new Set(made.sources.filter((source) => source.duplicateOf).map((s) => s.id)));
      setDois({});
    } catch (error) {
      setFailed(error instanceof Error ? error.message : String(error));
    } finally {
      // In a finally. A spinner that never comes down says less than an error.
      setReading(false);
    }
  }

  function confirm() {
    if (!plan) return;
    onImport(
      plan.sources
        .filter((source) => !dropped.has(source.id))
        .map((source) => {
          const typed = normaliseDoi(dois[source.id] ?? "");
          return {
            name: source.name,
            kind: sourceKindOf(source.detection.kind),
            contentHash: source.contentHash,
            pages: source.pages,
            ...(typed === undefined ? {} : { doi: typed }),
          };
        }),
    );
    setPlan(null);
    setDropped(new Set());
    setDois({});
  }

  const keeping = plan ? plan.sources.filter((source) => !dropped.has(source.id)).length : 0;

  return (
    <section className="rounded-lg border border-rule bg-raised p-4">
      <h3 className="text-sm font-medium">Add the papers you are working from</h3>
      <p className="mt-1 text-sm text-muted">
        PDFs, Word files, or a zip of the lot. The text is read in your browser and kept with the
        study; the files themselves are never uploaded anywhere.
      </p>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          void read(event.dataTransfer.files);
        }}
        className={cn(
          "mt-3 rounded-lg border border-dashed p-6 text-center transition-colors",
          over ? "border-accent bg-accent/5" : "border-rule",
        )}
      >
        <FileUp className="mx-auto h-6 w-6 text-muted" aria-hidden="true" />
        <p className="mt-2 text-sm text-muted">Drop them here, or</p>
        <label className="mt-2 inline-block cursor-pointer rounded-lg border border-rule px-4 py-2 text-sm hover:border-accent">
          Choose files
          <input
            type="file"
            multiple
            className="sr-only"
            onChange={(event) => {
              void read(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      {reading && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          Reading them…
        </p>
      )}
      {failed !== null && (
        <p className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          Nothing could be read from that: {failed}. Nothing was added.
        </p>
      )}

      {plan !== null && plan.says !== null && (
        <p className="mt-3 text-sm text-muted">{plan.says}</p>
      )}

      {plan !== null && plan.says === null && (
        <>
          <ul className="mt-4 space-y-2">
            {plan.sources.map((source) => (
              <li
                key={source.id}
                className={cn(
                  "rounded-lg border border-rule bg-paper p-3",
                  dropped.has(source.id) && "opacity-50",
                )}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={!dropped.has(source.id)}
                    aria-label={`Add ${source.name}`}
                    onChange={(event) =>
                      setDropped((was) => {
                        const next = new Set(was);
                        if (event.target.checked) next.delete(source.id);
                        else next.add(source.id);
                        return next;
                      })}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{source.name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {source.detection.because}{" "}
                      {source.pages.length > 0
                        ? `${source.pages.length} page${source.pages.length === 1 ? "" : "s"} of text.`
                        : ""}
                    </p>
                    {/* Said plainly rather than shown as a failure. Most of a
                        real reading list has a scan in it, and a paper with no
                        text layer is still a paper the study holds — it just
                        cannot be searched or quoted. */}
                    {source.says !== null && (
                      <p className="mt-1 text-xs text-muted">{source.says}</p>
                    )}
                    {source.duplicateOf !== undefined && (
                      <p className="mt-1 text-xs text-muted">
                        The same file as one above. Unticked, because two copies of one paper make
                        every count drawn from this corpus wrong.
                      </p>
                    )}
                    <label className="mt-2 block text-xs text-muted">
                      DOI, if you have it
                      <input
                        type="text"
                        value={dois[source.id] ?? ""}
                        placeholder="10.1234/example"
                        onChange={(event) =>
                          setDois((was) => ({ ...was, [source.id]: event.target.value }))}
                        className="mt-1 w-full rounded border border-rule bg-raised px-2 py-1 text-sm"
                      />
                    </label>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={confirm}
            disabled={keeping === 0 || working}
            className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-40"
          >
            {working ? "Adding…" : `Add ${keeping} ${keeping === 1 ? "paper" : "papers"}`}
          </button>
        </>
      )}
    </section>
  );
}
