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
const ROUTES = ["/", "/research", "/sign-in"];

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
    const heading = await page.locator("h1").first().innerText().catch(() => "(none)");
    const body = (await page.locator("body").innerText().catch(() => "")).trim();

    let verdict = "ok";
    if (status !== 200) { verdict = `HTTP ${status}`; failures += 1; }
    else if (!heading.includes("Unpaque")) { verdict = `no wordmark, saw "${heading}"`; failures += 1; }
    else if (body.length < 40) { verdict = "page rendered almost nothing"; failures += 1; }
    else if (problems.length > 0) { verdict = `console not clean`; failures += 1; }

    console.log(`  ${route.padEnd(12)} ${verdict}`);
    for (const problem of problems) console.log(`      ${problem}`);
    await page.close();
  }

  // A route that does not exist must not blank the page. React Router renders
  // nothing for an unmatched path by default, which looks identical to a crash.
  const page = await context.newPage();
  await page.goto(`${BASE}/not-a-real-route`, { waitUntil: "load", timeout: 20_000 });
  const stillThere = (await page.locator("h1").first().innerText().catch(() => "")).includes("Unpaque");
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
