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
console.log(`    ${path}\n`);
console.log("Now run the suite. If it goes red, that is the adapter being wrong");
console.log("about the real API — which is exactly what this was for:\n");
console.log("    npm test\n");
