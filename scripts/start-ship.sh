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

if [ -z "$SYNC_INSTANCE_ID" ]; then
    echo "WARNING: SYNC_INSTANCE_ID not set in .env. Defaulting to UNKNOWN."
    export SYNC_INSTANCE_ID=UNKNOWN
fi

# Check node_modules
if [ ! -d node_modules ]; then
    echo "[Setup] Installing dependencies (first run)..."
    npm install --production
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
