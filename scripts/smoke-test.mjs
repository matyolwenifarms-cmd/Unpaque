#!/usr/bin/env node
// Sends one real analysis through the deployed (or locally served) function and
// checks that what comes back is structurally sound.
//
// This is the check that the unit suite cannot make. Everything in `npm test`
// runs against an injected fake model, which proves the contract, the guard and
// the retry, and proves nothing at all about whether this deploys and whether a
// real model honours the schema.
//
// Node rather than bash+jq: it runs identically in Git Bash, PowerShell and a
// Linux shell, and needs nothing installed that the project does not already
// need.
import { readFileSync } from "node:fs";

const FRAMEWORKS = [
  "speech_act", "image_repair", "framing", "strategic_ambiguity",
  "attribution", "critical_discourse", "face", "informal_logic",
];

// A corporate non-apology, chosen because it is the shape most likely to
// provoke exactly the output the guard exists to refuse. A model that wants to
// say "this is evasive and insincere" will want to say it here.
const TEXT =
  "Following a review of resourcing, the decision has been taken that the " +
  "project cannot proceed on the original timeline. We regret that this has " +
  "caused frustration for some stakeholders, and we remain committed to " +
  "delivering value in due course. Further updates will follow as appropriate.";

function loadEnv() {
  let raw;
  try {
    raw = readFileSync(".env", "utf8");
  } catch {
    fail("No .env file. Copy .env.example (deployed) or .env.local.example (local stack).");
  }
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

function fail(message, detail) {
  console.error(`\n  FAIL: ${message}`);
  if (detail !== undefined) console.error(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
  // exitCode + throw, never process.exit(): forcing exit while a fetch handle
  // is mid-close trips a libuv assertion on Windows, and the abort message can
  // swallow the diagnostic printed immediately above it.
  process.exitCode = 1;
  throw new SmokeFailure(message);
}

class SmokeFailure extends Error {}

process.on("uncaughtException", (error) => {
  if (!(error instanceof SmokeFailure)) throw error;
  process.exitCode = 1;
});

function ok(message) {
  console.log(`  ok: ${message}`);
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) fail("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must both be set in .env");

const endpoint = `${url.replace(/\/$/, "")}/functions/v1/analyse`;
console.log(`==> POST ${endpoint}`);
console.log("    (a real model call — this takes 10-40 seconds)\n");

const started = Date.now();
let response, body;
try {
  response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      apikey: key,
    },
    body: JSON.stringify({ text: TEXT, mode: "decode" }),
  });
  body = await response.json();
} catch (error) {
  fail(`could not reach the function: ${error.message}`);
}

if (!response.ok) {
  fail(`HTTP ${response.status}`, body);
}
console.log(`==> HTTP 200 in ${((Date.now() - started) / 1000).toFixed(1)}s. Checking the report is a report.\n`);

const report = body.report;
if (!report) fail("no report in the response", body);

if (report.sections?.length !== 4) fail(`expected four sections, got ${report.sections?.length}`, report);
ok("four sections");

const expected = ["act", "responsibility", "framing", "ambiguity"];
const got = report.sections.map((s) => s.id);
if (expected.some((id, i) => got[i] !== id)) fail(`sections out of order: ${got.join(", ")}`);
ok("in render order");

const findings = report.sections.flatMap((s) => s.findings ?? []);
if (findings.length === 0) fail("no findings at all — suspicious for this text");
ok(`${findings.length} findings`);

// The load-bearing assertion. The whole design rests on this being true of a
// real model, not just of the fake in the unit tests.
const unattributed = findings.filter((f) => !FRAMEWORKS.includes(f.framework));
if (unattributed.length > 0) fail("a finding cited an unknown framework", unattributed);
ok("every finding is theory-attributed");

const quoted = findings.filter((f) => (f.quotes ?? []).length > 0);
ok(`${quoted.length} of ${findings.length} findings carry a verbatim quote`);

// Quotes must actually appear in the source. A model that paraphrases into a
// quote breaks the promise that a quote is evidence the reader can check, which
// is the same promise The Researcher's passage engine makes about full text.
//
// Normalised before comparing, then failed hard rather than warned about. The
// normalisation kills the false positives — a model that turns a straight
// apostrophe into a typographic one, or collapses a line break into a space,
// has not paraphrased anything. What survives normalisation is a real
// invention, and warning about those would make this check decorative.
const normalise = (s) =>
  s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
   .replace(/[\u2013\u2014]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();
const haystack = normalise(TEXT);
const invented = quoted.flatMap((f) => (f.quotes ?? []).filter((q) => !haystack.includes(normalise(q))));
if (invented.length > 0) {
  fail(
    `${invented.length} quote(s) are not verbatim spans of the source — the model paraphrased into a quotation`,
    invented,
  );
}
if (quoted.length > 0) ok("every quote is a verbatim span of the source");

if (body.repaired) {
  console.log("\n  note: the guard fired and the model repaired on retry.");
  console.log("        Worth reading the report closely — the prompt may need tightening.");
}

console.log(`
==> The text under test is a non-apology. A good report attributes
    responsibility to circumstance rather than to any actor, and never
    calls it insincere. Read it and judge:
`);
for (const section of report.sections) {
  console.log(`── ${section.id}`);
  console.log(`   ${section.summary}`);
  for (const finding of section.findings ?? []) {
    console.log(`   • [${finding.framework}] ${finding.claim}`);
    for (const quote of finding.quotes ?? []) console.log(`       "${quote}"`);
  }
  console.log("");
}
