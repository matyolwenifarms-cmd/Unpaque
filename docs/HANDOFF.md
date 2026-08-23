# Unpaque — handoff

Written 22 August 2026, at the end of the session that created this repository.
It is the current picture: what exists, what has actually been verified, what
has not, and what to do next.

Keep it current. A stale handoff is worse than none, because it is believed.

---

## The look of the thing

The wordmark is a charcoal plate with an amber "Un", an off-white "paque", an
amber rule and the tagline in widely tracked capitals. **Dark is the brand at
rest**, so it is what `:root` holds; light is the adaptation and lives in a
`prefers-color-scheme: light` query rather than the other way round.

The wordmark is set in type rather than dropped in as an image: it stays sharp
at any size, adapts to a light-mode reader, and reads as the word it is.

## The shape of the thing

Unpaque is a platform with three features. They share auth, design tokens,
storage, the rate limiter and the AI provider abstraction; they do not share
domain models.

Their names on screen are verbs — **Unpack**, **Research**, **Detect** — written
once, in `src/lib/features.ts`. The specification calls two of them "The
Researcher" and "The Detective"; the argument for changing that, and the list of
what deliberately did not change with it, is `DEPARTURES.md` §6.

| Feature | What it does | State | Costs to run |
|---|---|---|---|
| **Unpack** | Communication diagnostics — what is this communication doing? | Phase 1 complete, deployed | Model calls |
| **Research** | Literature, method, analysis, coding, write-up | Five stages on screen — the whole lifecycle. §6 and §7, quantitative and qualitative, with a second coder and inter-coder agreement | **Nothing** |
| **Detect** | Investigative intelligence — cases, evidence, timeline, dossier, explanations, case graph | Phase 0–1, plus §11's graph and §12's hypothesis, falsification and skeptic engines | Nothing |

The naming: the document titled *Perloq* describes what is now **Unpack**.
Perloq was an earlier name for the feature, not a separate product. Nothing in
this repository is called Perloq and the name should be retired.

---

## What is actually verified, and what is not

The distinction matters more than the totals.

**Verified against reality:**

- 1103 unit and component tests, four passing gates (typecheck, lint, test, build).
- 221 SQL assertions across ten suites, run against a real Postgres 16, with
  every migration applied **three times** and negative controls in every suite.
- Both bibliographic adapters checked against **live** OpenAlex and Crossref
  responses. The recorded fixtures are committed.
- The production build driven in a real browser: every route returns 200,
  renders, keeps its shell on an unknown path, and logs nothing.
- **The coding surface driven with a real pointer** (`npm run smoke:coding`).
  A transcript is pasted, two codes written, two passages dragged and coded, a
  theme assembled and the saturation account read — in Chromium, against the
  built bundle. It is a separate gate from `smoke:ui` because the thing it
  proves is not that the route boots: a coding is stored as an offset into the
  transcript and the offset comes from where a pointer was dragged, which jsdom
  cannot produce at all. Breaking the offset walk turns it red with
  `dragging "waiting" offered "waiting was"`.
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
- **Detect's UI has never seen a real row.** The case list, case view,
  entry forms and epistemic badges are component-tested against mocked queries
  and boot in a browser; no case, source, claim or evidence link has ever been
  written to a live database. The RLS behind them *is* verified, against a real
  Postgres — including, now, that the writes actually succeed.
- **The data workspace has never seen a file from an actual study.** It has
  now been run against synthetic exports built to match what Qualtrics, SPSS
  and Google Forms document themselves as writing — three-row headers, JSON
  import ids, system-missing as `.` or blank, question text with commas in it,
  a byte-order mark — and those are committed as fixtures. The shapes are
  right; the data is invented. A real export is still the thing to try, and it
  needs no key.
- **A study now holds the whole of a piece of research**, and the picker moved
  from the coding stage to the top of Research to say so. It was right while a
  study held only transcripts; it stopped being right when the write-up needed
  the method declaration and the analyses, which were sitting in a different
  component's state. Two containers for one piece of research is how somebody
  ends up with a methodology that does not describe the coding beneath it.
