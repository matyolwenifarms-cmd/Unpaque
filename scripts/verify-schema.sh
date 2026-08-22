#!/usr/bin/env bash
# Applies every migration three times against a fresh database.
#
# Three passes, not one: `supabase db push` re-runs the directory, so a
# migration that only works on an empty database passes its first deploy and
# breaks the second. Exit codes are checked directly — it is entirely possible
# to write a script like this that greps stderr for "ERROR" and cheerfully
# reports success against a refused connection.
set -euo pipefail

PORT="${PGPORT:-5434}"
HOST="${PGHOST:-127.0.0.1}"
DB="${PGDATABASE:-unpaque_verify}"
PSQL=(psql -h "$HOST" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -d postgres -c "drop database if exists $DB;" >/dev/null
# UTF8 explicitly: initdb can default to SQL_ASCII in a container, and under it
# a constraint using \uXXXX regex escapes is created without complaint and then
# matches nothing at all.
"${PSQL[@]}" -d postgres -c "create database $DB with template template0 encoding 'UTF8' lc_collate 'C.utf8' lc_ctype 'C.utf8';" >/dev/null

"${PSQL[@]}" -d "$DB" -f supabase/tests/harness.sql >/dev/null
echo "harness applied"

for pass in 1 2 3; do
  for migration in supabase/migrations/*.sql; do
    "${PSQL[@]}" -d "$DB" -f "$migration" >/dev/null
  done
  echo "replay pass $pass ok"
done

# A negative control. If the check cannot fail, it is not evidence: this asserts
# the harness reports a bad statement rather than swallowing it.
if "${PSQL[@]}" -d "$DB" -c "select this_function_does_not_exist();" >/dev/null 2>&1; then
  echo "NEGATIVE CONTROL FAILED: a bad statement was accepted" >&2
  exit 1
fi
echo "negative control ok"

# The behavioural suites, in the same run rather than a step somebody has to
# remember. They were CI-only, so a suite could be added and never execute on
# the machine it was written on — and the one thing a local gate is for is
# finding this before a push. `set -e` and ON_ERROR_STOP carry the failure:
# grepping output for "ERROR" is what once reported three green replay passes
# against a refused connection.
for suite in supabase/tests/*_test.sql; do
  "${PSQL[@]}" -d "$DB" -f "$suite" >/dev/null
  echo "$(basename "$suite") ok"
done
