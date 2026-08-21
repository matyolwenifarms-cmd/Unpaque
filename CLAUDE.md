# Unpaque — working instructions

Unpaque is a platform with three features on one Supabase project and one React
app:

- **Unpack** — communication diagnostics. What is this communication doing?
- **The Researcher** — literature search, verified references, passages.
- **The Detective** — investigative intelligence: cases, evidence, timeline.

**Stack:** Vite + React 18 + TypeScript (strict) + Tailwind + Supabase
(Postgres, auth, storage, Edge Functions under Deno). Node 22.

---

## Start here

1. **`docs/HANDOFF.md`** — the current picture: what exists, what is actually
   verified, what is not. Read it before proposing work.
2. **`docs/DEPARTURES.md`** — deliberate divergences from the supplied
   specifications, each argued. Read it before "fixing" something that looks
   wrong against a spec document; it is probably there on purpose.
3. **`docs/ARCHITECTURE_ASSESSMENT.md`** — the stack decision, the shared
   primitives, and the known limits of the local test harness.

The specifications are `docs/THE_RESEARCHER_SPEC.md` (written here) and the
Detective master spec supplied by the client. **Do not edit a client
specification.** Where the build departs from one, argue it in `DEPARTURES.md`.

---

## Commands

```bash
npm run dev          # Vite dev server
npm run typecheck    # tsc -b --noEmit
npm run lint         # eslint . — keep it at zero
npm test             # vitest run
npm run build        # tsc -b && vite build
npm run db:verify    # every migration, three times, against local Postgres
npm run smoke        # a real analysis through the deployed function
npm run smoke:ui     # drives the built app in a real browser
npm run research:record   # records live provider responses as fixtures
```

**Check exit codes, not output.** A piped `| tail` reports `tail`'s status,
which is always 0. This has already produced one false "all clear" here.

---

## Rules that are not negotiable

### 1. The discipline is the product, so enforce it structurally

Each feature has one thing it must never do, and in all three cases a prompt
saying so is insufficient. The pattern, applied three times already:

1. A **closed enum in the tool schema**, so a violation is a malformed tool call
   the API rejects rather than a policy breach caught downstream.
2. A **runtime parser** that refuses anything malformed. The schema is a
   request; the parser is what actually stops a bad payload reaching a screen.
3. A **guard** over generated prose, scanning what the system wrote and never
   what it quoted from a source.
4. **One correction, then an honest refusal.** Never a scrubbed result: a
   report with the offending sentence filed off has a hole in it that nothing
   on screen marks.

The strongest form is the passage engine: the model returns offsets, the server
slices, and the tool schema has **no field a quotation could be written into**.

### 2. A check that cannot fail is not evidence

Every suite carries negative controls. When you add a check of any kind,
deliberately break the thing it watches and confirm it goes red.

This is not ceremony. In this repository it has already found: a guard that
could not fire, a test passing because only one numeral existed across the
pair, a migration that worked once and failed on redeploy, and a fidelity gap
between the local harness and Supabase.

### 3. Migrations must survive three replays

`npm run db:verify` applies everything three times. `create table if not
exists`, `create or replace function`, `drop policy if exists` before `create
policy`.

**Two traps found here, both the hard way:**

- **Never drop a function that policies reference.** Policies keep attaching to
  it, including from migrations written later that this one cannot know about.
  `create or replace` is sufficient; a future migration needing a signature
  change owns the cascade.
- **Postgres refuses a subquery in a check constraint.** Put the logic in an
  `immutable` function and call that — and remember it does not revalidate rows
  already stored.

### 4. `enable` row level security, not `force`

The case access predicates are `security definer` and run as the owner.
Forcing RLS subjects the owner to its own policies and filters those reads to
nothing, presenting as "the case does not exist" for everybody including its
owner.

**The local harness cannot catch this**: FORCE does not apply to superusers and
the suites run as one, while Supabase's `postgres` role is not one. Assert
`relforcerowsecurity` is false directly, as `detective_privacy_test.sql` does.

### 5. Invariants live in RPCs, not scattered across policies

Tables written through an RPC get a select policy and no insert or update
policy. `case_collaborators` works this way: "you cannot invite yourself" and
"acceptance is the invitee's act" belong in one body.

### 6. A client-side copy of a server rule must be drift-tested

`_shared/detective/epistemic.ts` mirrors five Postgres enums; its test reads
the migrations and asserts they still agree. Any future copy gets the same
treatment or it will drift.

### 7. Say what did not happen

A search that returned less because a provider was down is indistinguishable
from a smaller literature. A stub report is indistinguishable from an analysis.
Both are told, prominently and above the results, not logged.

### 8. Comments explain *why*, and name the rejected alternative

The valuable half is almost always the road not taken. Match the surrounding
density; do not add comments that restate the code.

---

## Layout

```
src/
  pages/        route components
  components/   ReportView, ReferenceList
  lib/          api clients, utils
supabase/
  functions/
    _shared/    the seam — pure, imported by both Deno and the browser
      diagnostic/   Unpack: frameworks, contract, guard, prompt, pipeline
      research/     The Researcher: references, providers, verify, passages
      detective/    The Detective: epistemic model, timeline, contradictions
    analyse/          Unpack's endpoint
    research-search/  The Researcher's endpoint
  migrations/   replay-safe SQL
  tests/        behavioural SQL suites + harness.sql
scripts/        verification and recording, all POSIX shell or Node
docs/           handoff, departures, assessment, specs, setup
```

`_shared/` modules are pure, use `.ts` import extensions, and are imported by
the browser through the `@shared` alias. Anything touching `Deno.env`, a vendor
SDK or a Supabase client belongs in a function's `index.ts`.

Tests sit beside what they test. Component tests opt into jsdom with a
`@vitest-environment jsdom` docblock; node is the default so the pure-logic
suites do not pay for a DOM they never touch.

---

## Environment

- **Supabase is unreachable from an agent container**, as are all the
  bibliographic APIs. The proxy allows npm. Guide the human; do not attempt it.
- **Windows:** Git Bash for `.sh`, PowerShell for everything else. No `.ps1`
  files — PowerShell 5.1 reads an unmarked script as cp1252, where an em-dash
  becomes a string delimiter.
- **Chromium needs `--no-sandbox`** as root or it hangs rather than erroring.
- **Never `pkill -f` a pattern that appears in your own command line.**

---

## Secrets

Public by design, safe anywhere: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
They are compiled into the bundle; RLS protects the data, not their secrecy.

Never into chat, a commit or a log: `ANTHROPIC_API_KEY`, `RATE_LIMIT_SALT`, the
service-role key, the database password. Set with `supabase secrets set`. If
one leaks, the answer is rotation.

`RATE_LIMIT_SALT` is required and the placeholder is refused: an effectively
unsalted hash of an IPv4 address is reversible by anyone willing to walk 4.3
billion candidates.

---

## Git

Work on the branch you were given. Commit messages explain the reasoning, not
just the change — look at `git log` for the register. Do not open a pull
request unless asked.
