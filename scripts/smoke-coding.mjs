#!/usr/bin/env node
// Drives the qualitative coding surface in a real browser, with a real mouse.
//
// This exists because the one thing that surface depends on cannot be tested
// under jsdom: a coding is stored as an offset into the transcript, and the
// offset is derived from where a pointer was dragged. jsdom has no layout, so
// a component test can only hand the component a Range it constructed itself —
// which proves the arithmetic and not the interaction.
//
// The load-bearing case is the second drag. Once a coding exists, the surface
// prints a superscript code label after the highlight, and that text is not in
// the transcript. If the offset walk counts it, every coding made below the
// first lands displaced by the length of the labels above it — a bug that
// looks like an off-by-one and is an off-by-fourteen.
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { chromium } from "playwright";

function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  if (!existsSync(root)) return undefined;
  return readdirSync(root)
    .filter((entry) => entry.startsWith("chromium"))
    .sort()
    .reverse()
    .flatMap((entry) => [
      `${root}/${entry}/chrome-linux/chrome`,
      `${root}/${entry}/chrome-linux/headless_shell`,
    ])
    .find((path) => existsSync(path));
}

const PORT = 4900 + Math.floor(Math.random() * 800);
const BASE = `http://127.0.0.1:${PORT}`;
const TRANSCRIPT =
  "The cost was the first thing everyone mentioned. Nobody trusted the process, " +
  "and the waiting was worse than the money in the end.";

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
  { stdio: ["ignore", "pipe", "pipe"] },
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

const problems = [];
let browser;
try {
  await ready;
  const launchArgs = { args: ["--no-sandbox", "--disable-dev-shm-usage"] };
  try {
    browser = await chromium.launch(launchArgs);
  } catch {
    const executablePath = findChromium();
    if (!executablePath) throw new Error("no Chromium found under PLAYWRIGHT_BROWSERS_PATH");
    browser = await chromium.launch({ ...launchArgs, executablePath });
  }
  const page = await browser.newPage();
  // Tall enough that the second extract is inside the viewport. `mouse.move`
  // takes viewport coordinates and clamps silently, so a short viewport drags
  // somewhere else and reports a selection that is merely wrong.
  await page.setViewportSize({ width: 1400, height: 1200 });
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));

  await page.goto(`${BASE}/research`, { waitUntil: "load", timeout: 30_000 });
  await page.getByRole("button", { name: /Code text/ }).click();
  await page.getByRole("button", { name: "Paste one" }).click();
  await page.getByLabel("Name it (optional)").fill("P1");
  await page.getByLabel("The transcript").fill(TRANSCRIPT);
  await page.getByRole("button", { name: "Add transcript" }).click();

  for (const [label, notWhen] of [
    ["cost", "Not a passing mention with no elaboration."],
    ["trust", "Not trust in a particular person."],
  ]) {
    await page.getByRole("button", { name: "New code" }).click();
    await page.getByLabel("Name").fill(label);
    await page.getByLabel("Definition").fill(`Where a participant speaks about ${label}.`);
    await page.getByLabel("Apply when").fill(`Any passage about ${label}.`);
    await page.getByLabel("Not when").fill(notWhen);
    await page.getByRole("button", { name: "Add code" }).click();
  }

  /** Drag across a phrase where it is rendered, the way a pointer does. */
  async function drag(phrase) {
    const box = await page.evaluate((wanted) => {
      const paragraph = document.querySelector("p.font-serif");
      const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const at = node.textContent.indexOf(wanted);
        // Found by class, deliberately not by the `data-not-source` attribute
        // this is here to check. Keying the check to the thing under test is
        // how a check stops being able to fail.
        if (at >= 0 && !node.parentElement.closest(".align-super")) {
          const range = document.createRange();
          range.setStart(node, at);
          range.setEnd(node, at + wanted.length);
          const { x, y, width, height } = range.getBoundingClientRect();
          return { x, y, width, height };
        }
        node = walker.nextNode();
      }
      return null;
    }, phrase);
    if (!box) {
      problems.push(`"${phrase}" is not rendered as transcript text`);
      return;
    }
    await page.mouse.move(box.x + 1, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
  }

  async function code(phrase, label) {
    await drag(phrase);
    const shown = (await page.locator("blockquote").textContent())?.trim() ?? "";
    if (shown !== phrase) problems.push(`dragging "${phrase}" offered "${shown}"`);
    await page.getByRole("button", { name: label, exact: true }).click();
  }

  await code("cost", "cost");
  await code("waiting", "trust");

  const marks = await page.locator("mark").allTextContents();
  if (marks.join("|") !== "cost|waiting") {
    problems.push(`highlights sit on ${JSON.stringify(marks)}, expected cost then waiting`);
  }
  console.log(`  coded and highlighted ${JSON.stringify(marks)}`);

  await page.getByRole("button", { name: /^Themes/ }).click();
  await page.getByLabel("Name").fill("What it costs you");
  await page.getByRole("button", { name: "cost", exact: true }).click();
  await page.getByRole("button", { name: "Assemble", exact: true }).click();
  const theme = ((await page.locator("article").first().textContent()) ?? "").replace(/\s+/g, " ");
  if (!theme.includes("comes from one document")) {
    problems.push("a theme drawn from one transcript did not say so");
  }
  console.log("  theme assembled, reach reported");

  await page.getByRole("button", { name: /^Saturation/ }).click();
  const account = ((await page.locator("p.font-serif").first().textContent()) ?? "").trim();
  if (/saturation was reached|saturation is reached/i.test(account)) {
    problems.push("it declared saturation reached");
  }
  // The sentence is written to be pasted into a methodology chapter. "1
  // document(s) were coded" shipped once and every fragment check passed it.
  if (/\(s\)/.test(account)) problems.push(`the account is not written out: ${account}`);
  console.log(`  saturation: ${account}`);
} finally {
  await browser?.close();
  preview.kill();
}

if (problems.length > 0) {
  console.error("\nProblems:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log("\nThe coding surface works end to end, with a real pointer.");
process.exit(0);
