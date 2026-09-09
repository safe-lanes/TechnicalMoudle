#!/usr/bin/env bash
# PILOT ARTIFACT — starts the ship's OWN Postgres, then the app. One container, isolated.
set -e
DB=pms_arch_ship

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "[ship] initialising internal Postgres at $PGDATA"
  mkdir -p "$PGDATA" && chown -R postgres:postgres "$PGDATA"
  su postgres -c "$PGBIN/initdb -D $PGDATA -A trust -E UTF8" > /tmp/initdb.log 2>&1
fi
chown -R postgres:postgres "$PGDATA"
su postgres -c "$PGBIN/pg_ctl -D $PGDATA -o '-c listen_addresses=127.0.0.1 -p 5432' -w -t 60 start" > /tmp/pgstart.log 2>&1
su postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='$DB'\"" | grep -q 1 \
  || su postgres -c "createdb $DB"
echo "[ship] internal Postgres ready; DB=$DB (host DB is NOT reachable from here)"

export DATABASE_URL="postgres://postgres@127.0.0.1:5432/$DB"
echo "[ship] SYNC_INSTANCE_ID=$SYNC_INSTANCE_ID  SYNC_SHORE_URL=$SYNC_SHORE_URL"
exec npx tsx server/index.ts
