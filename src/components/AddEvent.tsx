import { useState } from "react";
import { DATE_CERTAINTIES, TIME_ORIGINS, type DateCertainty, type TimeOrigin } from "@shared/detective/timeline.ts";
import { createEvent, type EventRow, type SourceRow } from "@/lib/detective-api.ts";

export function AddEvent({
  caseId,
  sources,
  onAdded,
}: {
  caseId: string;
  sources: SourceRow[];
  onAdded: (event: EventRow) => void;
}) {
  const [sourceId, setSourceId] = useState("");
  const [label, setLabel] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [certainty, setCertainty] = useState<DateCertainty>("claimed");
  const [origin, setOrigin] = useState<TimeOrigin>("account");
  const [moment, setMoment] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  if (sources.length === 0) {
    return <p className="text-xs text-muted">Add a source first — every event comes from one.</p>;
  }

  const needsTime = certainty !== "unknown";
  const ready = sourceId !== "" && label.trim() !== "" && (!needsTime || occurredAt !== "");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setProblem("");
    const result = await createEvent(caseId, {
      sourceId,
      label,
      occurredAt: needsTime ? new Date(occurredAt).toISOString() : null,
      certainty,
      origin,
      moment,
    });
    setBusy(false);
    if (!result.ok) {
      setProblem(result.message);
      return;
    }
    onAdded(result.data);
    setLabel("");
    setOccurredAt("");
    setMoment("");
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-rule bg-raised p-4">
      <h5 className="mb-3 text-sm font-medium">Add an event</h5>

      <label htmlFor="event-label" className="mb-1 block text-xs text-muted">What happened?</label>
      <input
        id="event-label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="mb-3 w-full rounded-lg border border-rule bg-paper px-3 py-2 outline-none focus:border-accent"
      />

      <label htmlFor="event-source" className="mb-1 block text-xs text-muted">From which source?</label>
      <select
        id="event-source"
        value={sourceId}
        onChange={(e) => setSourceId(e.target.value)}
        className="mb-3 w-full rounded-lg border border-rule bg-paper px-3 py-2 outline-none focus:border-accent"
      >
        <option value="">Choose…</option>
        {sources.map((source) => (
          <option key={source.id} value={source.id}>{source.title}</option>
        ))}
      </select>

      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="event-certainty" className="mb-1 block text-xs text-muted">How well known?</label>
          <select
            id="event-certainty"
            value={certainty}
            onChange={(e) => setCertainty(e.target.value as DateCertainty)}
            className="w-full rounded-lg border border-rule bg-paper px-3 py-2 outline-none focus:border-accent"
          >
            {/* `conflicting` is absent on purpose: it is a property the engine
                derives from records that disagree, not something a person
                asserts about a single one. */}
            {DATE_CERTAINTIES.filter((option) => option !== "conflicting").map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="event-origin" className="mb-1 block text-xs text-muted">How established?</label>
          <select
            id="event-origin"
            value={origin}
            onChange={(e) => setOrigin(e.target.value as TimeOrigin)}
            className="w-full rounded-lg border border-rule bg-paper px-3 py-2 outline-none focus:border-accent"
          >
            {TIME_ORIGINS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

      {needsTime ? (
        <>
          <label htmlFor="event-at" className="mb-1 block text-xs text-muted">When?</label>
          <input
            id="event-at"
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="mb-3 w-full rounded-lg border border-rule bg-paper px-3 py-2 outline-none focus:border-accent"
          />
        </>
      ) : (
        // No date field at all when the time is unknown. Offering one and
        // discarding the answer would be worse than not asking.
        <p className="mb-3 text-xs text-muted">
          No time recorded. It will sit at the end of the timeline rather than being guessed at.
        </p>
      )}

      <label htmlFor="event-moment" className="mb-1 block text-xs text-muted">
        Which moment is this a record of? Records sharing a label are compared with each other.
      </label>
      <input
        id="event-moment"
        value={moment}
        onChange={(e) => setMoment(e.target.value)}
        placeholder="leaving Location X"
        className="mb-3 w-full rounded-lg border border-rule bg-paper px-3 py-2 outline-none focus:border-accent"
      />

      <button
        type="submit"
        disabled={!ready || busy}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-40"
      >
        {busy ? "Adding" : "Add event"}
      </button>
      {problem && <p className="mt-2 text-sm" role="alert">{problem}</p>}
    </form>
  );
}
