import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  BROADCAST_PANELS,
  lowerThird,
  panelForKey,
  sourceLabel,
  TITLE_SAFE_PERCENT,
  type BroadcastPanel,
} from "@shared/detective/broadcast.ts";
import { assembleHypotheses } from "@shared/detective/hypothesis.ts";
import { RequireSession } from "@/components/RequireSession.tsx";
import {
  getCase,
  listClaims,
  listEvents,
  listHypotheses,
  listHypothesisEvidence,
  listSources,
  type CaseSummary,
  type ClaimRow,
  type EventRow,
  type HypothesisEvidenceRow,
  type HypothesisRow,
  type SourceRow,
} from "@/lib/detective-api.ts";
import { cn } from "@/lib/utils.ts";

/**
 * A case, laid out for a camera.
 *
 * Section 25. Its own route rather than a mode on the case page, because the
 * way this is actually used is by pointing a capture source at a URL — and a
 * mode is a thing somebody has to remember to turn on before going live.
 *
 * **There is no media panel, and the screen says so.** Sections 7 and 8 are not
 * built, so an enlarged central media view would be a frame around an absence.
 * What is presented is the reasoning: what is claimed, what it rests on, what
 * happened when, and which explanations are on the table. Do not add a media
 * frame here until there is media to put in it.
 */
export default function Broadcast() {
  const { id = "" } = useParams();
  return (
    <>
      {/* Outside the gate, so the route has a heading even when it cannot show
          a case. Every route titles itself: the browser smoke check asserts
          exactly one h1, and it found this one missing. */}
      <h1 className="sr-only">Broadcast</h1>
      <RequireSession>
        <BroadcastCase id={id} />
      </RequireSession>
    </>
  );
}

