@echo off
REM ============================================================
REM SAIL PMS — Install as Windows Service using PM2
REM Run this ONCE after deploy to make PMS start automatically
REM Requires: Node.js installed globally
REM ============================================================

echo.
echo ========================================
echo  SAIL PMS - Installing as Windows Service
echo ========================================
echo.

REM Check if .env exists
if not exist .env (
    echo ERROR: .env not found!
    echo Run start.bat first to verify your setup works before installing as a service.
    pause
    exit /b 1
)

REM Check if dist exists
if not exist dist\index.js (
    echo ERROR: dist\index.js not found!
    echo Deploy package is incomplete. Re-run the build script.
    pause
    exit /b 1
)

REM Check if PM2 is installed
where pm2 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [Setup] Installing PM2 globally...
    call npm install -g pm2
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to install PM2!
        pause
        exit /b 1
    )
    echo [Setup] Installing PM2 Windows startup module...
    call npm install -g pm2-windows-startup
    if %ERRORLEVEL% NEQ 0 (
        echo WARNING: pm2-windows-startup failed to install.
        echo The service will work but may not auto-start on boot.
    )
)

REM Load .env so PM2 process inherits environment variables
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    echo %%a | findstr /r "^#" >nul 2>&1
    if errorlevel 1 (
        if not "%%a"=="" (
            set "%%a=%%b"
        )
    )
)

REM ── Ship identity (MANDATORY provisioning step) ────────────────
REM A ship cannot be brought up without a real identity. The server refuses
REM to boot on a missing/placeholder id, and field logs stamped with a
REM placeholder are invisible to sync or collide across ships.
REM DB sync_settings.instance_id is the source of truth; .env is fallback.
if "%SYNC_INSTANCE_ID%"=="" goto :svc_prompt_id
if /I "%SYNC_INSTANCE_ID%"=="UNKNOWN" goto :svc_prompt_id
if /I "%SYNC_INSTANCE_ID%"=="SHIP-VESSELNAME" goto :svc_prompt_id
goto :svc_id_ok

:svc_prompt_id
echo.
echo ========================================================
echo  SHIP IDENTITY REQUIRED (provisioning)
echo ========================================================
echo This installation has no valid sync instance id yet.
echo Format: SHIP-CODE  (letters/digits/dashes, e.g. SHIP-WAHKWONG-V003)
echo.
set "SYNC_INSTANCE_ID="
set /p SYNC_INSTANCE_ID="Enter this ship's instance id: "
if "%SYNC_INSTANCE_ID%"=="" goto :svc_id_fail
if /I "%SYNC_INSTANCE_ID%"=="UNKNOWN" goto :svc_id_fail
if /I "%SYNC_INSTANCE_ID%"=="SHIP-VESSELNAME" goto :svc_id_fail
if /I not "%SYNC_INSTANCE_ID:~0,5%"=="SHIP-" goto :svc_id_fail
if not "%SYNC_INSTANCE_ID%"=="%SYNC_INSTANCE_ID: =%" goto :svc_id_fail
REM Persist to .env (appended line wins — the loader takes the last value)
echo SYNC_INSTANCE_ID=%SYNC_INSTANCE_ID%>>.env
echo Saved SYNC_INSTANCE_ID=%SYNC_INSTANCE_ID% to .env

:svc_id_ok
REM Write/refresh the DB row (source of truth) — best-effort: the value in
REM .env keeps the boot working if psql is unavailable or the DB is fresh.
where psql >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    psql "%DATABASE_URL%" -c "UPDATE sync_settings SET setting_value='%SYNC_INSTANCE_ID%' WHERE setting_key='instance_id'" >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo DB row sync_settings.instance_id = %SYNC_INSTANCE_ID% ^(source of truth^).
    ) else (
        echo NOTE: could not write DB row ^(fresh DB?^) - .env value will be used.
        echo       Set it later: UPDATE sync_settings SET setting_value='%SYNC_INSTANCE_ID%' WHERE setting_key='instance_id';
    )
) else (
    echo NOTE: psql not found - DB row not written; .env value will be used.
    echo       Set it later: UPDATE sync_settings SET setting_value='%SYNC_INSTANCE_ID%' WHERE setting_key='instance_id';
)
goto :svc_continue

:svc_id_fail
echo.
echo ========================================================
echo  FATAL: INVALID OR MISSING SHIP INSTANCE ID
echo ========================================================
echo The id must start with SHIP- and must not be a placeholder
echo ^(UNKNOWN / SHIP-VESSELNAME^) or contain spaces.
echo Installation REFUSED - a ship cannot be provisioned without identity.
echo Rerun this installer and provide a valid id.
pause
exit /b 1

:svc_continue
REM Stop existing instance if running
pm2 delete SAIL-PMS >nul 2>&1

REM Start with PM2
echo Starting SAIL PMS with PM2...
pm2 start dist\index.js --name "SAIL-PMS" --cwd "%CD%"
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: PM2 failed to start the application!
    pause
    exit /b 1
)

REM Save PM2 process list (so it survives pm2 resurrect)
pm2 save

REM Install PM2 startup (auto-start on Windows boot)
echo.
echo Installing auto-start on boot...
pm2-startup install >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo NOTE: Auto-start on boot requires pm2-windows-startup.
    echo Run manually: npm install -g pm2-windows-startup
    echo Then: pm2-startup install
)

echo.
echo ========================================
echo  SAIL PMS installed as Windows service
echo ========================================
echo.
echo Commands:
echo   pm2 status             - Check if running
echo   pm2 logs SAIL-PMS      - View logs (live)
echo   pm2 logs SAIL-PMS --lines 100  - View last 100 lines
echo   pm2 restart SAIL-PMS   - Restart server
echo   pm2 stop SAIL-PMS      - Stop server
echo   pm2 delete SAIL-PMS    - Remove from PM2
echo.
echo Log files:
echo   %%USERPROFILE%%\.pm2\logs\SAIL-PMS-out.log   (stdout)
echo   %%USERPROFILE%%\.pm2\logs\SAIL-PMS-error.log (stderr)
echo.
pause
