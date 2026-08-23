import { useMemo } from "react";
import { AlertTriangle, Info } from "lucide-react";
import type { Dataset } from "@shared/research/analytics/dataset.ts";
import { healthSummary, readHealth, type Finding } from "@shared/research/analytics/health.ts";
import {
  opportunitySummary,
  readOpportunities,
} from "@shared/research/analytics/questions.ts";
import { cn } from "@/lib/utils.ts";

/** "a", "a and b", "a, b and c" — never a list with a trailing comma. */
function names(values: readonly string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  return `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]!}`;
}

function Level({ finding }: { finding: Finding }) {
  const severe = finding.level === "will_mislead";
  return (
    <li
      className={cn(
        "rounded-lg border p-3",
        severe ? "border-red-500/30 bg-red-500/5" : "border-rule bg-paper",
      )}
    >
      <p className="flex items-start gap-1.5 text-sm">
        {severe ? (
          <AlertTriangle
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-400"
          />
        ) : (
          <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
        )}
        <span>
          {finding.column !== null && (
            <span className="font-medium">{finding.column}: </span>
          )}
          {finding.says}
        </span>
      </p>
      <p className="mt-1.5 pl-6 text-sm text-muted">{finding.consider}</p>
    </li>
  );
}

/**
 * What a supervisor would say about the file, before a test is chosen.
 *
 * `DatasetSummary` above this shows what was read, column by column, and a
 * researcher who has done this before can see the problems in it at a glance.
 * A novice cannot: a column read as `categorical` when they think it holds
 * ages, or a grouping variable with three levels where they expect two, is
 * only a problem if you already know it is one. This says so in sentences.
 *
 * **Nothing here runs anything, and the second panel is the reason that
 * matters.** Listing every pair of columns with a result beside it would be a
 * very efficient way to produce a false positive: ninety comparisons, one of
 * them small by arithmetic alone, and the eighty-nine that produced it never
 * written down. So the pairs are in the order the columns appear in the file,
 * carry no statistic, and the panel says out loud what choosing from it would
 * do.
 */
export function DataReview({ dataset }: { dataset: Dataset }) {
  const findings = useMemo(() => readHealth(dataset), [dataset]);
  const found = useMemo(() => readOpportunities(dataset), [dataset]);
  const explained = useMemo(
    () => new Set(findings.map((finding) => finding.column).filter((name) => name !== null)),
    [findings],
  );
  const pointed = found.setAside
    .filter((aside) => explained.has(aside.column))
    .map((aside) => aside.column);

  return (
    <>
      <section aria-labelledby="health" className="rounded-lg border border-rule bg-raised p-5">
        <h3
          id="health"
          className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted"
        >
          What is worth knowing before you run anything
        </h3>
        <p className="mb-4 text-sm">{healthSummary(findings)}</p>
        {findings.length > 0 && (
          <ul className="space-y-2">
            {findings.map((finding) => (
              <Level key={`${finding.kind}:${finding.column ?? "table"}`} finding={finding} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="questions" className="rounded-lg border border-rule bg-raised p-5">
        <h3
          id="questions"
          className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted"
        >
          What this data could answer
        </h3>
        <p className="mb-3 text-sm">{opportunitySummary(found)}</p>

        <ul className="mb-4 space-y-2 text-sm text-muted">
          {found.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>

        {found.opportunities.length > 0 && (
          <ul className="space-y-3">
            {found.opportunities.map((opportunity) => (
              <li key={opportunity.procedure.id} className="rounded-lg border border-rule bg-paper p-3">
                <p className="text-sm font-medium">{opportunity.procedure.name}</p>
                <p className="mt-0.5 text-sm text-muted">{opportunity.procedure.question}</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {opportunity.pairs.map((pair) => (
                    <li
                      key={`${pair.outcome}~${pair.factor}`}
                      className="rounded border border-rule px-2 py-0.5 text-xs"
                    >
                      {pair.outcome} <span className="text-muted">by</span> {pair.factor}
                    </li>
                  ))}
                </ul>
                {opportunity.total > opportunity.pairs.length && (
                  <p className="mt-2 text-xs text-muted">
                    {opportunity.pairs.length} of {opportunity.total} pairs shown.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {found.setAside.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-muted">
              {found.setAside.length} {found.setAside.length === 1 ? "column was" : "columns were"}{" "}
              left out of these pairs
            </summary>
            {/* A column already named in the panel above is not explained
                again here. `readOpportunities` carries the whole reason so
                that it stands alone in a report; on this screen, where both
                panels are rendered together, printing it twice is how a
                reader learns that half of what they are looking at is
                padding. */}
            <ul className="mt-2 space-y-1.5 text-sm text-muted">
              {pointed.length > 0 && (
                <li>
                  <span className="font-medium text-ink">{names(pointed)}</span>
                  {pointed.length === 1 ? " — for the reason given above." : " — each for the reason given above."}
                </li>
              )}
              {found.setAside
                .filter((aside) => !explained.has(aside.column))
                .map((aside) => (
                  <li key={aside.column}>
                    <span className="font-medium text-ink">{aside.column}</span> — {aside.because}
                  </li>
                ))}
            </ul>
          </details>
        )}
      </section>
    </>
  );
}
