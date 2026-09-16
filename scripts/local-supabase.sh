#!/usr/bin/env bash
# Brings up a local stand in for Supabase: Postgres plus PostgREST, reachable
# the way supabase-js expects. It exists so the data layer can be exercised
# against real PostgREST and real RLS instead of a mock. It is a development
# aid and is never used in production.
#
# Needs: Postgres 16 and the postgrest binary on PATH.
set -euo pipefail

PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
PGDATA_DIR=${PGDATA_DIR:-/var/tmp/mkp-pgdata}
PGPORT=${PGPORT:-55432}
PGRST_PORT=${PGRST_PORT:-3001}
DB=${DB:-mkp_dev}
export PATH="$PGBIN:$PATH"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Matches the JWT secret the anon and service keys in .env.local are signed with.
JWT_SECRET=${JWT_SECRET:-mona-k-project-local-development-jwt-secret-value}

if ! pg_isready -h /tmp -p "$PGPORT" >/dev/null 2>&1; then
  echo "Starting Postgres on $PGPORT"
  rm -rf "$PGDATA_DIR"; mkdir -p "$PGDATA_DIR"
  chown -R postgres "$PGDATA_DIR"; chmod 700 "$PGDATA_DIR"
  su postgres -c "PATH=$PGBIN:\$PATH initdb -D $PGDATA_DIR -A trust -U postgres" >/dev/null
  su postgres -c "PATH=$PGBIN:\$PATH pg_ctl -D $PGDATA_DIR -o '-p $PGPORT -k /tmp' -l $PGDATA_DIR/server.log start -w" >/dev/null
fi

PSQL="psql -h /tmp -p $PGPORT -U postgres -v ON_ERROR_STOP=1"
$PSQL -q -c "drop database if exists $DB;" -c "create database $DB;"
$PSQL -d "$DB" -q -f "$ROOT/supabase/tests/supabase_shim.sql"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  $PSQL -d "$DB" -q -f "$migration"
done
$PSQL -d "$DB" -q -f "$ROOT/supabase/seed/dev_seed.sql"
echo "Database $DB ready with development content."

pkill -f "postgrest" 2>/dev/null || true
sleep 1
cat > /tmp/postgrest.conf <<CONF
db-uri = "postgres://postgres@localhost:$PGPORT/$DB"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-port = $PGRST_PORT
server-host = "127.0.0.1"
CONF
nohup postgrest /tmp/postgrest.conf > /tmp/postgrest.log 2>&1 &
up=0
for _ in $(seq 1 30); do
  sleep 1
  if curl -sf -o /dev/null "http://127.0.0.1:$PGRST_PORT/bodies"; then
    echo "PostgREST listening on $PGRST_PORT"
    up=1
    break
  fi
done
if [ "$up" -ne 1 ]; then
  echo "PostgREST did not come up:"; tail -20 /tmp/postgrest.log; exit 1
fi

# supabase-js expects PostgREST under /rest/v1, so put the gateway in front.
pkill -f "supabase-gateway" 2>/dev/null || true
sleep 1
nohup node "$ROOT/scripts/supabase-gateway.mjs" > /tmp/supabase-gateway.log 2>&1 &
for _ in $(seq 1 20); do
  sleep 1
  if curl -sf -o /dev/null "http://127.0.0.1:${GATEWAY_PORT:-54321}/rest/v1/bodies"; then
    echo "Gateway listening on ${GATEWAY_PORT:-54321}. Point NEXT_PUBLIC_SUPABASE_URL at it."
    exit 0
  fi
done
echo "Gateway did not come up:"; tail -20 /tmp/supabase-gateway.log; exit 1
