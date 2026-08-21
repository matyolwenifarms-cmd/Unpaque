# Unpaque — handoff

Written 22 August 2026, at the end of the session that created this repository.
It is the current picture: what exists, what has actually been verified, what
has not, and what to do next.

Keep it current. A stale handoff is worse than none, because it is believed.

---

## The shape of the thing

Unpaque is a platform with three features. They share auth, design tokens,
storage, the rate limiter and the AI provider abstraction; they do not share
domain models.

| Feature | What it does | State | Costs to run |
|---|---|---|---|
| **Unpack** | Communication diagnostics — what is this communication doing? | Phase 1 complete, deployed | Model calls |
| **The Researcher** | Literature search, verified references, passages | Phase 1–2 core complete | **Nothing** |
| **The Detective** | Investigative intelligence — cases, evidence, timeline | Phase 0–1 complete | Nothing yet |

The naming: the document titled *Perloq* describes what is now **Unpack**.
Perloq was an earlier name for the feature, not a separate product. Nothing in
this repository is called Perloq and the name should be retired.

---

## What is actually verified, and what is not

The distinction matters more than the totals.

**Verified against reality:**

- 378 unit tests, four passing gates (typecheck, lint, test, build).
- 59 SQL assertions across four suites, run against a real Postgres 16, with
  every migration applied **three times** and negative controls in every suite.
- Both bibliographic adapters checked against **live** OpenAlex and Crossref
  responses. The recorded fixtures are committed.
- The production build driven in a real browser: every route returns 200,
  renders, keeps its shell on an unknown path, and logs nothing.
- The whole Unpack deployment path, end to end, in stub mode — gateway, JWT
  check, rate limiter against real Postgres, function under Deno, client,
  parser, rendering.

**Not verified, and worth saying plainly:**

- **No real model call has ever been made.** Unpack's pipeline is tested with an
  injected fake, which proves the contract, the guard and the retry, and proves
  nothing about how a real model behaves against the schema. This is the single
  largest unknown in the repository and it costs about $5 to close.
- **Unpaywall has never been called.** Four tests skip until
  `npm run research:record` is run with `OPENALEX_CONTACT` set.
- **`/research` has never run against the deployed function.** The logic is
  tested; the endpoint has not been exercised in anger.
- **The Detective has no interface.** Schema, engines and tests only.
- **Auth has never run against a real Supabase project.** The session hook, the
  gate and the sign-in page are component-tested against a mocked client, and
  the routes boot in a browser — but no magic link has ever been sent or
  redeemed. Enabling email auth in the Supabase dashboard is a manual step
  nobody has taken.

---

## Environment facts that cost time to learn

- **Supabase is unreachable from the agent container.** All CLI work happens on
  the developer's machine. The proxy allows npm and essentially nothing else —
  OpenAlex, Crossref and Unpaywall are all blocked there too, which is why the
  fixture recorder exists.
- **Windows: use Git Bash for the `.sh` scripts**, or PowerShell for everything
  else. No `.ps1` files exist deliberately: Windows PowerShell 5.1 reads an
  unmarked script as cp1252, where an em-dash becomes a string delimiter.
- **Line endings are pinned to LF** by `.gitattributes`, for the reason recorded
  in the sibling project's handoff: two tests green on Linux and in CI, red on
  Windows, over a trailing `\r` that read as a codec fault.
- **The Supabase CLI is a devDependency.** `npm install` is the whole setup;
  `npm i -g supabase` is not supported by Supabase and fails oddly.
- **Chromium needs `--no-sandbox`** as root, or it hangs rather than erroring.
- **Never `pkill -f` a pattern that appears in your own command line.** It
  matches the shell running it. This was discovered the direct way.

---

## The one mechanism, three times

Every feature has a discipline that is the product rather than a caveat on it,
and all three are built the same way:

1. **A closed enum in the tool schema**, so an unattributed claim is a malformed
   tool call the API rejects rather than a policy breach caught later.
2. **A runtime parser** that refuses anything malformed. A schema is a request;
   a parser is what has ever actually stopped a bad payload reaching a screen.
3. **A guard** over generated prose, scanning what the system wrote and never
   what it quoted.
4. **One correction, then an honest refusal.**

| Feature | Must not | Closed vocabulary |
|---|---|---|
| Unpack | Read minds or judge honesty | 8 communication frameworks |
| The Researcher | Cite anything that does not exist | providers, never the model |
| The Detective | State an allegation as fact | 11 epistemic classifications |

The Researcher's passage engine is the strongest form: the model returns
offsets, the server slices, and **the tool schema has no field a quotation
could be written into**.

---

## Next, in order

1. **Put $5 on an Anthropic API key.** It closes the largest unknown here.
   `UNPAQUE_MODEL=claude-haiku-4-5` with `UNPAQUE_EFFORT=none` is about a tenth
   the price and exercises every part of the pipeline; switch to
   `claude-opus-5` before judging quality, because the model choice *is* the
   analysis.
2. **`npm run research:record`** with `OPENALEX_CONTACT` set. Free, thirty
   seconds, closes the last four skipped tests.
3. **Deploy both functions** (`analyse` and `research-search`) and run
   `npm run smoke` and the `/research` route against them.
4. **Enable email auth** in the Supabase dashboard (Authentication → Providers →
   Email, with magic links on) and sign in once. Nothing that belongs to a
   person works until that is done.
5. **The Detective's interface**, or **The Researcher's document retrieval**.
   The latter needs the job worker described in
   `ARCHITECTURE_ASSESSMENT.md` §3, and is the first thing here that cannot be
   fully tested offline.

---

## Where the arguments live

- `ARCHITECTURE_ASSESSMENT.md` — the stack decision, the shared primitives, the
  known limits of the local test harness.
- `DEPARTURES.md` — every deliberate divergence from a supplied specification,
  argued. **Read it before "fixing" something that looks wrong against a spec.**
- `THE_RESEARCHER_SPEC.md` — written here, because that feature arrived as a
  conversation rather than a document.
- `SETUP.md` — everything a human has to do by hand.
