// Broadcast mode: what a case looks like on a screen somebody is pointing a
// camera at.
//
// Section 25. The specification asks for 1920x1080, enlarged media, reduced
// navigation, source identifiers, evidence numbers, timestamps and
// broadcast-safe layouts.
//
// **There is no media.** Sections 7 and 8 — video, audio, transcription —
// are not built, so a broadcast mode built around "enlarge the central media"
// would be a frame around an absence. What this presents instead is the
// reasoning: the claims and what they rest on, the contradictions, the
// competing explanations. That is the more interesting half to televise
// anyway, and it is the half that exists.
//
// The module is small on purpose. Formatting a reference number and computing
// a title-safe box are the two things that must be right and are easy to get
// wrong by eye.

/**
 * A reference as it is read aloud: SOURCE 014, E-031.
 *
 * Padded to three digits, which is a decision about how it looks on a screen
 * rather than about how many sources a case has. "SOURCE 7" and "SOURCE 014"
 * in the same lower third jump the eye; a fixed width does not, and a case
 * with more than 999 sources may have four digits and a slightly wider box.
 */
export function sourceLabel(reference: number | null | undefined): string {
  return reference == null ? "SOURCE ---" : `SOURCE ${String(reference).padStart(3, "0")}`;
}

export function evidenceLabel(reference: number | null | undefined): string {
  return reference == null ? "E---" : `E-${String(reference).padStart(3, "0")}`;
}

/**
 * A timestamp in the form the overlays use: 01:42:17.
 *
 * Hours are always shown, unlike a media player's, because a lower third that
 * sometimes reads 42:17 and sometimes 01:42:17 changes width mid-programme.
 */
export function broadcastTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--:--";
  const whole = Math.floor(seconds);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(whole / 3600))}:${pad(Math.floor((whole % 3600) / 60))}:${pad(whole % 60)}`;
}

/**
 * The title-safe box, as a percentage inset.
 *
 * 5% action-safe and 10% title-safe are the broadcast conventions, and the
 * reason they exist is that a television overcans the picture: the outer edge
 * of the frame is not on the viewer's screen at all. Text laid out to the edge
 * of a 1920x1080 canvas is text with its ends cut off in the room.
 */
export const TITLE_SAFE_PERCENT = 10;
export const ACTION_SAFE_PERCENT = 5;

export interface SafeArea {
  /** CSS inset, in percent. */
  inset: number;
  width: number;
  height: number;
}

export function titleSafeArea(width = 1920, height = 1080): SafeArea {
  const inset = TITLE_SAFE_PERCENT;
  return {
    inset,
    width: Math.round(width * (1 - (inset * 2) / 100)),
    height: Math.round(height * (1 - (inset * 2) / 100)),
  };
}

/** The panels a broadcast can show, in the order the specification lists them. */
export const BROADCAST_PANELS = [
  { id: "claims", name: "Claims", key: "1" },
  { id: "sources", name: "Sources", key: "2" },
  { id: "timeline", name: "Timeline", key: "3" },
  { id: "explanations", name: "Explanations", key: "4" },
] as const;

export type BroadcastPanel = (typeof BROADCAST_PANELS)[number]["id"];

/** Which panel a keypress selects, or null. */
export function panelForKey(key: string): BroadcastPanel | null {
  return BROADCAST_PANELS.find((panel) => panel.key === key)?.id ?? null;
}

/**
 * What the lower third says about a claim.
 *
 * The epistemic status is on screen with the claim, always, and that is the
 * one rule this module has. A claim shown in a lower third with no
 * classification beside it is being broadcast as a fact, whatever the presenter
 * says over it — and the viewer keeps the caption, not the qualification.
 */
export function lowerThird(claim: { statement: string; status: string }): {
  statement: string;
  status: string;
} {
  return { statement: claim.statement, status: claim.status.replace(/_/g, " ").toUpperCase() };
}