function BroadcastCase({ id }: { id: string }) {
  const [investigation, setInvestigation] = useState<CaseSummary | null | undefined>(undefined);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [hypotheses, setHypotheses] = useState<HypothesisRow[]>([]);
  const [links, setLinks] = useState<HypothesisEvidenceRow[]>([]);
  const [panel, setPanel] = useState<BroadcastPanel>("claims");

  useEffect(() => {
    let active = true;
    void (async () => {
      const found = await getCase(id);
      if (!active || !found.ok) return;
      setInvestigation(found.data);
      if (!found.data) return;
      const [claimResult, sourceResult, eventResult, hypothesisResult, linkResult] =
        await Promise.all([
          listClaims(id), listSources(id), listEvents(id),
          listHypotheses(id), listHypothesisEvidence(id),
        ]);
      if (!active) return;
      if (claimResult.ok) setClaims(claimResult.data);
      if (sourceResult.ok) setSources(sourceResult.data);
      if (eventResult.ok) setEvents(eventResult.data);
      if (hypothesisResult.ok) setHypotheses(hypothesisResult.data);
      if (linkResult.ok) setLinks(linkResult.data);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  // Number keys switch panels. A presenter has one hand and no cursor.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const next = panelForKey(event.key);
      if (next) setPanel(next);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (investigation === undefined) return null;
  if (investigation === null) {
    return (
      <p className="p-8 text-sm text-muted">
        That case is not available. <Link to="/cases" className="underline">Back to cases</Link>
      </p>
    );
  }

  return (
    <div
      // 16:9, and the whole thing scales with the viewport rather than assuming
      // 1920x1080 — a capture at 1280x720 is the same layout, smaller.
      className="fixed inset-0 z-50 overflow-hidden bg-paper text-ink"
      style={{ containerType: "size" }}
    >
      <div
        className="flex h-full w-full flex-col"
        // Title-safe. A television overcans the picture, so text laid to the
        // edge of the frame has its ends cut off in the room.
        style={{ padding: `${TITLE_SAFE_PERCENT / 2}% ${TITLE_SAFE_PERCENT / 2}%` }}
      >
        <header className="mb-[2vh] flex items-baseline justify-between gap-4">
          <div>
            <p className="text-[1.2vw] uppercase tracking-[0.3em] text-muted">The Detective</p>
            <h2 className="text-[2.6vw] font-bold leading-tight">{investigation.title}</h2>
          </div>
          <Link
            to={`/cases/${id}`}
            className="text-[0.9vw] text-muted underline hover:text-ink"
          >
            Leave broadcast
          </Link>
        </header>

        <nav aria-label="Panel" className="mb-[2vh] flex gap-[1vw]">
          {BROADCAST_PANELS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={panel === option.id}
              onClick={() => setPanel(option.id)}
              className={cn(
                "rounded px-[1vw] py-[0.6vh] text-[1vw] uppercase tracking-widest",
                panel === option.id ? "bg-accent text-accent-ink" : "border border-rule text-muted",
              )}
            >
              <span className="mr-[0.5vw] opacity-60">{option.key}</span>
              {option.name}
            </button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-hidden">
          {panel === "claims" && <Claims claims={claims} />}
          {panel === "sources" && <Sources sources={sources} />}
          {panel === "timeline" && <Events events={events} sources={sources} />}
          {panel === "explanations" && <Explanations hypotheses={hypotheses} links={links} sources={sources} />}
        </div>

        {/* Said on the screen rather than in a comment nobody reading the
            broadcast will see. Removing this notice is a change to make when
            there is media, and not before. */}
        <footer className="mt-[2vh] text-[0.8vw] text-muted">
          Media, transcripts and synchronised playback are not built. This presents the case’s
          reasoning: what is claimed, what it rests on, and what is still open.
        </footer>
      </div>
    </div>
  );
}

function Claims({ claims }: { claims: readonly ClaimRow[] }) {
  if (claims.length === 0) return <Empty what="claims" />;
  return (
    <ul className="grid h-full grid-cols-2 gap-[1.5vw] overflow-hidden">
      {claims.slice(0, 6).map((claim) => {
        const third = lowerThird(claim);
        return (
          <li key={claim.id} className="border-l-[0.3vw] border-accent pl-[1vw]">
            <p className="text-[1.5vw] leading-snug">{third.statement}</p>
            {/* The classification is on screen with the claim, always. A claim
                broadcast without one is broadcast as a fact, whatever the
                presenter says over it — the viewer keeps the caption. */}
            <p className="mt-[0.6vh] text-[0.9vw] uppercase tracking-[0.2em] text-muted">
              {third.status}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function Sources({ sources }: { sources: readonly SourceRow[] }) {
  if (sources.length === 0) return <Empty what="sources" />;
  return (
    <ul className="grid h-full grid-cols-2 gap-[1.5vw] overflow-hidden">
      {sources.slice(0, 8).map((source) => (
        <li key={source.id}>
          <p className="text-[0.9vw] uppercase tracking-[0.2em] text-accent">
            {sourceLabel(source.reference)}
          </p>
          <p className="text-[1.3vw] leading-snug">{source.title}</p>
          <p className="mt-[0.4vh] text-[0.85vw] uppercase tracking-[0.15em] text-muted">
            {source.kind.replace(/_/g, " ")}
          </p>
        </li>
      ))}
    </ul>
  );
}

function Events({ events, sources }: { events: readonly EventRow[]; sources: readonly SourceRow[] }) {
  if (events.length === 0) return <Empty what="events" />;
  const reference = (sourceId: string) =>
    sources.find((source) => source.id === sourceId)?.reference ?? null;

  return (
    <ol className="h-full space-y-[1.4vh] overflow-hidden">
      {events.slice(0, 8).map((event) => (
        <li key={event.id} className="flex items-baseline gap-[1.5vw]">
          <span className="w-[12vw] shrink-0 text-[1vw] uppercase tracking-[0.15em] text-muted">
            {/* `unknown` is a legitimate state on an event, so the column shows
                it rather than leaving a gap that reads as a missing value. */}
            {event.occurred_at ? event.occurred_at.slice(0, 16).replace("T", " ") : "TIME UNKNOWN"}
          </span>
          <span className="flex-1 text-[1.3vw] leading-snug">{event.label}</span>
          <span className="shrink-0 text-[0.9vw] uppercase tracking-[0.2em] text-accent">
            {sourceLabel(reference(event.source_id))}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Explanations({
  hypotheses,
  links,
  sources,
}: {
  hypotheses: readonly HypothesisRow[];
  links: readonly HypothesisEvidenceRow[];
  sources: readonly SourceRow[];
}) {
  const outcome = assembleHypotheses(
    hypotheses,
    links.map((link) => ({
      id: link.id,
      hypothesisId: link.hypothesis_id,
      codeId: undefined as never,
      classification: link.classification,
      sourceId: link.source_id,
      sourceTitle: sources.find((source) => source.id === link.source_id)?.title ?? "",
      summary: link.summary,
      contentHash: sources.find((source) => source.id === link.source_id)?.content_hash ?? null,
    })),
  );

  if (outcome.kind === "refused") {
    return (
      <div className="flex h-full items-center">
        <p className="max-w-[60vw] text-[1.4vw] leading-snug text-muted">{outcome.says}</p>
      </div>
    );
  }

  return (
    <ul className="grid h-full grid-cols-2 gap-[2vw] overflow-hidden">
      {outcome.set.hypotheses.slice(0, 4).map((hypothesis) => (
        <li key={hypothesis.id} className="border-l-[0.3vw] border-accent pl-[1vw]">
          <p className="text-[1.4vw] leading-snug">{hypothesis.statement}</p>
          {/* Counts, never a score. Nothing on this screen ranks a theory. */}
          <p className="mt-[0.6vh] text-[0.9vw] uppercase tracking-[0.2em] text-muted">
            {hypothesis.independentSupport} independent{" "}
            {hypothesis.independentSupport === 1 ? "source" : "sources"} for,{" "}
            {hypothesis.contradicting.length} against
          </p>
          <p className="mt-[0.6vh] text-[0.95vw] leading-snug text-muted">
            Abandoned if: {hypothesis.falsifier}
          </p>
        </li>
      ))}
    </ul>
  );
}

function Empty({ what }: { what: string }) {
  return (
    <div className="flex h-full items-center">
      <p className="text-[1.4vw] text-muted">No {what} in this case yet.</p>
    </div>
  );
}
