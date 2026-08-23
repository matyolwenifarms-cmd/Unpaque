# Setup

What a human has to do by hand. Nothing here can be done from an agent
container — Supabase is unreachable from it.

**None of this can be done from an agent container.** `supabase.com` and
`api.supabase.com` are unreachable through the policy proxy, by design. Run it
on your own machine.

## 0. Or skip the cloud entirely

Supabase's free plan allows **two active projects per account**, and the limit
follows the account rather than the organisation — making a new organisation
does not work around it. If you are at the cap, you have three ways forward,
and the first two cost nothing:

- **Pause a dormant project.** Paused projects keep their data and stop
  counting against the limit. Dashboard, project, Settings, Pause.
- **Run the whole stack locally**, below. It needs Docker Desktop and no cloud
  project at all.
- **Upgrade to Pro** when the thing is earning, not before.

### The local stack

Postgres, the API gateway and the Deno edge runtime, all in Docker. Full
fidelity — the same migrations, the same function, the same client code.

```bash
cp supabase/functions/.env.example supabase/functions/.env   # add a real key
./scripts/dev-local.sh
```

Then, in a second terminal:

```bash
supabase functions serve analyse --env-file supabase/functions/.env
```

And a third:

```bash
npm run smoke
npm run dev
```

`supabase/functions/.env` is gitignored and must stay that way; the example
beside it is committed and holds no key. `.env.local.example` carries the local
stack's fixed anon key, which is the same on every machine and worthless
anywhere else.

Stop it with `supabase stop`. Nothing about this path is throwaway — when you
do get a cloud project, the same migrations and the same function deploy to it
unchanged.

**On Windows: run these scripts in Git Bash, not PowerShell.**

## 1. A Supabase project

Create one at <https://supabase.com/dashboard>. Any region; pick the one nearest
your users. Keep the database password somewhere safe — it is shown once, and it
never belongs in this repository, a commit, an issue or a chat message.

The **project ref** is the string in the dashboard URL:
`https://supabase.com/dashboard/project/`**`<project-ref>`**

## 2. Deploy

The Supabase CLI arrives with `npm install` as a devDependency — there is
nothing separate to install, and the scripts fall back to `npx` automatically.
(A global `brew install supabase/tap/supabase` still takes precedence if you
have one. Do not try `npm i -g supabase`; Supabase does not support it.)

From the repository root:

```bash
./scripts/setup-supabase.sh <project-ref>
```

It links the project, applies the migrations, prompts for your Anthropic API key
without echoing it, generates `RATE_LIMIT_SALT` itself, sets both as secrets, and
deploys both functions. It prints no secret at any point.

Doing it by hand instead:

```bash
supabase link --project-ref <ref>
supabase db push          # applies supabase/migrations in filename order
supabase secrets set ANTHROPIC_API_KEY=...
supabase secrets set RATE_LIMIT_SALT="$(openssl rand -hex 32)"
supabase functions deploy analyse
supabase functions deploy research-search
```

### After you pull a change

**`git pull` deploys nothing.** Most of this repository runs on your machine,
and the two parts that matter most do not:

| What changed | What you must run |
|---|---|
| Anything under `supabase/migrations/` | `supabase db push` |
| Anything under `supabase/functions/` — **including `_shared/`** | `supabase functions deploy analyse` and `supabase functions deploy research-search` |
| Anything under `src/` | nothing; Vite reloads |

`_shared/` is the trap. It reads like library code sitting in your checkout, and
the literature pipeline — the providers, the merge, the ranking — lives entirely
in it. A change there is invisible until the function that bundles it is
redeployed, and the symptom is that a fix you can see in the diff has plainly
not happened.

To deploy everything after a pull:

```bash
npm run deploy
```

An npm script rather than a documented command line, and that is the point:
npm puts `node_modules/.bin` on `PATH`, so the CLI resolves without a global
install. Typing `supabase` directly in a fresh shell gets *"'supabase' is not
recognized as the name of a cmdlet"* on Windows — which reads as a broken
machine, not a missing prefix, and a deploy that never ran looks exactly like a
fix that did not work.

`npm run deploy:status` lists the migrations with their local and remote
versions, which is how you tell "the migration is not applied" from "the
migration is applied and did not help".

## 3. Turn on sign-in

**Authentication → Providers → Email**, with magic links on. Then sign in once
at `/sign-in`.

It is also what a second coder needs. Research's coding workspace can invite
somebody to code the same transcripts independently and then reports Cohen's
kappa between them; the invitation names an email address, and only the person
signing in with that address can turn it into access.

Nothing that belongs to a person works until this is done, and two features
fail differently without it. Detect shows the "this part of Unpaque is yours"
gate and stops, which is obvious. Research's **Code text** stage does not stop:
it runs, holds your transcripts and codings in the browser tab, and tells you
they are not being kept. That is deliberate — trying the coding surface should
not require an account — but it does mean the difference between "kept" and
"not kept" is a sentence at the top of the screen rather than a locked door.
Read it before you code an afternoon's work.

