# Ship-Shore Sync — Deployment Guide

> **Version:** 1.0  
> **Last Updated:** 2026-04-25  
> **Audience:** DevOps, backend developers, system administrators

---

## 1. Prerequisites

### Software Requirements

| Component | Version | Notes |
|-----------|---------|-------|
| Node.js | v22+ | LTS recommended |
| PostgreSQL | 14+ | One instance per server (ship or shore) |
| npm | 10+ | Bundled with Node.js |
| Git | 2.30+ | For deployment |

### Network Requirements

| Direction | Port | Protocol | Notes |
|-----------|------|----------|-------|
| Ship → Shore | 443 (or custom) | HTTPS / JSON | Sync API calls |
| Shore → Ship | — | — | Shore never initiates connections to ship |
| Both | 5000 | HTTP | Local dev server port |

### Database

Both ship and shore servers connect to their own PostgreSQL instance. The schema is identical — the same migration system runs on both sides.

```
Shore: postgres://user:pass@shore-db-host:5432/pms
Ship:  postgres://user:pass@localhost:5432/pms
```

---

## 2. Shore Server Setup

The shore server manages the fleet. It is the authoritative source for ONE_WAY_SHORE_TO_SHIP tables and receives data from all ship servers.

### 2.1 Environment Variables

Create a `.env` file or set environment variables:

```bash
# Database
DATABASE_URL="postgres://user:password@shore-db-host:5432/pms"

# Server
NODE_ENV=production
PORT=5000

# Sync Identity — MUST start with "SHORE-"
SYNC_INSTANCE_ID=SHORE-PROD

# Sync Config
SYNC_LOCAL_MODE=false
SYNC_API_KEY=<generate-a-strong-random-key>

# External dependency (required)
EXTERNAL_MASTER_DATA_URL_DEV=http://sailerp-host:port

# Optional: Pruning overrides
# SYNC_PRUNE_FIELD_LOG_DAYS=90
# SYNC_PRUNE_BATCH_DAYS=365
# SYNC_PRUNE_FILE_QUEUE_DAYS=90
# SYNC_PRUNE_CONFLICT_DAYS=180
```

### 2.2 Installation & Start

```bash
# Clone and install
git clone <repo-url> && cd TechnicalMoudle
npm install

# Run database migrations (automatic on server start)
# Start the server
DATABASE_URL="postgres://..." \
SYNC_INSTANCE_ID="SHORE-PROD" \
SYNC_API_KEY="your-api-key" \
EXTERNAL_MASTER_DATA_URL_DEV="http://sailerp-host:port" \
NODE_ENV=production npx tsx server/index.ts
```

### 2.3 Post-Start Verification

After the server starts, verify:

```bash
# Check instance identity
curl http://shore-host:5000/technical/api/sync/instance-info
# Expected: { "instanceId": "SHORE-PROD", "isShore": true, "isShip": false, "instanceType": "shore" }

# Check health
curl http://shore-host:5000/technical/api/sync/health
# Expected: { "status": "healthy", "checks": {...} }

# Check sync settings loaded from DB
# (Open browser) → Admin → Fleet Overview → Settings panel
```

### 2.4 Configure Sync Settings via UI

Navigate to **Admin → Fleet Overview** (shore-only page):
1. Expand the **Settings** panel
2. Set `shore_url` to this server's externally accessible URL (e.g., `https://pms-shore.example.com/technical/api`)
3. Set `instance_id` to `SHORE-PROD`
4. Set `local_mode` to `false` for production
5. Click **Save Settings**

---

## 3. Ship Server Setup

Each ship gets its own server instance with its own PostgreSQL database. The ship server operates independently and syncs with shore when connectivity is available.

### 3.1 Environment Variables

```bash
# Database (local to ship)
DATABASE_URL="postgres://postgres:password@localhost:5432/pms"

# Server
NODE_ENV=production
PORT=5000

# Sync Identity — MUST start with "SHIP-"
SYNC_INSTANCE_ID=SHIP-VESSELNAME

# Sync Config — point to shore server
SYNC_SHORE_URL=https://pms-shore.example.com/technical/api
SYNC_API_KEY=<same-key-as-shore>
SYNC_LOCAL_MODE=false

# External dependency
EXTERNAL_MASTER_DATA_URL_DEV=http://sailerp-host:port
```

### 3.2 Initial Provisioning

Before the ship server can operate, it needs initial data from shore.

#### Option A: Via Admin UI (Recommended)

1. **On Shore:** Navigate to **Admin → Ship Provisioning**
2. Select the target vessel from the dropdown
3. Click **Preview Manifest** to verify table counts
4. Click **Generate & Download** — saves a JSON file
5. Transfer the JSON file to the ship server (USB, email, etc.)
6. **On Ship:** Navigate to **Admin → Ship Provisioning**
7. Click **Import** and upload the JSON file
8. Click **Verify** to confirm all data imported correctly

#### Option B: Via API

