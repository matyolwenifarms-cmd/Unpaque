import { EPISTEMIC_MEANINGS, type EpistemicStatus } from "@shared/detective/epistemic.ts";
import { cn } from "@/lib/utils.ts";

// §4's classifications, rendered so the reader can tell them apart at a glance
// without any of them looking like a verdict.
//
// Only `contradicted` gets destructive colouring. `contested` and `disputed`
// are states of the evidence rather than faults, and `unknown` is explicitly a
// legitimate answer — colouring those red would turn the epistemic model into
// a list of problems, which is the opposite of what it is for.
const TONE: Record<EpistemicStatus, string> = {
  fact: "bg-accent/15 text-accent",
  corroborated: "bg-accent/15 text-accent",
  partially_corroborated: "bg-accent/10 text-accent",
  inference: "bg-paper text-muted",
  claim: "bg-paper text-muted",
  unverified: "bg-paper text-muted",
  unresolved: "bg-paper text-muted",
  unknown: "bg-paper text-muted",
  contested: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  disputed: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  contradicted: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export function EpistemicBadge({ status }: { status: EpistemicStatus }) {
  const meaning = EPISTEMIC_MEANINGS[status];
  return (
    <span
      // The required behaviour is the tooltip, not the meaning. What a reader
      // needs at a glance is what the system must do about this state, which is
      // the half people get wrong.
      title={`${meaning.meaning} ${meaning.required}`}
      className={cn("rounded px-1.5 py-0.5 text-xs font-medium", TONE[status])}
    >
      {meaning.label}
    </span>
  );
}
