import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Page } from "@shared/ingest/extract.ts";
import { loadPages } from "@/lib/corpus-api.ts";
import { selectionWithin } from "@/lib/dom-offsets.ts";

/** Where in a paper something is, as an address rather than a copy of it. */
export interface Passage {
  page: number;
  start: number;
  end: number;
  /** Sliced at render for display. Never stored, never sent anywhere. */
  text: string;
}

/**
 * A paper, as the pages that were read out of it.
 *
 * The selection is the point of this screen. A reader drags across a sentence
 * and gets back *where it is* — page, start, end — not the sentence. That
 * is the same discipline the coding surface works under and the same one the
 * passage engine imposes on the model: an address into a page can be checked
 * against the page, and a stored copy cannot be checked against anything.
 *
 * It is also what "show me the passage you are talking about" resolves to. A
 * finding that carries a page and two offsets can be answered exactly, without
 * anything generating a quotation.
 */
export function PaperView({
  sourceId,
  name,
  pageCount,
  onSelect,
}: {
  sourceId: string;
  name: string;
  pageCount: number;
  onSelect?: (passage: Passage | null) => void;
}) {
  const [pages, setPages] = useState<Page[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const bodies = useRef<Map<number, HTMLParagraphElement>>(new Map());

  useEffect(() => {
    let live = true;
    setPages(null);
    setProblem(null);
    void loadPages(sourceId).then((result) => {
      if (!live) return;
      if (result.ok) setPages(result.data);
      else setProblem(result.message);
    });
    return () => {
      live = false;
    };
  }, [sourceId]);

  function readSelection(page: Page) {
    const container = bodies.current.get(page.number);
    if (!container || !onSelect) return;
    const span = selectionWithin(container);
    if (span === null || span.end <= span.start) {
      onSelect(null);
      return;
    }
    onSelect({
      page: page.number,
      start: span.start,
      end: span.end,
      text: page.body.slice(span.start, span.end),
    });
  }

  return (
    <section aria-labelledby="paper" className="rounded-lg border border-rule bg-raised p-4">
      <h3 id="paper" className="text-sm font-medium">{name}</h3>
      <p className="mt-0.5 text-xs text-muted">
        {pageCount === 0
          ? "No text was read from this one, so there is nothing to show. It is probably a scan."
          : `${pageCount} page${pageCount === 1 ? "" : "s"} of text.${onSelect ? " Drag across a sentence to point at it." : ""}`}
      </p>

      {pages === null && problem === null && pageCount > 0 && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          Opening it…
        </p>
      )}
      {problem !== null && (
        <p className="mt-3 text-sm text-muted">The pages could not be loaded: {problem}</p>
      )}

      {pages !== null && (
        <ol className="mt-3 space-y-4">
          {pages.map((page) => (
            <li key={page.number}>
              <p className="text-xs uppercase tracking-wide text-muted">Page {page.number}</p>
              <p
                ref={(node) => {
                  if (node) bodies.current.set(page.number, node);
                  else bodies.current.delete(page.number);
                }}
                onMouseUp={() => readSelection(page)}
                onKeyUp={() => readSelection(page)}
                className="mt-1 whitespace-pre-wrap rounded-md bg-paper p-3 text-sm leading-relaxed"
              >
                {page.body}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
