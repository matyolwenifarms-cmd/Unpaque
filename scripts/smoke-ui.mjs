#!/usr/bin/env node
// Drives the production build in a real browser and asserts the console is
// clean on every route.
//
// Component tests cannot tell you any of this. They render a component in
// isolation with mocked hooks; they cannot say whether the route is
// registered, whether the lazy chunk resolves, or whether the built bundle
// boots at all. Those are exactly the failures that reach a user first.
//
// Against a build with no Supabase configured, every screen shows its empty
// state — which is the point: an empty state that throws is still broken.
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { chromium } from "playwright";

/**
 * Find the pre-installed Chromium rather than hard-coding a path.
 *
 * The directory is version-pinned (chromium-1194), so a hard-coded path breaks
 * silently the first time the image updates the browser — and it breaks with
 * "executable doesn't exist", which reads like a missing install rather than a
 * stale path. Playwright's own resolution is tried first and this only steps in
 * when its expected revision does not match what the image shipped.
 */
function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  if (!existsSync(root)) return undefined;
  const candidates = readdirSync(root)
    .filter((entry) => entry.startsWith("chromium"))
    .sort()
    .reverse()
    .flatMap((entry) => [
      `${root}/${entry}/chrome-linux/chrome`,
      `${root}/${entry}/chrome-linux/headless_shell`,
    ]);
  return candidates.find((path) => existsSync(path));
}

// A fresh port each run. A fixed one collides with a preview left behind by a
// crashed run, and the resulting "port in use" reads as a broken script rather
// than a stale process. Killing leftovers by name is the obvious alternative
// and is worse: a pattern broad enough to match the preview also matches the
// shell that is running this.
const PORT = 4100 + Math.floor(Math.random() * 800);
const BASE = `http://127.0.0.1:${PORT}`;
const ROUTES = ["/", "/unpack", "/research", "/cases", "/sign-in"];

// The tab a reader clicks and the heading they land on must be the same word.
// Each name is written twice — in `src/lib/features.ts` and in the page's own
// `<h1>` — so renaming a feature is two edits, and the second is the one that
// gets forgotten. Nothing else catches it: a component test renders the page
// or the shell, never both, so a mismatch is only visible in a browser with
// the real route mounted.
//
// Only the three feature routes; /sign-in is not a tab and the landing page
// titles itself with the wordmark.
const TABBED_ROUTES = new Set(["/unpack", "/research", "/cases"]);

// A hard ceiling on the whole run. A browser that hangs is worse than one that
// fails: in CI it burns the job's entire time budget and reports nothing.
const watchdog = setTimeout(() => {
  console.error("\nTimed out after 90s.");
  process.exit(1);
}, 90_000);
watchdog.unref();

// IPv6 is unavailable in this container and the default bind fails with
// EAFNOSUPPORT, so the host is given explicitly.
const preview = spawn(
  "npx",
  ["vite", "preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"],
  { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] },
);

const ready = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("vite preview did not start in 30s")), 30_000);
  preview.stdout.on("data", (chunk) => {
    if (String(chunk).includes(String(PORT))) {
      clearTimeout(timer);
      resolve();
    }
  });
  preview.on("exit", (code) => reject(new Error(`vite preview exited with ${code}`)));
});

let failures = 0;
try {
  await ready;
  // --no-sandbox because this runs as root in a container, where Chromium's
  // sandbox cannot initialise and the process hangs rather than erroring.
  // --disable-dev-shm-usage because /dev/shm is small here and Chromium dies
  // partway through a page load when it fills.
  const launchArgs = { args: ["--no-sandbox", "--disable-dev-shm-usage"] };
  let browser;
  try {
    browser = await chromium.launch(launchArgs);
  } catch {
    const executablePath = findChromium();
    if (!executablePath) throw new Error("no Chromium found under PLAYWRIGHT_BROWSERS_PATH");
    console.log(`  (using ${executablePath})`);
    browser = await chromium.launch({ ...launchArgs, executablePath });
  }
  const context = await browser.newContext();

  for (const route of ROUTES) {
    const page = await context.newPage();
    const problems = [];
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        problems.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));

    const response = await page.goto(`${BASE}${route}`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForLoadState("domcontentloaded");
    const status = response?.status() ?? 0;

    // Short timeouts throughout. A missing element should fail this check in
    // two seconds, not hang until the watchdog kills the run — an earlier
    // version waited ninety seconds to report one absent heading.
    //
    // The wordmark is no longer in the shell; it lives on the landing plate.
    // What every inner route must have instead is a way back, since nothing
    // else in the header leads anywhere.
    const home = route === "/"
      ? "n/a"
      : await page.getByRole("link", { name: "Home" }).first()
          .textContent({ timeout: 2_000 }).catch(() => null);
    // Exactly one h1 per page. The shell's wordmark is a link home rather than
    // a heading, so each page must title itself — a route with none is an
    // accessibility defect, and a route with two is an outline nobody can
    // navigate.
    const headings = await page.locator("h1").allTextContents().catch(() => []);
    const body = (await page.locator("body").innerText().catch(() => "")).trim();

    // exact: true is load-bearing. Substring matching would let "Research"
    // match a tab still reading "The Researcher" — which is precisely the
    // drift this exists to catch.
    const tab = TABBED_ROUTES.has(route) && headings.length === 1
      ? await page.locator("header nav").getByRole("link", { name: headings[0], exact: true })
          .first().textContent({ timeout: 2_000 }).catch(() => null)
      : "n/a";

    let verdict = "ok";
    if (status !== 200) { verdict = `HTTP ${status}`; failures += 1; }
    else if (home === null) { verdict = "no way back to the landing page"; failures += 1; }
    else if (headings.length !== 1) {
      verdict = `expected one h1, found ${headings.length}${headings.length ? `: ${headings.join(" / ")}` : ""}`;
      failures += 1;
    } else if (tab === null) {
      verdict = `no tab named "${headings[0]}" — the nav and the heading disagree`;
      failures += 1;
    } else if (body.length < 40) { verdict = "page rendered almost nothing"; failures += 1; }
    else if (problems.length > 0) { verdict = "console not clean"; failures += 1; }

    console.log(`  ${route.padEnd(12)} ${verdict}`);
    for (const problem of problems) console.log(`      ${problem}`);
    await page.close();
  }

  // A route that does not exist must not blank the page. React Router renders
  // nothing for an unmatched path by default, which looks identical to a crash.
  const page = await context.newPage();
  await page.goto(`${BASE}/not-a-real-route`, { waitUntil: "load", timeout: 20_000 });
  // An unmatched path renders the shell with no route inside it. The shell is
  // what must survive — React Router renders nothing for an unknown path by
  // default, and a blank page is indistinguishable from a crash.
  const stillThere = (await page.locator("header").first()
    .textContent({ timeout: 2_000 }).catch(() => null)) !== null;
  console.log(`  /not-a-real-route  ${stillThere ? "shell survives" : "SHELL LOST"}`);
  if (!stillThere) failures += 1;
  await page.close();

  await browser.close();
} finally {
  clearTimeout(watchdog);
  preview.kill("SIGTERM");
}

if (failures > 0) {
  console.error(`\n${failures} route check(s) failed.`);
} else {
  console.log("\nAll routes boot, render and log nothing.");
}

// Explicit exit, not process.exitCode. The preview child's stdio pipes keep the
// event loop alive after SIGTERM, so setting a code and falling off the end
// leaves the script hanging — which in CI is a green check that never finishes,
// the least useful possible outcome.
process.exit(failures > 0 ? 1 : 0);
