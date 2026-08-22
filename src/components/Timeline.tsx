import { AlertTriangle, HelpCircle } from "lucide-react";
import {
  chronological,
  collectiveCertainty,
  findTemporalDiscrepancies,
  type Discrepancy,
  type TimelineEvent,
} from "@shared/detective/timeline.ts";
import type { EventRow, SourceRow } from "@/lib/detective-api.ts";
import { cn } from "@/lib/utils.ts";

function toEngineEvent(row: EventRow): TimelineEvent {
  return {
    id: row.id,
    label: row.label,
    // The engine treats an unknown-time event as comparable to nothing, so the
    // value here is never read for those. An epoch string would be read if that
    // ever changed, which is why the certainty travels with it.
    at: row.occurred_at ?? "",
    certainty: row.certainty,
    origin: row.origin,
    sourceId: row.source_id,
    ...(row.tolerance_minutes === null ? {} : { toleranceMinutes: row.tolerance_minutes }),
  };
}

const CERTAINTY_TONE: Record<string, string> = {
  confirmed: "bg-accent/15 text-accent",
  claimed: "bg-paper text-muted",
  approximate: "bg-paper text-muted",
  unknown: "bg-paper text-muted",
  conflicting: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

function DiscrepancyCard({
  discrepancy,
  named,
}: {
  discrepancy: Discrepancy;
  named: (sourceId: string) => string;
}) {
  return (
    <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
      <p className="flex items-start gap-2 font-medium">
        <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <span>
          Timeline discrepancy — {discrepancy.differenceMinutes} minutes between{" "}
          {named(discrepancy.a.sourceId)} and {named(discrepancy.b.sourceId)}
        </span>
      </p>

      {/* The heading is the whole point of §9. A list of explanations under a
          neutral header reads as hedging; under this one it reads as the
          question the investigator is being asked to answer. */}
      <p className="mt-3 text-sm font-medium">What else could explain this?</p>
      <ul className="mt-2 space-y-2">
        {discrepancy.explanations.map((explanation, index) => (
          <li key={index} className="text-sm">
            <span>{explanation.summary}</span>
            <span className="mt-0.5 flex items-start gap-1.5 text-xs text-muted">
              <HelpCircle aria-hidden className="mt-0.5 h-3 w-3 shrink-0" />
              <span>Distinguished by: {explanation.distinguishedBy}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-muted">
        Recorded as a potential contradiction. Nothing here concludes anything about anybody.
      </p>
    </div>
  );
}

export function Timeline({ events, sources }: { events: EventRow[]; sources: SourceRow[] }) {
  const named = (sourceId: string) =>
    sources.find((source) => source.id === sourceId)?.title ?? "an unnamed source";

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted">
        No events yet. Add one from a source and the timeline builds itself.
      </p>
    );
  }

  // Grouped by the investigator's own label. Records with no moment are shown
  // in the timeline and compared with nothing, because nobody has said they
  // describe the same thing as anything else.
  const moments = new Map<string, EventRow[]>();
  for (const row of events) {
    if (!row.moment) continue;
    moments.set(row.moment, [...(moments.get(row.moment) ?? []), row]);
  }

  const ordered = chronological(events.map(toEngineEvent));

  return (
    <div>
      <ol className="space-y-2">
        {ordered.map((event) => {
          const row = events.find((candidate) => candidate.id === event.id)!;
          return (
            <li key={event.id} className="rounded-lg border border-rule bg-raised p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{event.label}</span>
                <span
                  className={cn("rounded px-1.5 py-0.5 text-xs", CERTAINTY_TONE[event.certainty])}
                >
                  {event.certainty}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">
                {row.occurred_at
                  ? new Date(row.occurred_at).toLocaleString("en-GB")
                  : "Time unknown — placed last rather than guessed"}
                {" · "}
                {row.origin}
                {" · "}
                {named(row.source_id)}
              </p>
              {row.moment && <p className="mt-1 text-xs text-muted">Moment: {row.moment}</p>}
            </li>
          );
        })}
      </ol>

      {[...moments.entries()].map(([moment, rows]) => {
        const engineEvents = rows.map(toEngineEvent);
        const discrepancies = findTemporalDiscrepancies(engineEvents);
        const certainty = collectiveCertainty(engineEvents);
        if (discrepancies.length === 0) {
          return rows.length > 1 ? (
            <p key={moment} className="mt-3 text-sm text-muted">
              “{moment}”: {rows.length} records agree, collectively {certainty}.
            </p>
          ) : null;
        }
        return (
          <div key={moment} className="mt-4">
            <p className="text-sm font-medium">“{moment}” — {certainty}</p>
            {discrepancies.map((discrepancy, index) => (
              <DiscrepancyCard key={index} discrepancy={discrepancy} named={named} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
