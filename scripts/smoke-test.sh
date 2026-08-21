#!/usr/bin/env bash
# Sends one real analysis through the deployed function and checks the report
# that comes back is structurally sound.
#
# This is the check that has never been run. Everything in the test suite uses
# an injected fake model, which proves the contract, the guard and the retry,
# and proves nothing whatsoever about deployment.
set -euo pipefail

command -v jq >/dev/null || { echo "jq is required. brew install jq / apt-get install jq" >&2; exit 1; }
[[ -f .env ]] || { echo "No .env — see scripts/setup-supabase.sh output." >&2; exit 1; }
set -a; # shellcheck disable=SC1091
source .env; set +a

: "${VITE_SUPABASE_URL:?not set in .env}"
: "${VITE_SUPABASE_ANON_KEY:?not set in .env}"

TEXT="Following a review of resourcing, the decision has been taken that the \
project cannot proceed on the original timeline. We regret that this has caused \
frustration, and we remain committed to delivering value in due course."

echo "==> POST $VITE_SUPABASE_URL/functions/v1/analyse"
BODY=$(jq -n --arg t "$TEXT" '{text:$t, mode:"decode"}')

RESPONSE=$(curl -sS -w '\n%{http_code}' \
  -X POST "$VITE_SUPABASE_URL/functions/v1/analyse" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -d "$BODY")

STATUS=$(tail -n1 <<<"$RESPONSE")
PAYLOAD=$(sed '$d' <<<"$RESPONSE")

if [[ "$STATUS" != "200" ]]; then
  echo "HTTP $STATUS" >&2
  jq . <<<"$PAYLOAD" >&2 || echo "$PAYLOAD" >&2
  exit 1
fi

echo "==> HTTP 200. Checking the report is actually a report."

jq -e '.report.sections | length == 4' <<<"$PAYLOAD" >/dev/null \
  || { echo "FAIL: expected four sections" >&2; exit 1; }
echo "  ok: four sections"

jq -e '[.report.sections[].findings[].framework] | length > 0' <<<"$PAYLOAD" >/dev/null \
  || { echo "FAIL: no findings at all — suspicious for this text" >&2; exit 1; }
echo "  ok: findings present"

# The load-bearing one. Every finding must cite a framework from the closed set.
jq -e '[.report.sections[].findings[].framework] | all(. as $f |
  ["speech_act","image_repair","framing","strategic_ambiguity","attribution",
   "critical_discourse","face","informal_logic"] | index($f) != null)' \
  <<<"$PAYLOAD" >/dev/null \
  || { echo "FAIL: a finding cited an unknown framework" >&2; exit 1; }
echo "  ok: every finding is theory-attributed"

if jq -e '.repaired' <<<"$PAYLOAD" >/dev/null; then
  echo "  note: the guard fired and the model repaired on retry — worth reading the report."
fi

echo
echo "==> The text under test is a non-apology. A good report attributes"
echo "    responsibility to circumstance rather than to an actor. Read it:"
echo
jq -r '.report.sections[] | "── \(.id)\n\(.summary)\n" +
  ([.findings[] | "  • [\(.framework)] \(.claim)"] | join("\n"))' <<<"$PAYLOAD"
