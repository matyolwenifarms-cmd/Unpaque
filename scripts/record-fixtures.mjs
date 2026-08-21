#!/usr/bin/env node
// Records real OpenAlex responses into the fixtures directory.
//
// The adapter was written behind a proxy that reaches npm and nothing else, so
// its fixtures are hand-written from the documented response shape. That is
// enough to exercise every branch and no evidence at all that the shape is
// right. This closes that gap: run it once on a machine with network access and
// the suite starts checking the adapter against what OpenAlex actually sends.
//
// OpenAlex needs no key and costs nothing. Be polite about it anyway — set
// OPENALEX_CONTACT to an email address and requests go to the faster pool.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../supabase/functions/_shared/research/fixtures/", import.meta.url));
const CONTACT = process.env.OPENALEX_CONTACT;

// Three queries, chosen to bring back the rows the adapter branches on. A
// single generic search would very likely contain no retracted work and no
// preprint, leaving exactly the paths that matter untested against real data.
const QUERIES = [
  { label: "search", params: { search: "framing theory political communication", "per-page": "10" } },
  { label: "retracted", params: { filter: "is_retracted:true", "per-page": "3" } },
  { label: "preprint", params: { filter: "type:preprint", "per-page": "3" } },
];

// Crossref's shape is entirely its own — arrays for titles, a nested tuple for
// the year, retraction expressed as a relationship rather than a flag. Every
// one of those is somewhere the adapter can be confidently wrong, so it gets
// recorded too. The `updated-by` filter goes and finds an actually retracted
// work, which a plain query would almost never return.
const CROSSREF_QUERIES = [
  { label: "search", params: { query: "framing theory political communication", rows: "10" } },
  { label: "retracted", params: { filter: "update-type:retraction", rows: "3" } },
  { label: "preprint", params: { filter: "type:posted-content", rows: "3" } },
];

async function fetchWorks({ params }) {
  const query = new URLSearchParams(params);
  if (CONTACT) query.set("mailto", CONTACT);
  const url = `https://api.openalex.org/works?${query}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return response.json();
}

console.log("==> Recording OpenAlex fixtures");
if (!CONTACT) {
  console.log("    (set OPENALEX_CONTACT=you@example.org for the faster pool)");
}

const merged = { meta: { count: 0, recorded_at: new Date().toISOString() }, results: [] };
const seen = new Set();

for (const query of QUERIES) {
  process.stdout.write(`    ${query.label} ... `);
  let body;
  try {
    body = await fetchWorks(query);
  } catch (error) {
    console.log("FAILED");
    console.error(`\n  Could not reach OpenAlex: ${error.message}`);
    console.error("  Nothing was written. The synthetic fixtures are untouched.\n");
    process.exitCode = 1;
    break;
  }
  const results = Array.isArray(body.results) ? body.results : [];
  console.log(`${results.length} works`);

  // Deduplicated: the searches overlap, and a fixture with the same work twice
  // would make a "no duplicate ids" invariant fail for a reason that is about
  // the recorder rather than the adapter.
  for (const work of results) {
    if (work?.id && seen.has(work.id)) continue;
    if (work?.id) seen.add(work.id);
    merged.results.push(work);
  }
  if (query.label === "search" && typeof body.meta?.count === "number") {
    merged.meta.count = body.meta.count;
  }
}

if (process.exitCode === 1) process.exit(1);

mkdirSync(OUT, { recursive: true });
const path = `${OUT}openalex-recorded.json`;
writeFileSync(path, `${JSON.stringify(merged, null, 2)}\n`);

console.log(`\n==> Wrote ${merged.results.length} works to`);
console.log(`    ${path}`);

// ---- Crossref -------------------------------------------------------------

async function fetchCrossref({ params }) {
  const query = new URLSearchParams(params);
  if (CONTACT) query.set("mailto", CONTACT);
  const url = `https://api.crossref.org/works?${query}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return response.json();
}

console.log("\n==> Recording Crossref fixtures");
const crossrefMerged = { status: "ok", "message-type": "work-list", message: { "total-results": 0, items: [] } };
const crossrefSeen = new Set();
let crossrefOk = true;

for (const query of CROSSREF_QUERIES) {
  process.stdout.write(`    ${query.label} ... `);
  let body;
  try {
    body = await fetchCrossref(query);
  } catch (error) {
    console.log("FAILED");
    console.error(`    ${error.message}`);
    crossrefOk = false;
    break;
  }
  const items = Array.isArray(body?.message?.items) ? body.message.items : [];
  console.log(`${items.length} works`);
  for (const item of items) {
    if (item?.DOI && crossrefSeen.has(item.DOI)) continue;
    if (item?.DOI) crossrefSeen.add(item.DOI);
    crossrefMerged.message.items.push(item);
  }
  if (query.label === "search" && typeof body?.message?.["total-results"] === "number") {
    crossrefMerged.message["total-results"] = body.message["total-results"];
  }
}

if (crossrefOk) {
  const crossrefPath = `${OUT}crossref-recorded.json`;
  writeFileSync(crossrefPath, `${JSON.stringify(crossrefMerged, null, 2)}\n`);
  console.log(`\n==> Wrote ${crossrefMerged.message.items.length} works to`);
  console.log(`    ${crossrefPath}\n`);
} else {
  console.error("\n  Crossref failed. OpenAlex fixtures were still written.\n");
  process.exitCode = 1;
}
console.log("Now run the suite. If it goes red, that is the adapter being wrong");
console.log("about the real API — which is exactly what this was for:\n");
console.log("    npm test\n");
