@echo off
REM ============================================================
REM SAIL PMS — Ship Server Startup Script (Windows)
REM Place this in the deploy folder and run to start the server
REM ============================================================

echo.
echo ========================================
echo  SAIL PMS - Ship Server Starting...
echo ========================================
echo.

REM Check if .env exists
if not exist .env (
    echo ERROR: .env file not found!
    echo.
    echo Please copy .env.template to .env and edit with correct values:
    echo   copy .env.template .env
    echo   notepad .env
    echo.
    pause
    exit /b 1
)

REM Load environment variables from .env (skip comments and blank lines)
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    REM Skip lines starting with #
    echo %%a | findstr /r "^#" >nul 2>&1
    if errorlevel 1 (
        if not "%%a"=="" (
            set "%%a=%%b"
        )
    )
)

REM Check required variables
if "%DATABASE_URL%"=="" (
    echo ERROR: DATABASE_URL not set in .env
    echo Edit .env and set your PostgreSQL connection string.
    pause
    exit /b 1
)

REM ── Ship identity (MANDATORY) ─────────────────────────────────
REM The server refuses to boot without a valid instance id, and field
REM logs stamped with a placeholder are invisible to sync. NEVER default.
REM DB sync_settings.instance_id is the source of truth; .env is fallback.
if "%SYNC_INSTANCE_ID%"=="" goto :prompt_instance_id
if /I "%SYNC_INSTANCE_ID%"=="UNKNOWN" goto :prompt_instance_id
if /I "%SYNC_INSTANCE_ID%"=="SHIP-VESSELNAME" goto :prompt_instance_id
goto :instance_id_ok

:prompt_instance_id
echo.
echo ========================================================
echo  SHIP IDENTITY REQUIRED (first-run setup)
echo ========================================================
echo This ship has no valid sync instance id yet.
echo Format: SHIP-CODE  (letters/digits/dashes, e.g. SHIP-WAHKWONG-V003)
echo.
set "SYNC_INSTANCE_ID="
set /p SYNC_INSTANCE_ID="Enter this ship's instance id: "
if "%SYNC_INSTANCE_ID%"=="" goto :instance_id_fail
if /I "%SYNC_INSTANCE_ID%"=="UNKNOWN" goto :instance_id_fail
if /I "%SYNC_INSTANCE_ID%"=="SHIP-VESSELNAME" goto :instance_id_fail
if /I not "%SYNC_INSTANCE_ID:~0,5%"=="SHIP-" goto :instance_id_fail
if not "%SYNC_INSTANCE_ID%"=="%SYNC_INSTANCE_ID: =%" goto :instance_id_fail
REM Persist to .env (appended line wins — the loader takes the last value)
echo SYNC_INSTANCE_ID=%SYNC_INSTANCE_ID%>>.env
echo Saved SYNC_INSTANCE_ID=%SYNC_INSTANCE_ID% to .env
REM Best-effort: also write the DB row (source of truth). Fresh DBs may not
REM have sync_settings yet (created by first-boot migrations) - that is OK,
REM the .env value carries the id and the DB row can be set on the next run.
where psql >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    psql "%DATABASE_URL%" -c "UPDATE sync_settings SET setting_value='%SYNC_INSTANCE_ID%' WHERE setting_key='instance_id'" >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo DB row sync_settings.instance_id updated.
    ) else (
        echo NOTE: could not write DB row yet ^(fresh DB?^) - .env value will be used.
    )
) else (
    echo NOTE: psql not found - DB row not written; .env value will be used.
    echo       To make the DB the source of truth later, run:
    echo       UPDATE sync_settings SET setting_value='%SYNC_INSTANCE_ID%' WHERE setting_key='instance_id';
)
goto :instance_id_ok

:instance_id_fail
echo.
echo ========================================================
echo  FATAL: INVALID OR MISSING SHIP INSTANCE ID
echo ========================================================
echo The id must start with SHIP- and must not be a placeholder
echo ^(UNKNOWN / SHIP-VESSELNAME^) or contain spaces.
echo Fix: edit .env and set  SYNC_INSTANCE_ID=SHIP-YOURCODE
echo ^(or set sync_settings.instance_id in the database^), then rerun.
echo The server will NOT start without a valid identity.
pause
exit /b 1

:instance_id_ok

REM Check if node_modules exists
if not exist node_modules (
    echo [Setup] Installing dependencies (first run)...
    call npm install --omit=dev
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: npm install failed!
        echo Check that Node.js is installed and internet is available.
        pause
        exit /b 1
    )
)

REM Check if migrations folder exists
if not exist migrations (
    echo ERROR: migrations\ folder not found!
    echo The migrations folder must be in the same directory as dist\
    echo Re-run the build-ship-deploy script on the development machine.
    pause
    exit /b 1
)

REM Check if dist folder exists
if not exist dist\index.js (
    echo ERROR: dist\index.js not found!
    echo Re-run the build-ship-deploy script on the development machine.
    pause
    exit /b 1
)

echo.
echo Configuration:
echo   DATABASE_URL: %DATABASE_URL:~0,40%...
echo   SYNC_INSTANCE_ID: %SYNC_INSTANCE_ID%
echo   SYNC_SHORE_URL: %SYNC_SHORE_URL%
echo   NODE_ENV: %NODE_ENV%
echo   PORT: %PORT%
echo.
echo Starting server...
echo Press Ctrl+C to stop.
echo.

node dist/index.js