- **The dataset itself is never uploaded.** Analyses are stored; the file they
  were run on is named and not kept. Reopening a study shows the findings and
  the write-up assembles from them, but re-running anything needs the file
  again. A SQL assertion checks there is no column it could be hiding in.
- **Voice is a closed grammar, not a conversation.** §24's commands are
  navigation over records — "open source fourteen", "show the timeline" — and a
  deterministic parser handles them with no model, which is *better* here than
  a model would be: asked to interpret "source forty" against a case with
  fourteen sources, a model picks one. This refuses and shows what it heard.
  Speech recognition is the browser's own, so Firefox gets the typed path and
  is told why. Nothing speaks back: reading a stored record aloud would be
  honest and is not built; answering a question aloud would mean generating
  one.
- **Broadcast mode presents reasoning, not media.** §7 and §8 — video, audio,
  transcription — are not built, so there is no central media frame and the
  broadcast screen says so in its own footer. It shows claims with their
  epistemic status, sources by reference number, the timeline and the competing
  explanations. Do not add a media frame until there is media; there is a test
  asserting the notice is still there.
- **The qualitative workspace has never written to a live database.** Six
  tables, an RPC that checks a coding's offsets against the document it points
  into, and 33 assertions against a real Postgres 16 — but no study, transcript
  or coding has been written through supabase-js to a deployed project. It also
  needs email auth enabled (step 4 below) before anybody can open a study at
  all. Signed out the workspace still runs and keeps nothing, and says which of
  those three states it is in.
- **No second coder has ever accepted an invitation.** The whole path exists
  and is asserted 33 times against a real Postgres — invite by address, accept
  from your own token, code blind, unblind, compare — but no two accounts have
  ever done it. It needs email auth (step 4) and two real users.
- **Blinding is enforced in the database and cannot be undone.** While a study
  is blind every coder sees only their own codings, because a second coder who
  can see the first coder's highlights reaches the same passages by being shown
  them. `unblind_study()` is owner-only and one-way; a trigger refuses
  re-blinding, since nobody can be made to unsee.
- **Relevance ordering has not been seen against a live provider.** The sort is
  unit-tested against ranked fixtures and the change is the difference between
  keeping and discarding the providers' own ordering, but no live OpenAlex or
  Crossref answer has been through it. The agent environment cannot reach
  either host.

## Two failures a user found, and what they cost

Both were in code that had tests, and in both cases the tests were the problem.

**A case could not be created at all** — `new row violates row-level security
policy for table "cases"` on every attempt. The insert policy was correct
throughout. Postgres applies the *select* policy to the rows an `insert ...
returning` gives back and reports a refusal there with the same message as a
with-check failure, so the error named the wrong policy; the select policy
resolved ownership by looking the case up in `cases`, where the row being
inserted was not yet visible. Fixed in `20260822040000_cases_returning.sql`.

The suite had asserted that a stranger cannot create a case in somebody else's
name, and never that the owner can create one in their own. A policy refusing
everybody passes every test of that shape. `detective_write_test.sql` now
inserts into all six tables with `returning`, which is what supabase-js sends.

**Literature search returned the wrong field.** A search about media framing
led with 2025 trial registrations about irrigation. The providers had ranked
the relevant work first; the pipeline then sorted the merged list by date and
threw that ordering away. Relevance is now the default, `providerRank` carries
each provider's own position through the merge, and date order is a control the
researcher can choose — over a set relevance has already selected. A long paste
is also reduced to its content terms before it is sent, and the notes say which
terms were searched.

**A form asked for more than its column could hold.** Adding an event failed
with `new row for relation "events" violates check constraint
"events_label_check"` — a sentence naming no field, no limit and no action. The
field asked "What happened?", so a paragraph of the source was pasted into a
column that holds a 300-character label for the timeline. Seven length
constraints existed and not one was checked before submitting.

`_shared/detective/limits.ts` now mirrors them, drift-tested against the
migrations, and `LimitedField` shows the count and refuses the submit.
Deliberately not `maxLength`: a browser truncates an over-long paste silently,
which in an investigation tool records half an account and calls it saved —
worse than the error it replaces. The wording changed with it, since a field
that asks what happened will be given what happened.

