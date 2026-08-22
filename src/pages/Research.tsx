import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { ReferenceList } from "@/components/ReferenceList.tsx";
import { cn } from "@/lib/utils.ts";
import { searchReferences, type ResultOrder, type SearchedReference } from "@/lib/research-api.ts";

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

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Research</h1>
        <p className="mt-1 text-sm text-muted">
          Literature search. Every reference comes from a bibliographic provider and its identifier
          is re-checked before it is shown to you.
        </p>
      </header>

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

      <footer className="mt-12 border-t border-rule pt-5 text-sm leading-relaxed text-muted">
        <p>
          References come from OpenAlex and Crossref, never from a language model. An identifier
          that does not resolve is dropped rather than shown, and what was dropped is counted above.
        </p>
      </footer>
    </div>
  );
}
