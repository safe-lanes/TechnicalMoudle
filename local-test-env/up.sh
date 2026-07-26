#!/usr/bin/env bash
# Bring up the local shore+ship test environment. Idempotent-ish: safe to re-run.
# Usage:  bash local-test-env/up.sh [--rebuild]
set -euo pipefail
cd "$(dirname "$0")/.."

PG="postgres://postgres:admin123@localhost:5432"
SHORE_DB=pms_arch
VUUID=743ef9d1-841a-11ed-aa7c-7003bca91a86      # WK Frontier Pilot
IMG=pms-ship-pilot:latest

echo "== 1/5 shore DB =="
node -e "const{Pool}=require('pg');const p=new Pool({connectionString:'$PG/postgres'});
(async()=>{const r=await p.query(\"SELECT 1 FROM pg_database WHERE datname='$SHORE_DB'\");
if(!r.rows.length){await p.query('CREATE DATABASE $SHORE_DB');console.log('  created $SHORE_DB');}
else console.log('  $SHORE_DB exists');await p.end();})();"

echo "== 2/5 shore app (port 5000) — migrations run on boot =="
if curl -sf -o /dev/null http://localhost:5000/technical/api/sync/health; then
  echo "  already running"
else
  set -a; . local-test-env/.env.shore.example; set +a
  nohup npx tsx server/index.ts > local-test-env/shore.log 2>&1 &
  for i in $(seq 1 40); do sleep 5
    curl -sf -o /dev/null http://localhost:5000/technical/api/sync/health && { echo "  up after $((i*5))s"; break; }
  done
fi

echo "== 3/5 ship image =="
if [ "${1:-}" = "--rebuild" ] || ! docker image inspect "$IMG" >/dev/null 2>&1; then
  docker build -f local-test-env/Dockerfile.ship \
    --build-arg BUILD_COMMIT="$(git rev-parse --short HEAD)" \
    --build-arg BUILD_BRANCH="$(git rev-parse --abbrev-ref HEAD)" -t "$IMG" .
else
  echo "  image exists (pass --rebuild to force)"
fi

echo "== 4/5 ship container (host 5100 -> container 5000) =="
docker rm -f pms-ship >/dev/null 2>&1 || true
docker run -d --name pms-ship --add-host=shore.pilot:host-gateway \
  --env-file local-test-env/.env.ship.example -p 5100:5000 "$IMG" >/dev/null
for i in $(seq 1 40); do sleep 5
  curl -sf -o /dev/null http://localhost:5100/technical/api/sync/health && { echo "  up after $((i*5))s"; break; }
done
# shore_url must live in the ship's DB (DB wins over env) and MUST include /technical/api
docker exec pms-ship su postgres -c \
  "psql -d pms_arch_ship -c \"UPDATE sync_settings SET setting_value='http://shore.pilot:5000/technical/api' WHERE setting_key='shore_url'\"" >/dev/null

echo "== 5/5 ready =="
echo "  SHORE http://localhost:5000   SHIP http://localhost:5100"
echo "  next: bash local-test-env/provision.sh   (bundle shore -> ship)"
