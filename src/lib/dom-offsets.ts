/**
 * Where a browser selection sits in the source text.
 *
 * The coding surface renders a document as many spans - one per stretch cut at
 * a coding boundary - and a `Selection` reports its ends as (node, offset)
 * pairs inside whichever of those spans the pointer happened to land in. A
 * coding is stored as an offset into the whole document, so the two have to be
 * reconciled somewhere.
 *
 * It is done by walking the container's text nodes in document order and
 * summing their lengths, rather than by reading a `data-start` off the nearest
 * span. The attribute version is shorter and wrong the moment anything is
 * rendered between the spans - a label, a marker, a space React inserted -
 * because the walk counts every character the reader can see and the attribute
 * counts only what was deliberately labelled. Since the same layers are what
 * `layers()` produced from the source, the sum is the source offset.
 *
 * Elements marked `data-not-source` are skipped: the surface prints a code
 * label after each highlight, and that text is not in the transcript. Without
 * the exclusion every coding after the first would be displaced by the length
 * of the labels above it, which is the kind of bug that looks like an
 * off-by-one and is an off-by-fourteen.
 */

function isExcluded(node: Node, container: Node): boolean {
  let walking: Node | null = node;
  while (walking && walking !== container) {
    if (
      walking.nodeType === Node.ELEMENT_NODE &&
      (walking as Element).hasAttribute("data-not-source")
    ) {
      return true;
    }
    walking = walking.parentNode;
  }
  return false;
}

/** The offset of (node, offset) within `container`, counting only source text. */
export function offsetWithin(container: Node, node: Node, offset: number): number | null {
  if (!container.contains(node)) return null;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let total = 0;
  let text = walker.nextNode();
  while (text) {
    if (text === node) {
      return isExcluded(text, container) ? null : total + offset;
    }
    if (!isExcluded(text, container)) total += text.textContent?.length ?? 0;
    text = walker.nextNode();
  }

  // The selection ended on an element rather than inside a text node, which is
  // what a triple-click or a select-all gives. Its offset counts child nodes,
  // not characters, so the only honest answer is the end of everything
  // preceding it - and for the container itself that is the whole length.
  if (node === container) return offset === 0 ? 0 : total;
  return null;
}

/** The current selection as offsets into `container`'s source text, if it is one. */
export function selectionWithin(container: Node): { start: number; end: number } | null {
  const selection = typeof window === "undefined" ? null : window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
    return null;
  }

  const start = offsetWithin(container, range.startContainer, range.startOffset);
  const end = offsetWithin(container, range.endContainer, range.endOffset);
  if (start === null || end === null) return null;
  // A selection dragged right-to-left still reports its ends in document
  // order, but a range built by hand may not, and a negative-length coding
  // fails a bounds check with a message about the document rather than about
  // the drag.
  return start <= end ? { start, end } : { start: end, end: start };
}