```bash
# On shore: Generate bundle
curl -X POST http://shore:5000/technical/api/sync/provision/VESSEL_UUID \
  -H "Content-Type: application/json" \
  -H "x-role: Sail Admin" \
  > provision_bundle.json

# Transfer file to ship...

# On ship: Import bundle
curl -X POST http://localhost:5000/technical/api/sync/provision/import \
  -H "Content-Type: application/json" \
  -H "x-role: Offline Admin" \
  -d @provision_bundle.json

# On ship: Verify
curl -X POST http://localhost:5000/technical/api/sync/provision/verify \
  -H "Content-Type: application/json" \
  -H "x-role: Offline Admin" \
  -d @provision_manifest.json
```

### 3.3 Post-Provisioning Verification

```bash
# Check instance identity
curl http://localhost:5000/technical/api/sync/instance-info
# Expected: { "instanceId": "SHIP-VESSELNAME", "isShip": true, "isShore": false, "instanceType": "ship" }

# Test connection to shore
curl -X POST http://localhost:5000/technical/api/sync/settings/test-connection \
  -H "Content-Type: application/json" \
  -H "x-role: Sail Admin" \
  -d '{"shoreUrl": "https://pms-shore.example.com/technical/api"}'
# Expected: { "connected": true, "latencyMs": 250, ... }
```

### 3.4 First Sync

```bash
# Trigger manual sync
curl -X POST http://localhost:5000/technical/api/sync/trigger \
  -H "Content-Type: application/json" \
  -d '{"vesselId": "VESSEL_UUID"}'
```

Or via the **Admin → Sync Dashboard** UI: click the **Sync Now** button.

---

## 4. Testing Setup — Two Local Servers

For development and testing, run both shore and ship servers on the same machine using different ports and databases.

### 4.1 Database Setup

Create two PostgreSQL databases:

```sql
CREATE DATABASE pms_shore;
CREATE DATABASE pms_ship;
```

### 4.2 Shore Server (Terminal 1)

```bash
DATABASE_URL="postgres://postgres:admin123@localhost:5432/pms_shore" \
SYNC_INSTANCE_ID="SHORE-DEV" \
SYNC_LOCAL_MODE=false \
SYNC_API_KEY="test-api-key-12345" \
EXTERNAL_MASTER_DATA_URL_DEV=http://localhost:9999 \
NODE_ENV=development \
PORT=5000 \
npx tsx server/index.ts
```

### 4.3 Ship Server (Terminal 2)

```bash
DATABASE_URL="postgres://postgres:admin123@localhost:5432/pms_ship" \
SYNC_INSTANCE_ID="SHIP-TESTVESSEL" \
SYNC_SHORE_URL="http://localhost:5000/technical/api" \
SYNC_LOCAL_MODE=false \
SYNC_API_KEY="test-api-key-12345" \
EXTERNAL_MASTER_DATA_URL_DEV=http://localhost:9999 \
NODE_ENV=development \
PORT=5001 \
npx tsx server/index.ts
```

### 4.4 Provision the Ship DB

```bash
# Generate bundle from shore
curl -X GET http://localhost:5000/technical/api/sync/provision/download/VESSEL_UUID \
  -H "x-role: Sail Admin" \
  -o provision.json

# Import on ship
curl -X POST http://localhost:5001/technical/api/sync/provision/import \
  -H "Content-Type: application/json" \
  -H "x-role: Offline Admin" \
  -d @provision.json
```

### 4.5 Test a Sync Cycle

```bash
# Trigger sync from ship
curl -X POST http://localhost:5001/technical/api/sync/trigger \
  -H "Content-Type: application/json" \
  -d '{"vesselId": "VESSEL_UUID"}'
```

### 4.6 Local Mode (Single Server)

For simpler development, use local mode on a single server. The `SyncEngine` calls service functions directly instead of making HTTP calls.

```bash
DATABASE_URL="postgres://postgres:admin123@localhost:5432/pms" \
SYNC_INSTANCE_ID="SHORE-DEV" \
SYNC_LOCAL_MODE=true \
EXTERNAL_MASTER_DATA_URL_DEV=http://localhost:9999 \
NODE_ENV=development \
npx tsx server/index.ts
```

In local mode, the `callSyncApi` method in `syncEngine.ts` routes to `callLocalSync` which directly calls `service.ts` functions:
- `/sync/initiate` → `svc.initiateSyncSession()`
- `/sync/push` → `svc.receivePushData()`
- `/sync/pull` → `svc.preparePullData()`
- `/sync/complete` → `svc.completeSyncSession()`

---

## 5. Safe Lanes Team Testing Guide

### Testing Roles

| Person | Focus Area |
|--------|-----------|
| Jeevan Naik | PMS domain: components, jobs, work orders, spares |
| Rahul Singh Sisodiya | Defects, change requests, certificates/surveys |
| Sahil Puri | Noon reports, stores, IHM, fleet admin |

### Test Environments

