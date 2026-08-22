import { DEVICES, deviceLabel, type Depth } from "@shared/diagnostic/devices.ts";
import { segments, type Annotation } from "@shared/diagnostic/annotate.ts";

/**
 * The submitted text with the findings sitting inside it.
 *
 * The whole text, not the highlighted parts: a reader is looking at their own
 * message, and a view that showed only the flagged phrases would be a list of
 * quotations — which is what this replaced and what could not show where
 * anything was.
 *
 * Every span is sliced from the source by offset, so what is highlighted is
 * necessarily what was submitted. Nothing here trusts a string.
 */
export function AnnotatedSource({
  text,
  annotations,
  depth,
}: {
  text: string;
  annotations: readonly Annotation[];
  depth: Depth;
}) {
  const pieces = segments(text, annotations);

  return (
    <p className="whitespace-pre-wrap text-[1.05rem] leading-loose">
      {pieces.map((piece, index) =>
        piece.annotation ? (
          <span key={index}>
            <mark
              className="rounded bg-accent/20 px-1 py-0.5 text-ink"
              // The device is on the mark rather than only in the parenthetical
              // so a screen reader gets the label with the phrase, in one
              // breath, instead of hearing an unexplained highlight and then a
              // bracketed fragment several words later.
              title={DEVICES[piece.annotation.device].gloss}
            >
              {piece.text}
            </mark>
            <span className="ml-1 text-xs text-muted">
              ({deviceLabel(piece.annotation.device, depth)})
            </span>
          </span>
        ) : (
          <span key={index}>{piece.text}</span>
        ),
      )}
    </p>
  );
}
