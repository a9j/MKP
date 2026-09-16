#!/usr/bin/env bash
# Applies the migration to a throwaway Postgres cluster and runs the SQL tests.
# Needs a local Postgres 16 server. Nothing here touches your Supabase project.
set -euo pipefail

PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
PGDATA_DIR=${PGDATA_DIR:-/var/tmp/mkp-pgdata}
PORT=${PORT:-55432}
export PATH="$PGBIN:$PATH"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! pg_isready -h /tmp -p "$PORT" >/dev/null 2>&1; then
  echo "Starting a throwaway Postgres on port $PORT"
  rm -rf "$PGDATA_DIR"; mkdir -p "$PGDATA_DIR"
  chown -R postgres "$PGDATA_DIR"; chmod 700 "$PGDATA_DIR"
  su postgres -c "PATH=$PGBIN:\$PATH initdb -D $PGDATA_DIR -A trust -U postgres" >/dev/null
  su postgres -c "PATH=$PGBIN:\$PATH pg_ctl -D $PGDATA_DIR -o '-p $PORT -k /tmp' -l $PGDATA_DIR/server.log start -w" >/dev/null
fi

PSQL="psql -h /tmp -p $PORT -U postgres -v ON_ERROR_STOP=1"
$PSQL -q -c "drop database if exists mkp_test;" -c "create database mkp_test;"
$PSQL -d mkp_test -q -f "$ROOT/supabase/tests/supabase_shim.sql"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  $PSQL -d mkp_test -q -f "$migration"
done
echo "Migration applied."
$PSQL -d mkp_test -q -f "$ROOT/supabase/tests/schema_test.sql"
$PSQL -d mkp_test -q -f "$ROOT/supabase/tests/rls_test.sql"
echo "All database tests passed."
