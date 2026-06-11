#!/bin/bash
# ============================================================
# SAIL PMS — Ship Server Startup Script (Linux)
# Place this in the deploy folder and run to start the server
# ============================================================

set -e

echo ""
echo "========================================"
echo " SAIL PMS - Ship Server Starting..."
echo "========================================"
echo ""

# Check .env exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo ""
    echo "Please copy .env.template to .env and edit with correct values:"
    echo "  cp .env.template .env"
    echo "  nano .env"
    exit 1
fi

# Load .env (skip comments and blank lines)
set -a
while IFS='=' read -r key value; do
    # Skip comments and blank lines
    [[ "$key" =~ ^#.*$ ]] && continue
    [[ -z "$key" ]] && continue
    # Trim whitespace
    key=$(echo "$key" | xargs)
    value=$(echo "$value" | xargs)
    export "$key=$value"
done < .env
set +a

# Check required variables
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL not set in .env"
    echo "Edit .env and set your PostgreSQL connection string."
    exit 1
fi

# ── Ship identity (MANDATORY) ─────────────────────────────────
# The server refuses to boot without a valid instance id, and field logs
# stamped with a placeholder are invisible to sync. NEVER default.
# DB sync_settings.instance_id is the source of truth; .env is fallback.
is_valid_instance_id() {
    [[ "$1" =~ ^SHIP-[A-Za-z0-9-]+$ ]] || return 1
    local upper; upper=$(echo "$1" | tr '[:lower:]' '[:upper:]')
    [ "$upper" != "UNKNOWN" ] && [ "$upper" != "SHIP-VESSELNAME" ]
}
if ! is_valid_instance_id "${SYNC_INSTANCE_ID:-}"; then
    echo ""
    echo "========================================================"
    echo " SHIP IDENTITY REQUIRED (first-run setup)"
    echo "========================================================"
    echo "This ship has no valid sync instance id yet."
    echo "Format: SHIP-CODE  (letters/digits/dashes, e.g. SHIP-WAHKWONG-V003)"
    echo ""
    read -r -p "Enter this ship's instance id: " SYNC_INSTANCE_ID
    if ! is_valid_instance_id "${SYNC_INSTANCE_ID:-}"; then
        echo ""
        echo "FATAL: INVALID OR MISSING SHIP INSTANCE ID"
        echo "The id must match SHIP-<code> (letters/digits/dashes) and must not"
        echo "be a placeholder (UNKNOWN / SHIP-VESSELNAME)."
        echo "Fix: edit .env and set SYNC_INSTANCE_ID=SHIP-YOURCODE (or set"
        echo "sync_settings.instance_id in the database), then rerun."
        echo "The server will NOT start without a valid identity."
        exit 1
    fi
    export SYNC_INSTANCE_ID
    # Persist to .env (appended line wins — the loader takes the last value)
    echo "SYNC_INSTANCE_ID=$SYNC_INSTANCE_ID" >> .env
    echo "Saved SYNC_INSTANCE_ID=$SYNC_INSTANCE_ID to .env"
    # Best-effort: also write the DB row (source of truth). Fresh DBs may not
    # have sync_settings yet (created by first-boot migrations) — that is OK.
    if command -v psql >/dev/null 2>&1; then
        if psql "$DATABASE_URL" -c "UPDATE sync_settings SET setting_value='$SYNC_INSTANCE_ID' WHERE setting_key='instance_id'" >/dev/null 2>&1; then
            echo "DB row sync_settings.instance_id updated."
        else
            echo "NOTE: could not write DB row yet (fresh DB?) — .env value will be used."
        fi
    else
        echo "NOTE: psql not found — DB row not written; .env value will be used."
    fi
fi

# Check node_modules
if [ ! -d node_modules ]; then
    echo "[Setup] Installing dependencies (first run)..."
    npm install --omit=dev
fi

# Check migrations folder
if [ ! -d migrations ]; then
    echo "ERROR: migrations/ folder not found!"
    echo "The migrations folder must be in the same directory as dist/"
    echo "Re-run the build-ship-deploy script on the development machine."
    exit 1
fi

# Check dist
if [ ! -f dist/index.js ]; then
    echo "ERROR: dist/index.js not found!"
    echo "Re-run the build-ship-deploy script on the development machine."
    exit 1
fi

echo ""
echo "Configuration:"
echo "  DATABASE_URL: ${DATABASE_URL:0:40}..."
echo "  SYNC_INSTANCE_ID: $SYNC_INSTANCE_ID"
echo "  SYNC_SHORE_URL: $SYNC_SHORE_URL"
echo "  NODE_ENV: ${NODE_ENV:-production}"
echo "  PORT: ${PORT:-5000}"
echo ""
echo "Starting server..."
echo ""

exec node dist/index.js
