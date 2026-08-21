#!/usr/bin/env bash
# One-shot deployment of Unpack's backend to a Supabase project.
#
# Run this on your own machine, not in an agent container — Supabase is
# unreachable from there. Usage:
#
#   ./scripts/setup-supabase.sh <project-ref>
#
# The project ref is the string in your dashboard URL:
# https://supabase.com/dashboard/project/<project-ref>
set -euo pipefail

REF="${1:-}"
if [[ -z "$REF" ]]; then
  echo "usage: $0 <project-ref>" >&2
  exit 2
fi

command -v supabase >/dev/null || {
  echo "The Supabase CLI is not installed." >&2
  echo "  macOS:   brew install supabase/tap/supabase" >&2
  echo "  Windows: scoop install supabase" >&2
  echo "  or:      npm i -g supabase" >&2
  exit 1
}
command -v openssl >/dev/null || { echo "openssl is required to generate the salt." >&2; exit 1; }

echo "==> Linking to $REF"
supabase link --project-ref "$REF"

echo "==> Applying migrations"
supabase db push

echo
echo "==> Anthropic API key"
echo "    Paste it below. It is read without echo and never printed or logged."
read -rsp "    ANTHROPIC_API_KEY: " ANTHROPIC_API_KEY
echo
[[ -n "$ANTHROPIC_API_KEY" ]] || { echo "Empty key — stopping." >&2; exit 1; }

# Generated here rather than asked for. It has no meaning outside this project
# and nobody needs to keep a copy: rotating it resets everyone's rate-limit
# window, which is harmless. It is never printed.
SALT="$(openssl rand -hex 32)"

echo "==> Setting secrets"
supabase secrets set \
  ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  RATE_LIMIT_SALT="$SALT" >/dev/null
unset ANTHROPIC_API_KEY SALT
echo "    done (values not echoed)"

echo "==> Deploying the analyse function"
supabase functions deploy analyse

echo
echo "Backend deployed. Two things left, both local:"
echo
echo "  1. Put these in .env — they are public by design and safe to commit"
echo "     to a shared team file. RLS is what protects data, not their secrecy:"
echo
echo "       VITE_SUPABASE_URL=https://$REF.supabase.co"
echo "       VITE_SUPABASE_ANON_KEY=<Project Settings -> API -> anon public>"
echo
echo "  2. Smoke-test it:  ./scripts/smoke-test.sh"
