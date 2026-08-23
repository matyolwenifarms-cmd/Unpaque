import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { chromium } from "playwright";
function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  if (!existsSync(root)) return undefined;
  return readdirSync(root).filter((e) => e.startsWith("chromium")).sort().reverse()
    .flatMap((e) => [`${root}/${e}/chrome-linux/chrome`, `${root}/${e}/chrome-linux/headless_shell`])
    .find((p) => existsSync(p));
}
const PORT = 4800 + Math.floor(Math.random() * 200);
const preview = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"],
  { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error("preview did not start")), 30000);
  preview.stdout.on("data", (c) => { if (String(c).includes(String(PORT))) { clearTimeout(t); res(); } });
});
let browser;
try { browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }); }
catch { browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"], executablePath: findChromium() }); }
const page = await browser.newPage();
const problems = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`); });
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("requestfailed", (r) => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));

await page.goto(`http://127.0.0.1:${PORT}/research`, { waitUntil: "load" });
await page.locator('input[type="file"]').setInputFiles("/tmp/paper.pdf");
console.log("uploaded a PDF; waiting up to 25s for the report...");
try {
  await page.getByRole("heading", { name: "What it read" }).waitFor({ timeout: 25000 });
  console.log("RESULT: the PDF was read.");
  console.log(await page.locator("section").filter({ hasText: "What it read" }).first().innerText());
} catch {
  console.log("RESULT: HUNG — no report after 25s.");
  const body = await page.locator("body").innerText();
  console.log("on screen:", body.slice(0, 400).replace(/\n+/g, " | "));
}
console.log("\nconsole/network problems:", problems.length === 0 ? "none" : problems.slice(0, 6));
await browser.close(); preview.kill();
