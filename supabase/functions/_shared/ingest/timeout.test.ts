import { describe, expect, it, vi } from "vitest";
import { DEFAULT_READ_TIMEOUT_MS, TIMED_OUT, inSeconds, withinTime } from "./timeout.ts";

describe("giving up on a reader that never comes back", () => {
  it("returns the value when the work finishes in time", async () => {
    expect(await withinTime(Promise.resolve("read"), 1000)).toBe("read");
  });

  // The failure this exists for. A promise that never settles is not an
  // exception, so no try/catch anywhere would have caught it.
  it("reports running out of time on work that never settles", async () => {
    const never = new Promise<string>(() => undefined);
    expect(await withinTime(never, 5)).toBe(TIMED_OUT);
  });

  it("lets a rejection through as a rejection", async () => {
    await expect(withinTime(Promise.reject(new Error("torn file")), 1000))
      .rejects.toThrow("torn file");
  });

  // A pending timer keeps a Node process alive after the work is done, which
  // turns a passing suite into one that hangs for thirty seconds at the end.
  it("clears its timer when the work wins the race", async () => {
    const clear = vi.spyOn(globalThis, "clearTimeout");
    await withinTime(Promise.resolve(1), 10_000);
    expect(clear).toHaveBeenCalled();
    clear.mockRestore();
  });

  it("defaults to a limit long enough for a real document", () => {
    expect(DEFAULT_READ_TIMEOUT_MS).toBeGreaterThanOrEqual(20_000);
  });

  it("says how long it waited, and inflects", () => {
    expect(inSeconds(30_000)).toBe("30 seconds");
    expect(inSeconds(1_000)).toBe("1 second");
  });
});
