#!/usr/bin/env bash
# Phase 0 (multi-tenant seam) CI guard.
#
# All DB access MUST go through the lazy accessors getDb() / getPool() / getPostgresClient()
# from server/db.ts + server/postgresClient.ts. Importing the eager module-level `db` / `pool`
# singletons (exported, @deprecated, from server/db.ts) bypasses the AsyncLocalStorage
# tenant-aware seam introduced in later multi-tenant phases — so it must be zero.
#
# Fails (exit 1) if any `import { ... db ... }` or `import { ... pool ... }` from a `.../db`
# module is found in server/ or scripts/. Run: bash scripts/check-direct-db-imports.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Match `import { ... db ... } from '<...>/db'` / `... pool ...`, excluding the lazy helpers.
PATTERN="import[[:space:]]*\{[^}]*\b(db|pool)\b[^}]*\}[[:space:]]*from[[:space:]]*['\"][^'\"]*/db['\"]"

HITS="$(grep -rnE "$PATTERN" server/ scripts/ --include='*.ts' 2>/dev/null \
        | grep -vE '\b(getDb|getPool)\b' || true)"

if [ -n "$HITS" ]; then
  echo "❌ Direct db/pool imports found — use getDb() / getPool() instead:"
  echo "$HITS"
  exit 1
fi

echo "✅ No direct db/pool imports (server/ + scripts/)."
