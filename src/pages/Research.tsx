import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { AnalyseData } from "@/components/AnalyseData.tsx";
import { ChooseMethod } from "@/components/ChooseMethod.tsx";
import { DataUpload } from "@/components/DataUpload.tsx";
import { DatasetSummary } from "@/components/DatasetSummary.tsx";
import { ReferenceList } from "@/components/ReferenceList.tsx";
import { cn } from "@/lib/utils.ts";
import type { Dataset } from "@shared/research/analytics/dataset.ts";
import { searchReferences, type ResultOrder, type SearchedReference } from "@/lib/research-api.ts";

/**
 * The two stages that exist.
 *
 * Named for what the researcher is doing, not for what the software is doing.
 * The specification's lifecycle has four — proposal, collection, analysis,
 * write-up — and two of them are not built; putting all four here with two
 * inert would be a menu that lies about the product.
 */
const STAGES = [
  { id: "literature", name: "Literature", blurb: "Find and verify references" },
  { id: "method", name: "Method", blurb: "Declare the paradigm and approach" },
  { id: "analyse", name: "Analyse data", blurb: "Upload a file and run a test" },
] as const;
type Stage = (typeof STAGES)[number]["id"];

function ResearchHeader({ stage, onStage }: { stage: Stage; onStage: (stage: Stage) => void }) {
  return (
    <header className="mb-8">
      <h1 className="text-2xl font-bold tracking-tight">Research</h1>
      <nav aria-label="Stage" className="mt-3 flex flex-wrap gap-2">
        {STAGES.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={stage === option.id}
            onClick={() => onStage(option.id)}
            className={cn(
              "rounded-lg border px-4 py-2 text-left transition-colors",
              stage === option.id
                ? "border-accent bg-accent/10"
                : "border-rule bg-raised hover:border-muted",
            )}
          >
            <span className="block text-sm font-medium">{option.name}</span>
            <span className="block text-xs text-muted">{option.blurb}</span>
          </button>
        ))}
      </nav>
    </header>
  );
}

/**
 * What to do next, in the researcher's own words.
 *
 * The box is for instructions — "write this up as a results section", "compare
 * these against the second cohort" — and it is not connected to anything that
 * can carry them out. It is here rather than absent because a researcher
 * finishing an analysis has a next instruction in mind and needs somewhere to
 * put it; it says plainly that nothing acts on it yet, because a box that
 * silently swallows an instruction is worse than no box.
 *
 * Report writing needs a model. When one is configured this becomes the way in;
 * until then the honest state is this one. **Do not soften this copy while the
 * button still does nothing.**
 */
function Instructions({ hasData }: { hasData: boolean }) {
  const [text, setText] = useState("");
  return (
    <section aria-labelledby="instructions" className="rounded-lg border border-rule bg-raised p-5">
      <h3 id="instructions" className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">
        What next
      </h3>
      <p className="mb-3 text-sm text-muted">
        {hasData
          ? "Anything else you want done with this — writing it up, another comparison, a different framing."
          : "Load a file first, then say what you want done with it."}
      </p>
      <textarea
        aria-label="Further instructions"
        rows={3}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Write this up as a results section in APA style…"
        className="w-full resize-y rounded-lg border border-rule bg-paper px-3 py-2 outline-none focus:border-accent"
      />
      <p className="mt-2 text-sm leading-relaxed text-accent">
        Nothing acts on this yet, and what you type here is not sent anywhere. The results section
        above is already written from your analyses and needs no model — what is missing is the
        discussion, and that needs one.
      </p>
    </section>
  );
}

