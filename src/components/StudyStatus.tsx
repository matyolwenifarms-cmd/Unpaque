import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { loadSnapshot } from "@/lib/status-api.ts";
import { readStatus, type Status, type StudySnapshot } from "@shared/research/status/status.ts";
import { stageName, type ResearchStage } from "@shared/research/status/stages.ts";
import { cn } from "@/lib/utils.ts";

/**
 * What this study holds, instead of a row of tabs to choose between.
 *
 * Eight tabs is eight questions somebody who has not used this before cannot
 * answer. The same eight things described as facts about their own work is
 * reading, and each line is a way into the stage that owns it — so the
 * navigation is the status, and there is nothing to learn before using it.
 *
 * **The tabs do not go away.** They move below this and stay complete, because
 * a stage that is never mentioned must not become a stage somebody believes
 * does not exist. This panel is the short path for a person who does not know
 * the product; the full list is the path for a person who does.
 *
 * Nothing is said about a stage this study does not use. Most research never
 * screens, never runs a t-test and never holds a corpus, and a panel listing
 * everything undone is a to-do list the researcher did not write.
 */
export function StudyStatus({
  studyId,
  onStage,
  reloadKey,
}: {
  studyId: string | null;
  onStage: (stage: ResearchStage) => void;
  /** Changes when a stage has done something, so the panel re-counts. */
  reloadKey?: unknown;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [snapshot, setSnapshot] = useState<StudySnapshot | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (studyId === null) {
      setStatus(null);
      setSnapshot(null);
      return;
    }
    let live = true;
    setStatus(null);
    setProblem(null);
    void loadSnapshot(studyId).then((result) => {
      if (!live) return;
      if (result.ok) {
        setSnapshot(result.data);
        setStatus(readStatus(result.data));
      } else {
        setProblem(result.message);
      }
    });
    return () => {
      live = false;
    };
  }, [studyId, reloadKey]);

  // No study open, which is what a first visit looks like. Returning nothing
  // here left that visitor facing eight tabs and no way to tell which one was
  // theirs -- the exact thing this panel exists to replace. So they get the
  // one line that is true with no study and no account: the proposal stage
  // reads a file in the browser and needs neither.
  if (studyId === null) {
    return (
      <section
        aria-labelledby="what-you-have"
        className="mb-8 rounded-lg border border-rule bg-raised p-5"
      >
        <h2 id="what-you-have" className="text-xs font-semibold uppercase tracking-widest text-muted">
          No study open
        </h2>
        <p className="mt-2 text-sm">
          A study is where papers, codings and analyses are kept together. You do not need one to
          start: hand over a proposal and it will read the references and the design out of it,
          here in your browser.
        </p>
        <button
          type="button"
          onClick={() => onStage("proposal")}
          className="mt-3 flex w-full items-center gap-2 rounded-md border border-rule px-3 py-2 text-left text-sm hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <span className="flex-1">Read a proposal</span>
          <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-accent" />
        </button>
      </section>
    );
  }

  if (problem !== null) {
    // Said quietly and once. Every stage is still reachable from the list
    // below, so a panel that could not count is an absence rather than a
    // failure worth alarming somebody about.
    return (
      <p className="mb-6 text-sm text-muted">
        This study could not be counted just now, so there is nothing to summarise. The stages
        below all still work.
      </p>
    );
  }

  if (status === null) {
    return (
      <p className="mb-6 flex items-center gap-2 text-sm text-muted">
        <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
        Looking at what this study holds…
      </p>
    );
  }

  const empty = status.holds.length === 0;

  return (
    <section
      aria-labelledby="what-you-have"
      className="mb-8 rounded-lg border border-rule bg-raised p-5"
    >
      <h2 id="what-you-have" className="text-xs font-semibold uppercase tracking-widest text-muted">
        {empty ? "Nothing in this study yet" : "What this study holds"}
      </h2>

      {!empty && (
        <ul className="mt-3 space-y-1">
          {status.holds.map((line) => (
            <li key={line.says}>
              <button
                type="button"
                onClick={() => onStage(line.stage)}
                className={cn(
                  "group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                  "hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                    line.tone === "attention" ? "bg-accent" : "bg-rule",
                  )}
                />
                <span className="flex-1">{line.says}</span>
                <span className="shrink-0 text-xs text-muted group-hover:text-accent">
                  {stageName(line.stage)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {status.next !== null && (
        <button
          type="button"
          onClick={() => onStage(status.next!.stage)}
          className={cn(
            "mt-3 flex w-full items-center gap-2 rounded-md border border-rule px-3 py-2 text-left text-sm",
            "hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
          )}
        >
          <span className="flex-1">{status.next.says}</span>
          <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-accent" />
        </button>
      )}

      {/* Said once, where somebody wondering why a stage is missing will look
          for it. Without this the panel reads as the whole product. */}
      {snapshot !== null && (
        <p className="mt-3 text-xs text-muted">
          Only what this study has is listed. Every stage is available below, whether or not it
          appears here.
        </p>
      )}
    </section>
  );
}
