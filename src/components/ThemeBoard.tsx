import { useState } from "react";
import type { Code } from "@shared/research/qualitative/codebook.ts";
import type { Coding } from "@shared/research/qualitative/coding.ts";
import {
  assembleThemes,
  reachOf,
  uncoveredCodes,
  type ThemeDraft,
} from "@shared/research/qualitative/themes.ts";

/**
 * Themes, and what the data says about whether they exist.
 *
 * A draft is what the analyst writes; a theme is what comes back once the
 * codings are counted. The two are kept visibly separate because the failure
 * this guards against is not carelessness — it is the ordinary, invisible slide
 * from "I think this is a theme" to "this is a theme", with nothing on screen
 * marking where it happened.
 *
 * A draft nothing is coded to is not hidden and not deleted. It is shown with
 * the reason, because that is a finding about the analysis.
 */
export function ThemeBoard({
  codes,
  codings,
  documents,
  drafts,
  onAdd,
  onRemove,
}: {
  codes: readonly Code[];
  codings: readonly Coding[];
  documents: ReadonlyMap<string, string>;
  drafts: readonly ThemeDraft[];
  onAdd: (draft: Omit<ThemeDraft, "id">) => void;
  onRemove: (id: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [statement, setStatement] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);

  const { themes, withoutEvidence } = assembleThemes(drafts, codes, codings, documents);
  const uncovered = uncoveredCodes(themes, codes, codings);

  function add(event: React.FormEvent) {
    event.preventDefault();
    if (label.trim() === "" || chosen.length === 0) return;
    onAdd({ label: label.trim(), statement: statement.trim(), codeIds: chosen });
    setLabel("");
    setStatement("");
    setChosen([]);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="rounded-lg border border-rule bg-raised p-4">
        <h3 className="mb-3 text-sm font-medium">Assemble a theme</h3>

        <label htmlFor="theme-label" className="mb-1 block text-xs text-muted">
          Name
        </label>
        <input
          id="theme-label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          className="mb-3 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
        />

        <label htmlFor="theme-statement" className="mb-1 block text-xs text-muted">
          What holds these codes together?
        </label>
        <textarea
          id="theme-statement"
          rows={2}
          value={statement}
          onChange={(event) => setStatement(event.target.value)}
          className="mb-3 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
        />

        <fieldset className="mb-3">
          <legend className="mb-1 text-xs text-muted">Codes gathered under it</legend>
          {codes.length === 0 ? (
            <p className="text-sm text-muted">No codes to gather yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {codes.map((code) => {
                const on = chosen.includes(code.id);
                return (
                  <button
                    key={code.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setChosen((was) =>
                        on ? was.filter((id) => id !== code.id) : [...was, code.id],
                      )
                    }
                    className={`rounded-lg border px-3 py-1.5 text-xs ${
                      on ? "border-accent bg-accent/10" : "border-rule hover:border-accent"
                    }`}
                  >
                    {code.label}
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>

        <button
          type="submit"
          disabled={label.trim() === "" || chosen.length === 0}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-40"
        >
          Assemble
        </button>
      </form>

      {themes.map((theme) => (
        <article key={theme.id} className="rounded-lg border border-rule bg-raised p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="text-sm font-medium">{theme.label}</h4>
            <button
              type="button"
              onClick={() => onRemove(theme.id)}
              className="shrink-0 text-xs text-muted underline hover:text-ink"
            >
              Remove
            </button>
          </div>
          {theme.statement && <p className="mt-1 text-sm text-muted">{theme.statement}</p>}
          <p className="mt-2 text-xs text-muted">{reachOf(theme)}</p>

          <ul className="mt-3 space-y-2">
            {theme.extracts.map((extract) => (
              <li key={extract.codingId} className="border-l-2 border-accent pl-3">
                <p className="font-serif text-sm">{extract.text}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {extract.documentId} · {codes.find((c) => c.id === extract.codeId)?.label}
                  {extract.memo ? ` · ${extract.memo}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </article>
      ))}

      {withoutEvidence.map(({ draft, says }) => (
        <article key={draft.id} className="rounded-lg border border-dashed border-rule p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="text-sm font-medium text-muted">{draft.label}</h4>
            <button
              type="button"
              onClick={() => onRemove(draft.id)}
              className="shrink-0 text-xs text-muted underline hover:text-ink"
            >
              Remove
            </button>
          </div>
          <p className="mt-1 text-sm text-muted">{says}</p>
        </article>
      ))}

      {uncovered.length > 0 && (
        <section className="rounded-lg border border-rule bg-raised p-4">
          <h4 className="text-sm font-medium">Coded, but under no theme</h4>
          {/* The other half of the same honesty. Themes assembled from a subset
              of the codes look complete, and the codes left out are exactly the
              ones that did not fit the story. */}
          <p className="mt-1 text-sm text-muted">
            {uncovered.map((code) => code.label).join(", ")}.{" "}
            {uncovered.length === 1 ? "This code is" : "These codes are"} in the data and outside
            the account so far, which is usually the material worth looking at again.
          </p>
        </section>
      )}
    </div>
  );
}
