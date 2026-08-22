import { useState } from "react";
import { byCategory, codeProblems, type Code } from "@shared/research/qualitative/codebook.ts";

/**
 * The codebook: every code, and the form that adds one.
 *
 * The form asks for "not when" on the same footing as "when", and will not
 * submit without it. That is the one departure from how most tools do this,
 * and it is deliberate — an optional exclusion field is an empty exclusion
 * field, and the first time two coders disagree there is nothing in the
 * codebook to settle it.
 */
export function Codebook({
  codes,
  counts,
  onAdd,
  onRemove,
}: {
  codes: readonly Code[];
  /** How many extracts carry each code. Zero is worth seeing. */
  counts: ReadonlyMap<string, number>;
  onAdd: (code: Omit<Code, "id">) => void;
  onRemove: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Partial<Code>>({});
  const [open, setOpen] = useState(false);
  const problems = codeProblems(draft, codes);

  function add(event: React.FormEvent) {
    event.preventDefault();
    if (problems.length > 0) return;
    // No id. The store owns identity, because when the workspace is kept the
    // real id is the one Postgres returns and a client-invented one would be
    // silently replaced on the next load.
    onAdd({
      label: draft.label!.trim(),
      definition: draft.definition!.trim(),
      when: draft.when!.trim(),
      notWhen: draft.notWhen!.trim(),
      parentId: draft.parentId || null,
    });
    setDraft({});
    setOpen(false);
  }

  const grouped = byCategory(codes);

  return (
    <section className="rounded-lg border border-rule bg-raised p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Codebook</h3>
        <button
          type="button"
          onClick={() => setOpen((was) => !was)}
          className="rounded-lg border border-rule px-3 py-1.5 text-xs hover:border-accent"
        >
          {open ? "Close" : "New code"}
        </button>
      </div>

      {codes.length === 0 && !open && (
        <p className="text-sm text-muted">
          No codes yet. A code is a name for something you keep noticing, with a definition somebody
          else could apply to the same transcript and reach the same places.
        </p>
      )}

      {grouped.map(({ category, codes: within }) => (
        <div key={category?.id ?? "loose"} className="mb-3">
          {category && (
            <p className="mb-1 text-xs uppercase tracking-wide text-muted">{category.label}</p>
          )}
          <ul className="space-y-2">
            {within.map((code) => (
              <li key={code.id} className="rounded border border-rule bg-paper p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">{code.label}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {counts.get(code.id) ?? 0} extract{(counts.get(code.id) ?? 0) === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">{code.definition}</p>
                <p className="mt-1 text-xs text-muted">
                  <span className="font-medium text-ink">Apply when</span> {code.when}
                </p>
                <p className="mt-1 text-xs text-muted">
                  <span className="font-medium text-ink">Not when</span> {code.notWhen}
                </p>
                <button
                  type="button"
                  onClick={() => onRemove(code.id)}
                  className="mt-2 text-xs text-muted underline hover:text-ink"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {open && (
        <form onSubmit={add} className="mt-3 rounded border border-rule bg-paper p-3">
          <Field
            id="code-label"
            label="Name"
            hint="Short. It sits beside every extract."
            value={draft.label ?? ""}
            onChange={(label) => setDraft((was) => ({ ...was, label }))}
          />
          <Field
            id="code-definition"
            label="Definition"
            hint="One sentence, written so a second coder could use it."
            rows={2}
            value={draft.definition ?? ""}
            onChange={(definition) => setDraft((was) => ({ ...was, definition }))}
          />
          <Field
            id="code-when"
            label="Apply when"
            rows={2}
            value={draft.when ?? ""}
            onChange={(when) => setDraft((was) => ({ ...was, when }))}
          />
          <Field
            id="code-not-when"
            label="Not when"
            hint="Including the near-misses. This is the field that settles a disagreement between two coders."
            rows={2}
            value={draft.notWhen ?? ""}
            onChange={(notWhen) => setDraft((was) => ({ ...was, notWhen }))}
          />

          <label htmlFor="code-parent" className="mb-1 block text-xs text-muted">
            Inside a category (optional)
          </label>
          <select
            id="code-parent"
            value={draft.parentId ?? ""}
            onChange={(event) => setDraft((was) => ({ ...was, parentId: event.target.value }))}
            className="mb-3 w-full rounded-lg border border-rule bg-raised px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="">None</option>
            {codes
              .filter((code) => !code.parentId)
              .map((code) => (
                <option key={code.id} value={code.id}>
                  {code.label}
                </option>
              ))}
          </select>

          {/* Shown rather than only disabling the button: a form that will not
              submit and does not say why is the commonest reason a required
              field gets called a bug. */}
          {problems.length > 0 && (
            <ul className="mb-3 space-y-1">
              {problems.map((problem) => (
                <li key={problem.field} className="text-xs text-muted">
                  {problem.says}
                </li>
              ))}
            </ul>
          )}

          <button
            type="submit"
            disabled={problems.length > 0}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-40"
          >
            Add code
          </button>
        </form>
      )}
    </section>
  );
}

function Field({
  id,
  label,
  hint,
  rows,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  rows?: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const described = hint ? `${id}-hint` : undefined;
  return (
    <div className="mb-3">
      <label htmlFor={id} className="mb-1 block text-xs text-muted">
        {label}
      </label>
      {rows ? (
        <textarea
          id={id}
          rows={rows}
          value={value}
          aria-describedby={described}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-lg border border-rule bg-raised px-3 py-2 text-sm outline-none focus:border-accent"
        />
      ) : (
        <input
          id={id}
          value={value}
          aria-describedby={described}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-lg border border-rule bg-raised px-3 py-2 text-sm outline-none focus:border-accent"
        />
      )}
      {hint && (
        <p id={described} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
