import { useRef, useState } from "react";
import type { Code } from "@shared/research/qualitative/codebook.ts";
import {
  codingProblems,
  layers,
  toWholeWords,
  type Coding,
} from "@shared/research/qualitative/coding.ts";
import { selectionWithin } from "@/lib/dom-offsets.ts";

/**
 * A transcript with its codings on it, and the selection that adds one.
 *
 * The document is rendered whole. A view that showed only coded extracts is a
 * quotation list, and the thing a researcher is actually doing here is
 * reading — noticing what is *not* coded is half of it.
 *
 * Every highlight is sliced from the source by offset, so what is on screen is
 * necessarily what is stored. Nothing is a copy.
 */
export function CodeDocument({
  documentId,
  text,
  codes,
  codings,
  onCode,
  onUncode,
}: {
  documentId: string;
  text: string;
  codes: readonly Code[];
  codings: readonly Coding[];
  onCode: (coding: Coding) => void;
  onUncode: (id: string) => void;
}) {
  const source = useRef<HTMLParagraphElement>(null);
  const [selected, setSelected] = useState<{ start: number; end: number } | null>(null);
  const [memo, setMemo] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const mine = codings.filter((coding) => coding.documentId === documentId);
  const pieces = layers(text, mine);
  const labelOf = (id: string) => codes.find((code) => code.id === id)?.label ?? id;

  function readSelection() {
    const container = source.current;
    if (!container) return;
    const range = selectionWithin(container);
    if (!range) {
      setSelected(null);
      setProblem(null);
      return;
    }
    // Widened before it is shown, so the extract in the panel is the extract
    // that will be stored. Showing the raw drag and widening on save would
    // mean the researcher approved one thing and filed another.
    const whole = toWholeWords(text, range.start, range.end);
    const problems = codingProblems(whole, text);
    setSelected(problems.some((p) => p.kind === "out_of_bounds" || p.kind === "empty") ? null : whole);
    setProblem(problems[0]?.says ?? null);
  }

  function apply(codeId: string) {
    if (!selected) return;
    const problems = codingProblems(selected, text);
    if (problems.length > 0) {
      setProblem(problems[0]!.says);
      return;
    }
    onCode({
      id: crypto.randomUUID(),
      documentId,
      codeId,
      start: selected.start,
      end: selected.end,
      memo: memo.trim() === "" ? null : memo.trim(),
    });
    setSelected(null);
    setMemo("");
    setProblem(null);
    window.getSelection()?.removeAllRanges();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="rounded-lg border border-rule bg-raised p-5">
        <p
          ref={source}
          onMouseUp={readSelection}
          onKeyUp={readSelection}
          className="whitespace-pre-wrap font-serif text-[1.05rem] leading-loose"
        >
          {pieces.map((piece) =>
            piece.codeIds.length > 0 ? (
              <span key={piece.start}>
                <mark
                  className="rounded bg-accent/20 px-0.5 text-ink"
                  title={piece.codeIds.map(labelOf).join(", ")}
                >
                  {piece.text}
                </mark>
                {/* Excluded from the offset walk. It is not in the transcript,
                    and counting it would displace every coding below it. */}
                <span data-not-source className="ml-1 align-super text-[0.65rem] text-muted">
                  {piece.codeIds.map(labelOf).join(" · ")}
                </span>
              </span>
            ) : (
              <span key={piece.start}>{piece.text}</span>
            ),
          )}
        </p>
      </div>

      <div className="space-y-4">
        <section className="rounded-lg border border-rule bg-raised p-4">
          <h4 className="mb-2 text-sm font-medium">Apply a code</h4>
          {selected === null ? (
            <p className="text-sm text-muted">
              Select a passage in the transcript. The selection is widened to whole words, because an
              extract beginning mid-word reads as a transcription error in a findings chapter.
            </p>
          ) : (
            <>
              <blockquote className="mb-3 border-l-2 border-accent pl-3 font-serif text-sm">
                {text.slice(selected.start, selected.end)}
              </blockquote>
              <label htmlFor="coding-memo" className="mb-1 block text-xs text-muted">
                Why this code, here? (optional, and often the best part)
              </label>
              <textarea
                id="coding-memo"
                rows={2}
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                className="mb-3 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
              />
              {codes.length === 0 ? (
                <p className="text-sm text-muted">Write a code first.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {codes.map((code) => (
                    <button
                      key={code.id}
                      type="button"
                      onClick={() => apply(code.id)}
                      title={code.definition}
                      className="rounded-lg border border-rule px-3 py-1.5 text-xs hover:border-accent"
                    >
                      {code.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {problem && (
            <p className="mt-2 text-xs text-muted" role="status">
              {problem}
            </p>
          )}
        </section>

        <section className="rounded-lg border border-rule bg-raised p-4">
          <h4 className="mb-2 text-sm font-medium">
            Coded here ({mine.length})
          </h4>
          {mine.length === 0 ? (
            <p className="text-sm text-muted">Nothing coded in this document yet.</p>
          ) : (
            <ul className="space-y-2">
              {[...mine]
                .sort((a, b) => a.start - b.start)
                .map((coding) => (
                  <li key={coding.id} className="rounded border border-rule bg-paper p-2">
                    <p className="text-xs font-medium">{labelOf(coding.codeId)}</p>
                    <p className="mt-0.5 font-serif text-xs text-muted">
                      {text.slice(coding.start, coding.end)}
                    </p>
                    {coding.memo && <p className="mt-1 text-xs text-muted">{coding.memo}</p>}
                    <button
                      type="button"
                      onClick={() => onUncode(coding.id)}
                      className="mt-1 text-xs text-muted underline hover:text-ink"
                    >
                      Remove
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
