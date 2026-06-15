# SAIL PMS — Ship Server Deployment Guide

## Prerequisites

- **Node.js** v22+ (https://nodejs.org)
- **PostgreSQL** 14+ (https://www.postgresql.org/download/windows/)
- **Network**: VSAT or internet connection for initial sync (offline operation supported after provisioning)

## Quick Start (Windows)

### 1. Create the database

Open a command prompt and run:
```
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -c "CREATE DATABASE pms_ship;"
```

### 2. Configure environment

```
copy .env.template .env
notepad .env
```

Edit these values:
- `DATABASE_URL` — your PostgreSQL connection string (e.g., `postgres://postgres:yourpassword@localhost:5432/pms_ship`)
- `SYNC_INSTANCE_ID` — see step 3 (mandatory)
- `SYNC_SHORE_URL` — shore server URL (e.g., `https://pms.safelanes.com/technical/api`)

### 3. Assign the ship identity (MANDATORY)

Every ship needs a unique sync identity in the form `SHIP-<CODE>` (letters,
digits, dashes — e.g. `SHIP-WAHKWONG-V003`). **The server refuses to start
without one**, and placeholder values (`UNKNOWN`, the unedited
`SHIP-VESSELNAME` template) are rejected at boot.

Identity is stored in TWO places:
- **Database `sync_settings.instance_id` — the SOURCE OF TRUTH** (the
  field-logger and sync engine both read the DB value first)
- `.env` `SYNC_INSTANCE_ID` — the **fallback** (used until the DB row is set,
  e.g. on the very first boot before migrations have created `sync_settings`)

You do not normally set this by hand: **`start.bat` / `install-service.bat`
prompt for the id on first run**, validate it, write the `.env` line, and
write the database row (when `psql` is available). To set the DB row manually:
```
psql "<DATABASE_URL>" -c "UPDATE sync_settings SET setting_value='SHIP-YOURCODE' WHERE setting_key='instance_id'"
```
If two ships ever share the same id (e.g. a cloned image), the shore logs an
`INSTANCE-ID COLLISION` warning on every sync from them — give each ship a
unique id.

### 4. Start the server

```
start.bat
```

First start will:
- Install npm dependencies (~2 minutes)
- Run all database migrations (~1 minute)
- Create 110+ tables automatically
- Start the PMS server on port 5000

### 5. Import vessel data

1. Open browser: http://localhost:5000
2. Log in with the Offline Admin credentials
3. Go to **Admin → Ship Provisioning**
4. Click **Import Bundle** and upload the provisioning JSON file from shore
5. Click **Verify** to confirm all data imported correctly

### 6. First sync

1. Go to **Admin → Sync Dashboard**
2. Click **Sync Now**
3. Verify sync completes successfully

## Quick Start (Linux)

```bash
# Create database
sudo -u postgres psql -c "CREATE DATABASE pms_ship;"

# Configure
cp .env.template .env
nano .env

# Start
chmod +x start.sh
./start.sh
```

## Running as Windows Service (Auto-Start on Boot)

To make PMS start automatically when the ship server boots:

```
install-service.bat
```

This uses PM2 process manager. After installation:

| Command | Description |
|---------|-------------|
| `pm2 status` | Check if running |
| `pm2 logs SAIL-PMS` | View live logs |
| `pm2 logs SAIL-PMS --lines 100` | View last 100 log lines |
| `pm2 restart SAIL-PMS` | Restart after updates |
| `pm2 stop SAIL-PMS` | Stop the server |

## Updating the Ship Server

1. On the development machine, run `build-ship-deploy.bat` (or `.sh`)
2. Copy the new `ship-deploy/dist/` and `ship-deploy/migrations/` to the ship server
3. On the ship server:
   ```
   pm2 restart SAIL-PMS
   ```
   Or if not using PM2:
   ```
   start.bat
   ```

New migrations run automatically on startup — no manual migration step needed.

## Folder Structure

```
ship-deploy/
├── dist/               — Compiled server + client
│   ├── index.js        — Server bundle (Node.js)
│   └── public/         — Client build (HTML/JS/CSS)
├── migrations/         — Database migrations (129+ SQL files)
├── node_modules/       — Dependencies (created by npm install)
├── .env                — Your configuration (you create this)
├── .env.template       — Template for .env
├── start.bat           — Start the server (Windows)
├── start.sh            — Start the server (Linux)
├── install-service.bat — Install as Windows service (PM2)
├── package.json        — Node.js package info
├── package-lock.json   — Locked dependency versions
└── README.md           — This file
```

## Troubleshooting

### Server won't start

- **Check DATABASE_URL** in `.env` is correct
- **Check PostgreSQL is running**:
  ```
  "C:\Program Files\PostgreSQL\18\bin\pg_isready.exe"
  ```
- **Check port 5000 is not in use**:
  ```
  netstat -ano | findstr :5000
  ```

### Migration errors

- All migrations are idempotent — safe to re-run
- If a specific migration fails, check the server console output for the SQL error
- The migration number is shown in the error (e.g., `migration 097 failed`)

### Sync fails

- **Check SYNC_SHORE_URL** is correct and accessible from the ship
- Test connectivity: open `SYNC_SHORE_URL` in a browser — you should see an API response
- Check ship has internet/VSAT connectivity
- Go to **Admin → Sync Dashboard** for detailed error messages

### Provisioning import fails

- Ensure the JSON file was generated from the correct shore server version
- Check server console output for specific error messages
- Common cause: database already has data — the import skips duplicates via ON CONFLICT
- Try re-generating the bundle from shore if the ship database is empty

### Cannot log in

- Default shore credentials do not work on ship
- Use the **Offline Admin** account (created during provisioning)
- If no admin account exists, check `adm_role_menu_access` table has rows

### Port already in use

Kill the existing process:
```
netstat -ano | findstr :5000
taskkill /PID <pid> /F
```