export default function Research() {
  const [query, setQuery] = useState("");
  const [fromYear, setFromYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [references, setReferences] = useState<SearchedReference[] | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<ResultOrder>("relevance");
  // What the list on screen was actually ordered by, which is not `order` once
  // somebody has changed the control without searching again. Labelling a list
  // "most relevant first" while it is still sorted by date is the same lie as
  // before, told by a control instead of a sort.
  const [shownOrder, setShownOrder] = useState<ResultOrder>("relevance");
  const [stage, setStage] = useState<Stage>("literature");
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || query.trim().length < 3) return;
    setBusy(true);
    setError(null);
    setReferences(null);
    setNotes([]);

    const year = /^\d{4}$/.test(fromYear) ? Number(fromYear) : undefined;
    const result = await searchReferences(query.trim(), year, order);
    if (result.status === "ok") {
      setReferences(result.references);
      setNotes(result.notes);
      setTotal(result.reportedTotal);
      setShownOrder(order);
    } else {
      setError(result.message);
    }
    setBusy(false);
  }

  if (stage === "method") {
    return (
      <div>
        <ResearchHeader stage={stage} onStage={setStage} />
        <ChooseMethod />
      </div>
    );
  }

  if (stage === "analyse") {
    return (
      <div>
        <ResearchHeader stage={stage} onStage={setStage} />
        <div className="space-y-4">
          <DataUpload
            fileName={fileName}
            onLoaded={(loaded, name) => {
              setDataset(loaded);
              setFileName(name);
            }}
          />
          {dataset && <DatasetSummary dataset={dataset} />}
          {dataset && <AnalyseData dataset={dataset} />}
          <Instructions hasData={dataset !== null} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <ResearchHeader stage={stage} onStage={setStage} />
      {/* The heading lives in ResearchHeader, once. The old one was left here
          with sr-only, which still renders the element — so the page had two
          h1s reading "Research", and an outline with two top-level headings is
          one nobody can navigate. The browser smoke check found it. */}
      <p className="mb-6 text-sm text-muted">
        Every reference comes from a bibliographic provider and its identifier is re-checked before
        it is shown to you.
      </p>

      <form onSubmit={onSubmit} className="mb-6">
        <label htmlFor="query" className="sr-only">
          What are you looking for?
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          {/* A textarea, not an input. The feature asks for a proposal or an
              abstract and a one-line box says it wants a phrase — and a long
              paste into a box that shows six words of it looks like it was
              truncated. Long input is reduced to its search terms server-side
              and the notes above the results say which. */}
          <textarea
            id="query"
            rows={3}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="A question, or paste an abstract or proposal"
            className="flex-1 resize-y rounded-lg border border-rule bg-raised px-4 py-3 outline-none focus:border-accent"
          />
          <label htmlFor="fromYear" className="sr-only">
            Published from year
          </label>
          <input
            id="fromYear"
            value={fromYear}
            onChange={(event) => setFromYear(event.target.value)}
            placeholder="from year"
            inputMode="numeric"
            className="w-full rounded-lg border border-rule bg-raised px-4 py-3 outline-none focus:border-accent sm:w-32"
          />
          <button
            type="submit"
            disabled={busy || query.trim().length < 3}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 font-medium text-accent-ink disabled:opacity-40"
          >
            {busy ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            ) : (
              <Search aria-hidden className="h-4 w-4" />
            )}
            {busy ? "Searching" : "Search"}
          </button>
        </div>

        {/* Relevance is the default and stays the default. Ordering the whole
            result set by date does not sort the literature, it replaces it:
            what surfaces is whatever carries the newest date, related to the
            question or not. It is offered because a researcher does sometimes
            want it — over a set relevance has already chosen. */}
        <fieldset className="mt-3 flex flex-wrap items-center gap-2">
          <legend className="sr-only">Order the results</legend>
          <span className="text-sm text-muted">Order by</span>
          {([["relevance", "Most relevant"], ["recency", "Newest first"]] as const).map(
            ([value, label]) => (
              <label
                key={value}
                className={cn(
                  "cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  order === value
                    ? "border-accent bg-accent/10 font-medium"
                    : "border-rule bg-raised hover:border-muted",
                )}
              >
                <input
                  type="radio"
                  name="order"
                  value={value}
                  checked={order === value}
                  onChange={() => setOrder(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ),
          )}
        </fieldset>
      </form>

      <div aria-live="polite">
        {error && (
          <div className="rounded-lg border border-rule bg-raised p-5">
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {/* The notes are rendered above the results, not below them. A search
            that returned less because a provider was down is indistinguishable
            from a smaller literature, and a reader who has to scroll past the
            list to learn that has already drawn their conclusion. */}
        {notes.length > 0 && (
          <div className="mb-4 rounded-lg border border-rule bg-raised p-4 text-sm">
            <p className="mb-2 font-medium">What this search did</p>
            <ul className="space-y-1 text-muted">
              {notes.map((note, index) => (
                <li key={index}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        {references && references.length > 0 && (
          <>
            {/* Says which ordering produced this list. Sorted by date, a
                reference list looks exactly like one ranked by relevance —
                same layout, same badges — and somebody who cannot tell which
                they are reading cannot tell a thin field from a bad sort. */}
            <p className="mb-3 text-sm text-muted">
              Showing {references.length} of about {total.toLocaleString("en-GB")},{" "}
              {shownOrder === "recency" ? "newest first" : "most relevant first"}.
            </p>
            <ReferenceList references={references} />
          </>
        )}

        {references && references.length === 0 && !error && (
          <div className="rounded-lg border border-rule bg-raised p-5">
            <p className="leading-relaxed">
              Nothing came back for that. Read the notes above before concluding the literature is
              thin — a provider being unreachable looks exactly like this.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
