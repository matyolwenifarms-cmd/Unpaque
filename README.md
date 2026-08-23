# Unpaque

Unpaque is a platform with three features:

- **Unpack** — communication diagnostics. What is this communication doing?
- **Research** — academic research support, proposal through to report.
- **Detect** — investigative intelligence: cases, evidence, dossiers.

The supplied specification calls the last two "The Researcher" and "The
Detective". The verb form, and why, is `docs/DEPARTURES.md` §6.

This repository currently contains **Unpack Phase 1**. See
[`docs/ARCHITECTURE_ASSESSMENT.md`](docs/ARCHITECTURE_ASSESSMENT.md) for the
stack decision, the shared primitives, and what the other two features need
before they get code.

## What Unpack does

Grammarly asks *is this written correctly?* Unpack asks *is this communicating
the way you think it is?*

It names the rhetorical machinery underneath a piece of communication — the
speech act being performed, where responsibility is placed, what is foregrounded
and what is left out, where the wording stays uncommitted — and attributes every
finding to a named communication-theory framework.

**What it does not do**, and this is the product rather than a disclaimer: it
never predicts what a reader will feel, never rules on honesty or sincerity, and
never attributes intent. It describes the text. You interpret it.

That boundary is enforced structurally, not by asking a model nicely:

- `framework` is a closed enum in the tool schema, so an unattributed finding is
  a malformed tool call rather than a policy breach caught downstream.
- `parseReport()` refuses any payload that does not fit the contract.
- `guard.ts` scans every string the system wrote — never the quotes it took from
  the source — and **fails the report** rather than editing the offending
  sentence out of it.
- One correction is offered, quoting the exact span that broke the rule. A
  second failure is an honest refusal, not a scrubbed report.

## Commands

```bash
npm run dev          # Vite dev server
npm run typecheck    # tsc -b --noEmit
npm run lint         # eslint .
npm test             # vitest run — 979 tests
npm run build        # tsc -b && vite build
npm run smoke:ui     # every route, in Chromium, console asserted empty
npm run smoke:coding # the coding surface, driven with a real pointer
```

`smoke:coding` is separate from `smoke:ui` because it proves something else. A
coding is stored as an offset into the transcript, and the offset comes from
where a pointer was dragged — which jsdom, having no layout, cannot produce.

Check exit codes, not output. A piped `| tail` reports the exit status of
`tail`, which is always 0.

## Layout

```
src/
  components/       ReportView and friends
  lib/              api client, utils
supabase/
  functions/
    _shared/        the seam — pure, imported by both Deno and the browser
      diagnostic/   frameworks, report contract, guard, prompt, pipeline
    analyse/        the Deno endpoint
  migrations/       replay-safe SQL
docs/
  ARCHITECTURE_ASSESSMENT.md
  SETUP.md          what a human has to do by hand
```

`supabase/functions/_shared/` uses `.ts` import extensions — Deno's convention,
and what Node's `--experimental-strip-types` requires. The browser reaches it
through the `@shared` alias.

## Tests

Tests sit beside what they test. Pure logic runs under node; component tests opt
into jsdom with a `@vitest-environment jsdom` docblock so the logic suites do
not pay for a DOM they never touch.

Every suite carries negative controls. The guard suite proves that the framework
vocabulary it must *not* catch — "evasion of responsibility", "denial",
"minimisation", "responsibility lies with" — still passes, because a guard that
refused those would leave Unpack mute rather than careful.
