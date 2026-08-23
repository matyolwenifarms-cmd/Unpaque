import { describe, expect, it } from "vitest";
import {
  ACTION_SAFE_PERCENT,
  broadcastTime,
  evidenceLabel,
  lowerThird,
  panelForKey,
  sourceLabel,
  titleSafeArea,
  TITLE_SAFE_PERCENT,
} from "./broadcast.ts";

describe("reference numbers, as they are read aloud", () => {
  it("pads to a fixed width so a lower third does not change size", () => {
    expect(sourceLabel(14)).toBe("SOURCE 014");
    expect(sourceLabel(7)).toBe("SOURCE 007");
    expect(sourceLabel(231)).toBe("SOURCE 231");
    expect(evidenceLabel(31)).toBe("E-031");
  });

  it("lets a case outgrow three digits rather than truncating", () => {
    expect(sourceLabel(1042)).toBe("SOURCE 1042");
  });

  // A record with no number is a record that predates the numbering, and
  // showing "SOURCE 0" would be a reference somebody could try to look up.
  it("shows an absent number as absent", () => {
    expect(sourceLabel(null)).toBe("SOURCE ---");
    expect(evidenceLabel(undefined)).toBe("E---");
  });
});

describe("timestamps", () => {
  // A lower third that sometimes reads 42:17 and sometimes 01:42:17 changes
  // width mid-programme.
  it("always shows hours", () => {
    expect(broadcastTime(6137)).toBe("01:42:17");
    expect(broadcastTime(0)).toBe("00:00:00");
    expect(broadcastTime(59)).toBe("00:00:59");
  });

  it("refuses to render nonsense as a time", () => {
    expect(broadcastTime(-1)).toBe("--:--:--");
    expect(broadcastTime(Number.NaN)).toBe("--:--:--");
  });
});

describe("the safe area", () => {
  // A television overcans the picture: the outer edge of the frame is not on
  // the viewer's screen at all.
  it("insets by the broadcast convention, not by eye", () => {
    expect(TITLE_SAFE_PERCENT).toBe(10);
    expect(ACTION_SAFE_PERCENT).toBe(5);
    const safe = titleSafeArea();
    expect(safe.width).toBe(1536);
    expect(safe.height).toBe(864);
  });

  it("scales to whatever canvas it is given", () => {
    expect(titleSafeArea(1280, 720).width).toBe(1024);
  });
});

describe("keyboard control", () => {
  it("maps a number to a panel", () => {
    expect(panelForKey("1")).toBe("claims");
    expect(panelForKey("4")).toBe("explanations");
  });

  it("ignores anything else", () => {
    expect(panelForKey("9")).toBeNull();
    expect(panelForKey("a")).toBeNull();
  });
});

// The one rule this module has.
describe("the lower third", () => {
  it("carries the epistemic status with the claim, always", () => {
    const third = lowerThird({ statement: "The van left before nine.", status: "partially_corroborated" });
    expect(third.statement).toBe("The van left before nine.");
    expect(third.status).toBe("PARTIALLY CORROBORATED");
  });

  it("has no shape that could carry a claim without one", () => {
    const third = lowerThird({ statement: "Anything.", status: "unknown" });
    expect(Object.keys(third).sort()).toEqual(["statement", "status"]);
    expect(third.status).toBe("UNKNOWN");
  });
});
