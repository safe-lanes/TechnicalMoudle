#!/bin/bash
# ============================================================
# SAIL PMS — Ship Deployment Package Builder (Linux/Mac)
# Run this on the development machine to create a deploy package
# ============================================================

set -e

echo ""
echo "========================================"
echo " SAIL PMS - Building Ship Deploy Package"
echo "========================================"
echo ""

# Step 1: Build
echo "[1/5] Building application..."
npm run build

# Step 2: Create deploy folder
echo "[2/5] Creating deploy folder..."
rm -rf ship-deploy
mkdir -p ship-deploy

# Step 3: Copy dist
echo "[3/5] Copying dist folder..."
cp -r dist/ ship-deploy/dist/

# Step 4: Copy migrations (required at runtime — migration runner reads SQL from process.cwd()/migrations/)
echo "[4/5] Copying migrations..."
cp -r migrations/ ship-deploy/migrations/

# Step 5: Copy package files
echo "[5/5] Copying package files..."
cp package.json ship-deploy/
cp package-lock.json ship-deploy/

# Create .env template
cat > ship-deploy/.env.template << 'ENVEOF'
# SAIL PMS — Ship Server Configuration
# Copy this file to .env and fill in the values

# PostgreSQL connection string
DATABASE_URL=postgres://postgres:PASSWORD@localhost:5432/pms_ship

# Unique identifier for this ship instance (e.g., SHIP-WAHKWONG-V003)
SYNC_INSTANCE_ID=SHIP-VESSELNAME

# Shore server URL for sync
SYNC_SHORE_URL=https://shore-server.com/technical/api

# Set to true to disable sync and run fully offline
SYNC_LOCAL_MODE=false

# Server environment
NODE_ENV=production

# Server port
PORT=5000

# External master data URL (can be dummy for ship-only mode)
EXTERNAL_MASTER_DATA_URL_DEV=http://localhost:9999
ENVEOF

# Copy startup scripts
cp scripts/start-ship.sh ship-deploy/start.sh
chmod +x ship-deploy/start.sh

# Copy README
cp scripts/SHIP-DEPLOY-README.md ship-deploy/README.md

echo ""
echo "========================================"
echo " Deploy package ready: ship-deploy/"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Copy ship-deploy/ folder to the ship server"
echo "  2. On the ship server:"
echo "     cd ship-deploy"
echo "     npm install --production"
echo "     cp .env.template .env"
echo "     nano .env  (edit with correct values)"
echo "     ./start.sh"
echo ""
