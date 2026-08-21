#!/usr/bin/env bash
# Brings up the whole Supabase stack locally: Postgres, the API gateway and the
# Deno edge runtime, in Docker. No cloud project, no free-tier limit, no spend
# beyond the Anthropic calls themselves.
#
# Windows: run this in Git Bash, not PowerShell.
set -euo pipefail

if command -v supabase >/dev/null; then SUPABASE=(supabase); else SUPABASE=(npx --no-install supabase); fi
"${SUPABASE[@]}" --version >/dev/null 2>&1 || {
  echo "Supabase CLI not found. Run 'npm install' first — it is a devDependency." >&2
  exit 1
}
docker info >/dev/null 2>&1 || {
  echo "Docker is not running. The local stack needs Docker Desktop started." >&2
  exit 1
}

if [[ ! -f supabase/functions/.env ]]; then
  echo "Missing supabase/functions/.env — copy supabase/functions/.env.example" >&2
  echo "and put a real ANTHROPIC_API_KEY in it. It is gitignored." >&2
  exit 1
fi

[[ -f .env ]] || { cp .env.local.example .env; echo "Wrote .env pointing at the local stack."; }

echo "==> Starting the local stack (first run pulls images; give it a few minutes)"
"${SUPABASE[@]}" start

echo "==> Applying migrations"
"${SUPABASE[@]}" db reset --no-seed

echo
echo "Stack is up. In a SECOND terminal, serve the function:"
echo
echo "    supabase functions serve analyse --env-file supabase/functions/.env"
echo
echo "Then, in a third:"
echo
echo "    npm run smoke      # a real analysis, end to end"
echo "    npm run dev                  # the app itself"
echo
echo "Stop everything later with:  supabase stop"
