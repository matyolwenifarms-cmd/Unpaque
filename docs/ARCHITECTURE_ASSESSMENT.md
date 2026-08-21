# Unpaque — architecture assessment

Written 21 August 2026, before foundational code, as §0 and §36 of the
Detective specification require. It records what was inspected, what was
decided, and — as §0's greenfield addendum instructs — **which assumptions a
human still needs to confirm or override**.

---

## 1. What Unpaque is

Unpaque is the platform. It has three features:

| Feature | Purpose | Status |
|---|---|---|
| **Unpack** | Communication diagnostics — what is this communication doing? | Phase 1 built, this repo |
| **The Researcher** | Academic research support, proposal to report | Specified in conversation only |
| **The Detective** | Investigative intelligence — cases, evidence, dossiers | Specified, v1.1, audited 20 Aug 2026 |

### A naming reconciliation

The document titled *Perloq — Product & Build Specification v1.0* describes
what the Detective specification calls **Unpack**. Perloq was an earlier name
for the diagnostics feature, not for a separate product. Unpaque is the
platform name and the repository name; Unpack is the feature. Nothing in this
repository is called Perloq, and the name should be retired to avoid a third
name in circulation for one thing.

## 2. Document inventory

Supplied and read:

- `Perloq spec doc` (v1.0) — Unpack, five phases plus bulk ingestion.
- `THE DETECTIVE MASTER SPEC` (v1.1, audited) — 42 sections, 8 phases.
- `The Detective — Master System Build` (90pp PDF).
- The Researcher — described in conversation, not yet a document.

**The v1.1 audit addendum states that its two source documents were not
supplied. One of them now is:** the 90-page *Master System Build* is the
"89 pages" the addendum names as missing. The other — *The Detective —
Comprehensive Concept & Master Product Architecture*, 44pp — is still absent.
Per the addendum, v1.1 remains authoritative and the build does not block on it.

**The Researcher has no specification document.** It is currently the least
defined and the most technically dangerous of the three (see §6). It should get
a document before it gets code.

## 3. Stack — and a flagged departure from the spec

§0's greenfield addendum says that if no Unpaque repository exists, default to
"a TypeScript full-stack framework (e.g. Next.js)" and **"flag this assumption
explicitly in the architecture assessment so a human can confirm or override
it"**. This is that flag.

**Decision: Vite + React 18 + TypeScript (strict) + Tailwind + Supabase**, not
Next.js. The reasoning:

- §18 requires per-case authorisation, tenant isolation, and says "use
  row-level security where supported by the database architecture". Postgres
  RLS under Supabase is that model natively, rather than an authorisation layer
  written by hand in application code and enforced by remembering to call it.
- Auth, object storage for §7 media, realtime for §14's live dossier events and
  Postgres are one system rather than four integrations.
- Unpack has no SEO surface and no server-rendered content; it is a logged-in
  tool making model calls. Next.js's principal advantage does not apply.
- The maintainer runs this exact stack in another production system, so the
  conventions, CI shape and review instincts already exist.

§28 says "use the existing Unpaque stack, do not introduce a new framework
unless repository inspection proves it is necessary." As of this commit this
repository *is* the existing stack, and the Detective must adopt it rather than
bring its own.

### The one genuine gap in that stack

Supabase Edge Functions have a wall-clock ceiling. These exceed it:

- §8 transcription, §7 media processing, §13's fourteen-stage research pipeline;
- The Researcher's document ingestion and citation retrieval;
- Unpack Phase 4's per-section document diagnostics.

**A queue and a long-running worker are required**, and they are the one piece
Supabase does not supply. Recommended: a jobs table plus a worker process on
any container host, with §27's job states surfaced through Postgres realtime so
§14's assembly experience reads from real state rather than a simulated
progress bar. This is an addition to the stack, not a reason to change it.

**Unpack Phase 1 does not need it** — a single pasted text is one model call —
so the diagnostic pipeline is written as a pure function with the model call
injected (`_shared/diagnostic/analyse.ts`). Moving it behind a queue later
changes the transport around that function and not the function itself.

## 4. Shared primitives

Per §1's shared-platform principle, these belong to the platform and no feature
may duplicate them: auth and identity, account/workspace boundaries, the design
tokens in `src/index.css`, the AI provider abstraction (§23), storage, billing
and entitlements (§26), audit events, and the jobs/queue mechanism above.

`supabase/functions/_shared/` is the seam. Modules there are pure, use `.ts`
import extensions, and are imported by both Deno and the browser. Anything
touching `Deno.env`, a vendor SDK or a Supabase client stays in a function's
`index.ts`. That boundary is why the whole Unpack diagnostic is tested from
Node with no network and no API key.

## 5. One mechanism, three features

Each of the three features has a discipline it must not break, and in all three
cases the discipline is the product rather than a caveat on it:

| Feature | The discipline | The closed vocabulary |
|---|---|---|
| Unpack | Describes structure; never a mind, a motive or a verdict | 8 communication frameworks |
| The Detective | §4 epistemic model; never states an allegation as fact | 11 epistemic classifications |
| The Researcher | Never a reference that does not exist | 15 paradigms + ~14 analytic theories |