Neither of the first two bugs was reachable by the checks in place, and the
third was reachable only by using the thing. The lesson is the one already in
rule 2 and worth restating: a suite of refusals proves refusals, and nothing
whatsoever about whether the thing works.
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
| Research | Cite anything that does not exist | providers, never the model |
| Research | Report a p-value alone, or a causal claim from a correlation | `Finding` has no p without n and an effect |
| Research | Write the researcher's argument for them | A `yours` section has no field a body could go in |
| Detect | State an allegation as fact | 11 epistemic classifications; the dossier concludes nothing |
| Detect | Be forced into one theory | `assembleHypotheses` refuses a lone hypothesis; no column or field ranks one |
| Detect | Hold a belief no evidence could touch | `falsifier` is `not null`, in the schema and the type |
| Detect | Draw a connection stronger than its weakest link | `Path.weakest` is derived; no field takes a strength |
| Detect | Assert a relationship as fact with nothing behind it | A check constraint, not a client rule |
| Detect | Broadcast a claim without its classification | `lowerThird` returns both fields or neither |
| Detect | Act on a command it may have misheard | A closed grammar; every refusal carries the transcript |

Research's passage engine is the strongest form: the model returns
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
3. **`npm run deploy`.** It now also pushes `20260823000000_qualitative_study`,
   which is the six tables the coding workspace writes to — until it runs,
   opening a study fails with a message about a missing relation. Then run
   `npm run smoke` and the `/research` route against the deployed functions.
4. **Enable email auth** in the Supabase dashboard (Authentication → Providers →
   Email, with magic links on) and sign in once. Nothing that belongs to a
   person works until that is done — and the coding workspace is the first
   thing that silently *degrades* rather than stopping: signed out it runs and
   keeps nothing, saying so at the top.
5. **Detect's interface**, or **Research's document retrieval**.
   The latter needs the job worker described in
   `ARCHITECTURE_ASSESSMENT.md` §3, and is the first thing here that cannot be
   fully tested offline.

---

## Which specification a `§` refers to

The two specifications number their sections independently, and the code cites
both. `§6` and `§7` in `research/` are the Researcher's; `§4`, `§9`, `§10` and
`§18` in `detective/` are the Detective's. There is no way to tell from the
number alone — the directory is what disambiguates it, and a citation moved
between the two would resolve to the wrong section without failing anything.

Both are now in `docs/`. Until this commit neither was: 29 citations to `§4`
and 14 to `§18` pointed at a document nobody reading the repository could open,
which is the state in which a citation quietly becomes decoration.

`docs/the-detective-master-system-build.md` is the 89-page source document the
Detective spec consolidates. Its own audit note records it as "not provided" —
it was provided, as a PDF in the project uploads, which for anybody reading the
code is the same as absent. It is secondary to the consolidated spec by that
spec's own instruction, and its section numbers are its own: its §3 is the
epistemic model that the consolidated spec renumbers as §4.

`docs/the-detective-concept-and-architecture.md` is the second, 44 pages, also
extracted from a PDF. It has no section numbers — it is prose under headings —
so it cannot be cited as `§n` and must be quoted by heading.

Both were supplied as PDFs in the project and neither was in the repository,
which for anybody reading the code is the same as absent. That is what the
consolidated spec's audit note was recording.

## Where the arguments live

- `THE_DETECTIVE_SPEC.md` — the Detective's consolidated build specification.
  Authoritative for that feature.
- `the-detective-master-system-build.md` — its 89-page source, extracted from
  a PDF. Secondary, and numbered differently. See above.
- `the-detective-concept-and-architecture.md` — its 44-page source. Secondary,
  and has no section numbers to cite at all.
- `ARCHITECTURE_ASSESSMENT.md` — the stack decision, the shared primitives, the
  known limits of the local test harness.
- `DEPARTURES.md` — every deliberate divergence from a supplied specification,
  argued. **Read it before "fixing" something that looks wrong against a spec.**
- `THE_RESEARCHER_SPEC.md` — written here, because that feature arrived as a
  conversation rather than a document.
- `SETUP.md` — everything a human has to do by hand.
