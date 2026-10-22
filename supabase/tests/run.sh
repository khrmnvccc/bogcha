#!/usr/bin/env bash
# Usage: supabase/tests/run.sh  (needs local postgres; uses DB "bogcha_test")
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL="${PSQL:-sudo -u postgres psql -v ON_ERROR_STOP=1 -q -t}"
sudo -u postgres dropdb --if-exists bogcha_test
sudo -u postgres createdb bogcha_test
$PSQL -d bogcha_test -f tests/00_supabase_stub.sql
for f in migrations/*.sql; do echo "== $f"; $PSQL -d bogcha_test -f "$f"; done
echo "== tests/rls_test.sql"
$PSQL -d bogcha_test -f tests/rls_test.sql
