// Giving up on a reader that never comes back.
//
// A try/catch is not enough, and the failure that proved it is worth writing
// down. A PDF reader configured to fetch a worker that is not there does not
// throw: it returns a promise that never settles. The batch awaiting it showed
// "reading them" until the person closed the tab, and nothing anywhere — no
// console error, no rejected promise, no stack — said why.
//
// So every reader that can hang is raced against a clock, and running out of
// time is a reported outcome rather than an exception. The caller writes a
// sentence about that one file and carries on with the rest.

/** Returned instead of a value when the work ran out of time. */
export const TIMED_OUT = Symbol("timed out");

export const DEFAULT_READ_TIMEOUT_MS = 30_000;

export async function withinTime<T>(
  work: Promise<T>,
  ms: number = DEFAULT_READ_TIMEOUT_MS,
): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), ms);
      }),
    ]);
  } finally {
    // Cleared whichever way the race went. A pending timer keeps a Node
    // process alive after the work is done, which turns a passing test suite
    // into one that hangs at the end for thirty seconds.
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** How long it waited, as a phrase for the sentence a reader is shown. */
export function inSeconds(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${seconds} second${seconds === 1 ? "" : "s"}`;
}