All three take the same shape, and Unpack has now built it once:

1. **A closed enum in the tool schema**, so an unattributed claim is a malformed
   tool call the API itself rejects rather than a policy breach caught later.
2. **A runtime parser** that refuses anything malformed — the schema is a
   request, the parser is what actually stops a bad payload reaching a screen.
3. **A guard** over the model's own prose, scanning only what the system wrote
   and never what it quoted, failing the report rather than editing it.
4. **One correction**, quoting the offending span, then an honest refusal.

`_shared/diagnostic/guard.ts` is the reference implementation. The Detective's
§18 hard prohibitions ("never state an allegation as established fact", "never
claim deception from voice or linguistic patterns alone") are guard rules in
exactly this sense, and §4's language-discipline table is a lint over generated
prose. Build the Detective's epistemic guard by extending this module, not by
writing a second one with different habits.

## 6. The Researcher: the risk that has to be designed out first

The requirement is: upload a proposal, receive real and relevant references
newest-to-oldest, each with a passage quotation demonstrating relevance, hover
to preview the passage, click to land on it in the paper.

**A language model asked for references will invent them.** Plausible authors,
plausible titles, plausible years, DOIs that do not resolve. This is the single
best-documented failure mode of the technology, and in a tool for academics it
is not a bug to be tidied up later — a fabricated citation in a submitted
literature review is a research-integrity finding against the user.

It cannot be fixed with a prompt. It has to be made unrepresentable:

- **References come from a bibliographic provider, never from the model.**
  OpenAlex, Crossref, Semantic Scholar, Europe PMC, CORE, arXiv. A reference
  row may exist only if it carries a resolvable identifier returned by a
  provider — DOI, OpenAlex id, PMID. The model may rank, cluster and *explain*
  relevance; it may never supply the reference itself.
- **The passage comes from retrieved full text**, with the character offset
  stored. The deep link is that offset. No retrievable full text means no
  passage — the reference still lists, and the interface says why there is no
  quotation rather than generating one.
- **Verification before display**: resolve every identifier before a reference
  reaches a screen. An unresolvable one is dropped and counted, not shown.

This is §18's "never fabricate evidence" and §6's provenance requirement,
applied to citations. It is also the reason the provider abstraction in §13
matters more for The Researcher than for The Detective: the whole feature is
only as honest as the bibliographic source behind it.

### Two positioning notes, neither a blocker

- **"Report writing done by the system"** is a drafting aid, and universities
  have AI-use policies that generally require declaration. What the system
  should do is keep provenance for machine-drafted sections so a researcher can
  declare accurately. What its copy must not do is imply submittable work.
- **The paradigm list is a closed vocabulary**, and should be modelled as one —
  the same enum-and-cite discipline as Unpack's frameworks. An analysis that
  cannot name its paradigm should not render.

### A known limit of the local harness

Migrations are verified against a bare Postgres 16 as a genuine superuser, and
`force row level security` has no effect on superusers. Supabase's `postgres`
role is not one, so a table that wrongly FORCEs RLS breaks there — a security
definer function reading it has its own query filtered to nothing, presenting as
"the case does not exist" for everybody including the owner — while passing
silently here.

`detective_privacy_test.sql` therefore asserts `relforcerowsecurity` is false
directly rather than relying on behaviour. Any future suite touching RLS should
do the same, and `supabase/tests/harness.sql` records the gap where somebody
writing one will see it.

## 7. What exists in this repository today

Unpack Phase 1, built vertically per §0's implementation rule — data model,
service, API, state, UI, tests — with no mock interfaces that cannot be
connected to real data.

- `supabase/functions/_shared/diagnostic/` — frameworks, report contract and
  parser, guard, prompt, pipeline. Pure, Deno- and browser-compatible.
- `supabase/functions/analyse/` — the Deno endpoint: rate limit, model call,
  outcome mapping.
- `supabase/migrations/` — the quota and spend ceilings.
- `src/` — the single page, the report view, the client.
- 70 tests. Typecheck, lint, tests and build all green by exit code.

Not built: accounts, history, persistence of reports (Phase 2), the extension
(Phase 3), documents (Phase 4), tracking (Phase 5), and both other features.

## 8. Recommended order

1. **Finish Unpack Phase 1 against a real Supabase project.** It is the
   smallest complete vertical slice, and it is what establishes the shared
   primitives every other feature reuses. Nothing has run against a live
   deployment yet.
2. **Write The Researcher's specification**, with §6 settled first. It is the
   least documented and the most dangerous.
3. **The Detective Phase 0–1.** *Phase 0 done:* `cases`, `case_collaborators`,
   the access predicates and their RLS, plus §4's epistemic model in
   `_shared/detective/` with a drift test against the Postgres enums. 18 SQL
   assertions prove the refusals — a stranger holding a private case's id sees
   nothing, an unaccepted invitation grants nothing, revocation bites at once,
   an editor may write and may not delete. Next: the Case + Dossier + Source +
   Evidence slice.
4. **The queue and worker**, before anything that transcribes, ingests or
   assembles.

Voice (§24), broadcast (§25) and proactive monitoring (§6 Phase 6) stay where
the specification puts them: after the visual investigative core is stable.
