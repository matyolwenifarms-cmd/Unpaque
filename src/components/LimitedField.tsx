import { TEXT_LIMITS, nearLimit, textProblem, type TextLimitName } from "@shared/detective/limits.ts";
import { cn } from "@/lib/utils.ts";

/**
 * A text field that knows what the database will accept.
 *
 * One component rather than the same three lines in four forms, because the
 * failure it prevents is invisible until somebody hits it: every one of these
 * columns has a length constraint, none of the forms checked it, and what a
 * user got was `new row for relation "events" violates check constraint
 * "events_label_check"` — which names no field and states no limit.
 *
 * Deliberately **not** `maxLength`. That was the first thing written here and
 * then removed, because it makes the problem invisible rather than absent: a
 * browser truncates an over-long paste to fit and says nothing, so a paragraph
 * pasted into a 300-character field looks accepted and is silently half
 * recorded. In an investigation tool that is worse than the error it replaces
 * — the error was confusing, and this would be wrong.
 *
 * So the whole paste is kept, the field says in a sentence what is wrong with
 * it, and the form refuses to submit until the person has cut it themselves
 * and can see what they cut. The counter appears near the ceiling so that the
 * refusal is not a surprise.
 */
export function LimitedField({
  id,
  limit,
  label,
  hint,
  value,
  onChange,
  placeholder,
  rows,
}: {
  id: string;
  limit: TextLimitName;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Present for a field that expects a sentence or more. */
  rows?: number;
}) {
  const rule = TEXT_LIMITS[limit];
  const problem = textProblem(value, rule);
  const show = nearLimit(value, rule);
  const length = value.trim().length;

  const classes = cn(
    "w-full rounded-lg border bg-paper px-3 py-2 outline-none focus:border-accent",
    // `destructive` is for something wrong or about to be. A field that is
    // simply long is neither.
    problem ? "border-destructive" : "border-rule",
    rows ? "resize-y" : undefined,
  );

  return (
    <div className="mb-3">
      <label htmlFor={id} className="mb-1 block text-xs text-muted">
        {label}
        {hint && <span className="ml-1 opacity-80">{hint}</span>}
      </label>
      {rows ? (
        <textarea
          id={id}
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={classes}
        />
      ) : (
        <input
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={classes}
        />
      )}
      {/* aria-live so somebody using a screen reader hears the ceiling coming
          rather than meeting it. */}
      <div aria-live="polite" className="mt-1 min-h-[1rem] text-xs">
        {problem
          ? <span className="text-destructive">{problem}</span>
          : show && <span className="text-muted">{length} of {rule.max}</span>}
      </div>
    </div>
  );
}