1. **Local Development:** Single machine, `SYNC_LOCAL_MODE=true`
2. **Two-Server Test:** Two terminals with separate DBs (see Section 4)
3. **Staging:** Deployed shore + simulated ship

### Quick Verification Checklist

- [ ] `GET /sync/instance-info` returns correct `instanceType`
- [ ] `GET /sync/health` returns `healthy` status
- [ ] `GET /sync/table-stats` shows table row counts
- [ ] Shore → Fleet Overview page loads and shows vessels
- [ ] Ship → Fleet Overview menu item is hidden
- [ ] Provisioning bundle generates with correct row counts
- [ ] Sync trigger completes without errors
- [ ] Field changes on shore appear on ship after sync
- [ ] Field changes on ship appear on shore after sync
- [ ] Conflicting edits create `sync_conflicts` entries
- [ ] Conflicts can be resolved via UI (ship_wins / shore_wins)

---

## 6. Troubleshooting

### Server Won't Start

**Error:** `EADDRINUSE: address already in use 0.0.0.0:5000`
- Another process is using port 5000
- Find and kill: `netstat -ano | findstr :5000` then `taskkill /PID <pid> /F` (Windows)
- Or: `lsof -i :5000` then `kill -9 <pid>` (Linux/Mac)

**Error:** `[StorageFactory] DATABASE_URL not found`
- `DATABASE_URL` environment variable is not set
- Must pass it as an env prefix before the command, not in `.env` (dotenv not loaded before config imports)

### Sync Failures

**"Sync API 404"** or HTML response instead of JSON
- `SYNC_SHORE_URL` is incorrect or missing `/technical/api` prefix
- Shore server is not running or not on expected port

**"Batch X is completed/failed, not in_progress"**
- Stale batch reference — the batch was already completed or failed
- Trigger a new sync cycle

**"Failed to initiate sync session" (503)**
- Database pool not initialized yet
- Wait for server to complete startup (look for "✅ Database already initialized" in logs)

### Provisioning Issues

**Bundle too large (>100MB JSON)**
- Vessel has extensive historical data
- Consider pruning old data before provisioning
- Or split provisioning into phases (global first, then vessel-specific)

**Import shows many errors**
- Check for schema mismatches between shore and ship (both should run same code version)
- Ensure migrations completed on ship (`✅ Drizzle SQL migrations complete` in logs)

### Health Check Warnings

**"No successful sync in the last 48 hours"**
- Ship may be offline (expected for vessels at sea)
- Or sync is failing — check batch history for errors

**"X unresolved conflict(s) older than 7 days"**
- Navigate to Sync Dashboard → Conflicts section
- Resolve conflicts using ship_wins / shore_wins / manual

**"X file transfer(s) stuck"**
- File may have been deleted from source after queuing
- Check `sync_file_queue` for error messages
- Run pruning to clean up permanently stuck entries

### Pruning

**Manual prune:**
```bash
curl -X POST http://localhost:5000/technical/api/sync/prune \
  -H "Content-Type: application/json" \
  -H "x-role: Sail Admin" \
  -d '{"fieldLogDays": 30, "batchDays": 180}'
```

**Check what would be pruned (use very high retention to see counts without deleting):**
```bash
curl -X POST http://localhost:5000/technical/api/sync/prune \
  -H "Content-Type: application/json" \
  -H "x-role: Sail Admin" \
  -d '{"fieldLogDays": 99999}'
```

---

## 7. SAILERP Integration Notes

### Platform-Provisioned Data

The following tables are managed by the SAILERP platform, NOT by the PMS sync engine:

| Table | Notes |
|-------|-------|
| `users` | User accounts provisioned by SAILERP |
| `master_users` | Master user registry |
| `vessels` | Vessel registry |
| `fleets` | Fleet definitions |
| `vessel_types` | Vessel type classifications |
| `additional_groups` | Organizational groups |
| `ports` | Port registry |
| `locations` | Storage locations per vessel |

These tables are classified as `NO_SYNC` in `shared/syncConfig.ts`. They must be provisioned separately on each ship server, typically during initial ship deployment or via a separate SAILERP provisioning process.

### Provisioning Bundle & SAILERP

The PMS provisioning bundle (`/sync/provision/:vesselId`) includes PMS data only. SAILERP data (users, vessels, etc.) must be provisioned through SAILERP's own mechanisms.

However, the provisioning bundle **does include the vessel's own row** from the `vessels` table as a convenience (labeled `IDENTITY (vessel self)` in the manifest), since the ship needs to know its own identity.

### Authentication

The current implementation uses mock authentication for development. In production with SAILERP integration:
- Authentication will be handled by SAILERP's auth service
- The `x-role` header will be replaced by JWT/session-based auth
- The `requireOfflineAdmin` middleware checks `req.user.role` which must be set by the auth layer

### API Key for Sync

The `SYNC_API_KEY` environment variable must match between ship and shore servers. It is sent as the `X-Sync-Api-Key` HTTP header on every sync API call. In production, this should be a strong random string rotated periodically.
