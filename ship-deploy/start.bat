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

if "%SYNC_INSTANCE_ID%"=="" (
    echo WARNING: SYNC_INSTANCE_ID not set in .env. Defaulting to UNKNOWN.
    set "SYNC_INSTANCE_ID=UNKNOWN"
)

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
