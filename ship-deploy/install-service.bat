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
