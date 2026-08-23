import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import {
  planImport,
  summarise,
  type IncomingFile,
  type Plan,
  type PlannedSource,
} from "@shared/detective/ingest/plan.ts";
import { SOURCE_KINDS, type SourceKind } from "@shared/detective/epistemic.ts";
import type { Page } from "@shared/ingest/extract.ts";
import { readPdf } from "@/lib/read-pdf.ts";
import { cn } from "@/lib/utils.ts";

export interface ConfirmedSource {
  name: string;
  kind: SourceKind;
  /**
   * The pages as they were read, kept separate rather than joined.
   *
   * Joining them and splitting again later is how a locator comes to say "page
   * 12" about text that is on page 11: a page boundary is not recoverable from
   * concatenated text, and the whole point of extracting page by page is that
   * it is.
   */
  pages: Page[];
  pageCount: number;
  contentHash: string;
  within?: string;
}

/**
 * Hand over a folder. Get back a list saying what each file appears to be.
 *
 * The portal exists for somebody who does not know what the system can do:
 * a police officer with a case folder, a documentary researcher with a zip
 * somebody emailed them. They choose everything at once and the work of
 * sorting it happens here, in the open, where they can correct it.
 *
 * **Nothing is imported until they say so, and every reading shows its
 * reason.** A docket filed as a witness statement corrupts independent
 * support, contradiction detection and the timeline; the person can tell in
 * two seconds what no pattern can, so the machine argues its case and then
 * gets out of the way.
 */
export function UploadPortal({ onImport }: { onImport: (sources: ConfirmedSource[]) => void }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [chosen, setChosen] = useState<Record<string, SourceKind>>({});
  const [dropped, setDropped] = useState<Set<string>>(new Set());
  const [reading, setReading] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function read(files: FileList | null) {
    if (!files || files.length === 0) return;
    setReading(true);
    const incoming: IncomingFile[] = [];
    for (const file of Array.from(files)) {
      incoming.push({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    }
    const made = await planImport(incoming, readPdf);
    setPlan(made);
    setChosen(Object.fromEntries(made.sources.map((source) => [source.id, source.reading.suggests])));
    // Duplicates start unticked. They are almost always the same document
    // reaching somebody twice, and importing both is how one source comes to
    // look like two.
    setDropped(new Set(made.sources.filter((source) => source.duplicateOf).map((source) => source.id)));
    setReading(false);
  }

  function confirm() {
    if (!plan) return;
    onImport(
      plan.sources
        .filter((source) => !dropped.has(source.id))
        .map((source) => ({
          name: source.name,
          kind: chosen[source.id] ?? source.reading.suggests,
          pages: source.pages,
          pageCount: source.pages.length,
          contentHash: source.contentHash,
          ...(source.within === undefined ? {} : { within: source.within }),
        })),
    );
    setPlan(null);
    setChosen({});
    setDropped(new Set());
  }

  const keeping = plan ? plan.sources.filter((source) => !dropped.has(source.id)).length : 0;

  return (
    <section className="rounded-lg border border-rule bg-raised p-4">
      <h4 className="text-sm font-medium">Upload everything you have</h4>
      <p className="mt-1 text-sm text-muted">
        Dockets, statements, reports, correspondence, photographs of paper, or a zip of the lot.
        Nothing is imported until you have looked at what it found.
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
        <Upload className="mx-auto h-6 w-6 text-muted" aria-hidden="true" />
        <p className="mt-2 text-sm text-muted">Drop files here, or</p>
        <label className="mt-2 inline-block cursor-pointer rounded-lg border border-rule px-4 py-2 text-sm hover:border-accent">
          Choose files
          <input
            ref={input}
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

      {reading && <p className="mt-3 text-sm text-muted">Reading them…</p>}

      {plan !== null && (
        <>
          <p className="mt-4 text-sm">{summarise(plan)}</p>

          {plan.says !== null ? (
            <p className="mt-2 text-sm text-muted">{plan.says}</p>
          ) : (
            <>
              <ul className="mt-3 space-y-2">
                {plan.sources.map((source) => (
                  <Row
                    key={source.id}
                    source={source}
                    kind={chosen[source.id] ?? source.reading.suggests}
                    dropped={dropped.has(source.id)}
                    onKind={(kind) => setChosen((was) => ({ ...was, [source.id]: kind }))}
                    onDropped={(drop) =>
                      setDropped((was) => {
                        const next = new Set(was);
                        if (drop) next.add(source.id);
                        else next.delete(source.id);
                        return next;
                      })
                    }
                  />
                ))}
              </ul>

              <button
                type="button"
                onClick={confirm}
                disabled={keeping === 0}
                className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-40"
              >
                Import {keeping} {keeping === 1 ? "file" : "files"}
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}

function Row({
  source,
  kind,
  dropped,
  onKind,
  onDropped,
}: {
  source: PlannedSource;
  kind: SourceKind;
  dropped: boolean;
  onKind: (kind: SourceKind) => void;
  onDropped: (dropped: boolean) => void;
}) {
  return (
    <li className={cn("rounded border border-rule bg-paper p-3", dropped && "opacity-50")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{source.name}</span>
        <span className="text-xs text-muted">
          {source.within ? `from ${source.within} · ` : ""}
          {source.pages.length > 0
            ? `${source.pages.length} ${source.pages.length === 1 ? "page" : "pages"}`
            : "no text"}
        </span>
      </div>

      {/* The reason, always, next to the suggestion it produced. */}
      <p className="mt-1 text-xs text-muted">
        Looks like <span className="text-ink">{source.reading.suggests.replace(/_/g, " ")}</span>{" "}
        — {source.reading.because}
        {source.reading.strength === "guess" && " This one is a guess."}
      </p>

      {source.says && <p className="mt-1 text-xs text-muted">{source.says}</p>}

      {source.detection.disagreement && (
        /* Never resolved silently: it is either an export quirk or somebody
           hiding something, and both are worth a person seeing. */
        <p className="mt-1 text-xs text-muted">{source.detection.disagreement}</p>
      )}

      {source.duplicateOf && (
        <p className="mt-1 text-xs text-muted">
          The same file as {source.duplicateOf}. Unticked, because importing both is how one source
          comes to look like two.
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={!dropped}
            onChange={(event) => onDropped(!event.target.checked)}
          />
          Import it
        </label>

        <label className="flex items-center gap-2 text-xs text-muted">
          <span className="sr-only">What {source.name} is</span>
          <select
            value={kind}
            aria-label={`What ${source.name} is`}
            onChange={(event) => onKind(event.target.value as SourceKind)}
            className="rounded border border-rule bg-raised px-2 py-1 text-xs outline-none focus:border-accent"
          >
            {SOURCE_KINDS.map((value) => (
              <option key={value} value={value}>
                {value.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
      </div>
    </li>
  );
}
