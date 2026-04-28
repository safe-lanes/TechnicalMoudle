@echo off
REM ============================================================
REM SAIL PMS — Ship Deployment Package Builder (Windows)
REM Run this on the development machine to create a deploy package
REM ============================================================

echo.
echo ========================================
echo  SAIL PMS - Building Ship Deploy Package
echo ========================================
echo.

REM Step 1: Build the application
echo [1/5] Building application...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Build failed!
    exit /b 1
)

REM Step 2: Create deploy folder
echo [2/5] Creating deploy folder...
if exist ship-deploy rmdir /s /q ship-deploy
mkdir ship-deploy

REM Step 3: Copy dist (compiled server + client)
echo [3/5] Copying dist folder...
xcopy /s /e /i /q dist ship-deploy\dist

REM Step 4: Copy migrations (required at runtime — migration runner reads SQL from process.cwd()/migrations/)
echo [4/5] Copying migrations...
xcopy /s /e /i /q migrations ship-deploy\migrations

REM Step 5: Copy package files
echo [5/5] Copying package files...
copy package.json ship-deploy\
copy package-lock.json ship-deploy\

REM Create .env template
(
echo # SAIL PMS — Ship Server Configuration
echo # Copy this file to .env and fill in the values
echo.
echo # PostgreSQL connection string
echo DATABASE_URL=postgres://postgres:PASSWORD@localhost:5432/pms_ship
echo.
echo # Unique identifier for this ship instance (e.g., SHIP-WAHKWONG-V003)
echo SYNC_INSTANCE_ID=SHIP-VESSELNAME
echo.
echo # Shore server URL for sync
echo SYNC_SHORE_URL=https://shore-server.com/technical/api
echo.
echo # Set to true to disable sync and run fully offline
echo SYNC_LOCAL_MODE=false
echo.
echo # Server environment
echo NODE_ENV=production
echo.
echo # Server port
echo PORT=5000
echo.
echo # External master data URL (can be dummy for ship-only mode)
echo EXTERNAL_MASTER_DATA_URL_DEV=http://localhost:9999
) > ship-deploy\.env.template

REM Copy startup scripts
copy scripts\start-ship.bat ship-deploy\start.bat
copy scripts\install-ship-service.bat ship-deploy\install-service.bat

REM Copy README
copy scripts\SHIP-DEPLOY-README.md ship-deploy\README.md

echo.
echo ========================================
echo  Deploy package ready: ship-deploy\
echo ========================================
echo.
echo Next steps:
echo   1. Copy ship-deploy\ folder to the ship server
echo   2. On the ship server:
echo      cd ship-deploy
echo      npm install --production
echo      copy .env.template .env
echo      notepad .env  (edit with correct values)
echo      start.bat
echo.
pause
