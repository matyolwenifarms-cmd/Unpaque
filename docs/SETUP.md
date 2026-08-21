# Setup

What a human has to do by hand. Nothing here can be done from an agent
container — Supabase is unreachable from it.

## 1. A Supabase project

Create one, then from this directory:

```bash
supabase link --project-ref <ref>
supabase db push          # applies supabase/migrations in filename order
supabase functions deploy analyse
```

## 2. Secrets

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

## 3. Ceilings

Optional, with defaults. Set them before the endpoint is publicly reachable:

| Secret | Default | What it does |
|---|---|---|
| `ANALYSES_PER_CALLER` | 8 | Analyses per caller per window |
| `ANALYSIS_WINDOW` | `1 hour` | The window, as a Postgres interval |
| `ANALYSES_PER_DAY` | 500 | Global daily ceiling |
| `UNPAQUE_MODEL` | `claude-opus-5` | The analysis model |
| `ALLOWED_ORIGIN` | `*` | Set to your domain before launch |

Phase 1 has no accounts by design, which leaves the endpoint reachable by
anyone. The two ceilings are what stand between that and an uncapped bill. The
per-caller limit stops one visitor sitting on the button; the daily ceiling
stops a distributed flood at a number you chose.

## 4. Verifying

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Then drive the built app against the deployed function and confirm a real
analysis returns. Nothing in this repository has yet run against a live Supabase
project — the pipeline is tested with an injected fake model, which proves the
contract, the guard and the retry, and proves nothing about deployment.
