#!/usr/bin/env bash
# Reset to a clean state. Destroys the ship container+DB and the shore test DB.
# Does NOT touch the real dev DB `pms` or any other database.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== stopping ship =="
docker rm -f pms-ship >/dev/null 2>&1 || true
echo "== stopping shore (port 5000) =="
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5000 -State Listen -EA SilentlyContinue | ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force }" || true
echo "== dropping shore test DB (pms_arch) — leaves pms / pms_4a_tenant / crew_management_local alone =="
node -e "const{Pool}=require('pg');const p=new Pool({connectionString:'postgres://postgres:admin123@localhost:5432/postgres'});
(async()=>{await p.query('DROP DATABASE IF EXISTS pms_arch');await p.query('DROP DATABASE IF EXISTS pms_ship_bootcheck');
console.log('  dropped');await p.end();})();"
rm -f local-test-env/bundle.json local-test-env/shore.log
echo "== done. 'bash local-test-env/up.sh' rebuilds from zero. =="
