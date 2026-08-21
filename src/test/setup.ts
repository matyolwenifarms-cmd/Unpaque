import { afterEach } from "vitest";

// Two things happen here, and only where there is a DOM. The pure-logic suites
// run under node — importing jest-dom there fails at load time, which takes the
// whole run down rather than one test.
//
// The cleanup registration is the non-obvious half. @testing-library/react
// auto-registers its `afterEach(cleanup)` only when vitest runs with
// `globals: true`. This config deliberately does not, so without the explicit
// registration below every render leaks into the next test: the first test
// passes, the second finds two of everything, and the error it produces
// ("found multiple elements") points at the assertion rather than at the cause.
if (typeof document !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
  const { cleanup } = await import("@testing-library/react");
  afterEach(cleanup);
}
