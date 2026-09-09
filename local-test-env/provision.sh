#!/usr/bin/env bash
# Provision the ship FROM shore via the real API endpoints, then sync. No UI needed.
set -euo pipefail
cd "$(dirname "$0")/.."
VUUID=${1:-743ef9d1-841a-11ed-aa7c-7003bca91a86}
OUT=local-test-env/bundle.json          # untracked working file

echo "== generate bundle on SHORE (mints the ship's sync key, registers SHIP-<vessels.id>) =="
curl -sf -o "$OUT" "http://localhost:5000/technical/api/sync/provision/download/$VUUID"
node -e "const b=require('./$OUT');console.log('  vessel='+b.manifest.vesselName,'code='+b.manifest.vesselCode,
 'rows='+b.manifest.totalRows,'tables='+b.manifest.tables.length,'key='+!!b.manifest.syncApiKey);"

echo "== import on SHIP =="
curl -sf -X POST -H 'Content-Type: application/json' --data-binary @"$OUT" \
  http://localhost:5100/technical/api/sync/provision/import \
| node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);
 console.log('  success='+j.success,'verified='+j.verified,'tables='+j.tablesImported,'rows='+j.rowsImported,'errors='+(j.errors||[]).length);});"

echo "== sync (drain to zero) =="
curl -sf -X POST -H 'Content-Type: application/json' -d "{\"vesselId\":\"$VUUID\"}" \
  http://localhost:5100/technical/api/sync/trigger \
| node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);
 console.log('  pushed='+j.recordsPushed,'pulled='+j.recordsPulled,'remainPush='+j.remainingPush,'remainPull='+j.remainingPull,'ok='+j.success);});"
