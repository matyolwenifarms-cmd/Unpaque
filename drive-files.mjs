import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { chromium } from "playwright";
function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  return existsSync(root) ? readdirSync(root).filter((e) => e.startsWith("chromium")).sort().reverse()
    .flatMap((e) => [`${root}/${e}/chrome-linux/chrome`, `${root}/${e}/chrome-linux/headless_shell`])
    .find((p) => existsSync(p)) : undefined;
}
const PORT = 4950 + Math.floor(Math.random() * 40);
const preview = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"],
  { stdio: ["ignore", "pipe", "pipe"] });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error("no preview")), 40000);
  preview.stdout.on("data", (c) => { if (String(c).includes(String(PORT))) { clearTimeout(t); res(); } });
});
let browser;
try { browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }); }
catch { browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"], executablePath: findChromium() }); }

// 1. The proposal stage, with a real PDF.
{
  const page = await browser.newPage();
  const problems = [];
  page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  page.on("requestfailed", (r) => problems.push("requestfailed: " + r.url().split("/").pop()));
  await page.goto(`http://127.0.0.1:${PORT}/research`, { waitUntil: "load" });
  await page.locator('input[type="file"]').setInputFiles("/tmp/paper.pdf");
  let outcome;
  try {
    await page.getByRole("heading", { name: "What it read" }).waitFor({ timeout: 20000 });
    outcome = "READ OK";
  } catch {
    outcome = "HUNG/failed — " + (await page.locator("body").innerText()).replace(/\n+/g, " | ").slice(0, 200);
  }
  console.log(`PROPOSAL + real PDF  → ${outcome}`);
  if (outcome === "READ OK") {
    console.log("   " + (await page.locator("section").filter({ hasText: "What it read" }).first().innerText()).replace(/\n+/g, " | ").slice(0, 220));
  }
  console.log("   problems:", problems.length ? problems.slice(0, 3) : "none");
  await page.close();
}

// 2. The Detect portal, with a PDF and a Word file together.
{
  const page = await browser.newPage();
  const problems = [];
  page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  await page.goto(`http://127.0.0.1:${PORT}/cases`, { waitUntil: "load" });
  const input = page.locator('input[type="file"]').first();
  let outcome = "no portal on /cases (needs a case open)";
  if (await input.count() > 0) {
    await input.setInputFiles(["/tmp/paper.pdf", "/tmp/paper.docx"]);
    try {
      await page.getByText(/Import \d+ files?/).waitFor({ timeout: 20000 });
      outcome = "READ OK — " + (await page.locator("body").innerText()).match(/\d+ files? read[^.]*\./)?.[0];
    } catch {
      outcome = "HUNG/failed";
    }
  }
  console.log(`DETECT portal, PDF + Word together → ${outcome}`);
  console.log("   problems:", problems.length ? problems.slice(0, 3) : "none");
  await page.close();
}
await browser.close(); preview.kill();
