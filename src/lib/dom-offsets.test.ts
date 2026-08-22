/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { offsetWithin } from "./dom-offsets.ts";

const TEXT = "The cost was the first thing everyone mentioned.";

/** The shape the coding surface renders: layers, each with a label after it. */
function render(): { container: HTMLElement; pieces: Text[] } {
  const container = document.createElement("p");
  const pieces: Text[] = [];
  for (const [from, to, label] of [[0, 4, null], [4, 8, "cost"], [8, TEXT.length, null]] as const) {
    const text = document.createTextNode(TEXT.slice(from, to));
    if (label === null) {
      container.appendChild(text);
    } else {
      const mark = document.createElement("mark");
      mark.appendChild(text);
      container.appendChild(mark);
      const tag = document.createElement("span");
      tag.setAttribute("data-not-source", "");
      tag.textContent = ` (${label}) `;
      container.appendChild(tag);
    }
    pieces.push(text);
  }
  document.body.replaceChildren(container);
  return { container, pieces };
}

describe("reading an offset out of the rendered document", () => {
  it("counts from the start of the container, across spans", () => {
    const { container, pieces } = render();
    expect(offsetWithin(container, pieces[0]!, 0)).toBe(0);
    expect(offsetWithin(container, pieces[1]!, 0)).toBe(4);
    expect(offsetWithin(container, pieces[1]!, 4)).toBe(8);
  });

  // The whole reason the walk excludes labelled nodes. Without it this is 8
  // characters out, and every coding made below an existing one lands wrong.
  it("does not count the code labels the surface prints", () => {
    const { container, pieces } = render();
    expect(offsetWithin(container, pieces[2]!, 0)).toBe(8);
    expect(offsetWithin(container, pieces[2]!, 5)).toBe(13);
    expect(container.textContent).not.toBe(TEXT);
  });

  it("refuses an offset inside a label rather than guessing one", () => {
    const { container } = render();
    const label = container.querySelector("[data-not-source]")!.firstChild!;
    expect(offsetWithin(container, label, 2)).toBeNull();
  });

  it("refuses a node outside the container", () => {
    const { container } = render();
    const elsewhere = document.createElement("p");
    elsewhere.textContent = "somewhere else";
    document.body.appendChild(elsewhere);
    expect(offsetWithin(container, elsewhere.firstChild!, 3)).toBeNull();
  });

  // What a triple-click gives: the container itself, with a child index.
  it("reads a selection that ends on the container as the end of the text", () => {
    const { container } = render();
    expect(offsetWithin(container, container, 0)).toBe(0);
    expect(offsetWithin(container, container, container.childNodes.length)).toBe(TEXT.length);
  });
});