## 4. Point the app at it

Copy `.env.example` to `.env` and fill in the two public values from
**Project Settings → API**:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public>
```

## 5. Prove it works

```bash
npm run smoke
```

Sends a real non-apology through the deployed function and asserts the report
has four sections, has findings, and that **every finding cites a framework from
the closed set**. Then it prints the report so you can read whether it is any
good — which no assertion can tell you.

This is the check that has never been run. Everything in `npm test` uses an
injected fake model: that proves the contract, the guard and the retry, and
proves nothing about deployment.

## Secrets, in detail

**Public by design** — compiled into the browser bundle, safe to commit to an
`.env` you share with the team. RLS is what protects data, not their secrecy:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

**Never into chat, a commit, an issue or a log.** These bypass RLS entirely:

```bash
supabase secrets set ANTHROPIC_API_KEY=...
supabase secrets set RATE_LIMIT_SALT="$(openssl rand -hex 32)"
```

If one is exposed, the answer is rotation, not hope.

`RATE_LIMIT_SALT` is **required** — the endpoint refuses to serve without it
rather than run unmetered. It salts the hash of each caller's IP address, so the
rate-limit table can recognise a repeat caller without being able to name one.
An unsalted hash of an IPv4 address is reversible by anyone willing to walk 4.3
billion candidates.

## Seeing it work with no money at all

Before there is any credit on an API account, the deployment can still be
checked end to end:

```bash
supabase secrets set UNPAQUE_MODEL=stub
```

The function then returns a fixed report and calls no model. That exercises
everything except the model call itself — the gateway and its JWT check, the
rate limiter and its two ceilings, the function under Deno, the client, the
parser and the rendering. It is most of the deployment risk, for nothing.

The response is flagged `stub: true` and the interface says so above the
report, in terms that cannot be misread. Nothing selects this mode on its own,
and an absent API key still fails loudly rather than falling back to it — a
stub that engaged automatically would eventually engage in production, and
somebody would read fixed text as a diagnosis of what they wrote.

Set `UNPAQUE_MODEL` back to a real model to analyse anything.

## Running it cheaply

The analysis is the only thing here that costs money, and on Opus 5 it is
roughly 8-9 US cents a call — the output side dominates, because adaptive
thinking plus a four-section report is a lot of generated tokens.

Two ways down, in order of how much quality they cost:

```bash
supabase secrets set UNPAQUE_EFFORT=low          # same model, less thinking
supabase secrets set UNPAQUE_MODEL=claude-haiku-4-5 UNPAQUE_EFFORT=none
```

Haiku 4.5 is about a tenth the price and supports strict tool use, so it
exercises every part of the pipeline — the schema, the parser, the guard, the
retry. It **rejects the `effort` parameter outright**, which is why
`UNPAQUE_EFFORT=none` travels with it.

Use it to prove the plumbing works. Do not judge the product on it: the model
choice *is* the analysis quality here, and a cheap model will produce a report
that validates perfectly and reads thinly. Switch back to
`claude-opus-5` before deciding whether Unpack is any good.

## Ceilings

Optional, with defaults. Set them before the endpoint is publicly reachable:

| Secret | Default | What it does |
|---|---|---|
| `ANALYSES_PER_CALLER` | 8 | Analyses per caller per window |
| `ANALYSIS_WINDOW` | `1 hour` | The window, as a Postgres interval |
| `ANALYSES_PER_DAY` | 500 | Global daily ceiling |
| `UNPAQUE_MODEL` | `claude-opus-5` | The analysis model |
| `UNPAQUE_EFFORT` | `high` | `low`/`medium`/`high`, or `none` to omit it entirely |
| `ALLOWED_ORIGIN` | `*` | Set to your domain before launch |

Phase 1 has no accounts by design, which leaves the endpoint reachable by
anyone. The two ceilings are what stand between that and an uncapped bill. The
per-caller limit stops one visitor sitting on the button; the daily ceiling
stops a distributed flood at a number you chose.

## The local gates

```bash
npm run typecheck && npm run lint && npm test && npm run build
npm run db:verify      # migrations, three passes against a local Postgres 16
npm run smoke:ui       # drives the built app in a real browser
```

`smoke:ui` is the one component tests cannot stand in for. They render pieces
with mocked hooks and cannot tell you whether a route is registered, a chunk
resolves, or the bundle boots at all — the failures a user meets first. It
asserts every route returns 200, renders something, keeps the shell on an
unknown path, and logs nothing to the console.

Check exit codes, not output. A piped `| tail` reports the exit status of
`tail`, which is always 0.
