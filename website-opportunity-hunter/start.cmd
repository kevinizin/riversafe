@echo off
REM ===========================================================================
REM  Website Opportunity Hunter - double-click launcher for Windows.
REM
REM  Brings the dashboard up from a cold machine: installs dependencies if they
REM  are missing, builds once, starts the server and opens the browser when the
REM  port actually answers.
REM
REM  Closing this window stops the server. That is deliberate: a background
REM  server nobody can see is a server nobody remembers to stop.
REM ===========================================================================

setlocal
chcp 65001 >nul 2>nul
title Website Opportunity Hunter

REM Run from the folder this file lives in, whatever the current directory is.
cd /d "%~dp0"

set "PORT=3000"
set "URL=http://localhost:%PORT%"

echo.
echo   Website Opportunity Hunter
echo   ==========================
echo.

REM --- Already running? Just show it. ---------------------------------------
call :PortOpen
if not errorlevel 1 (
    echo   Already running. Opening %URL%
    start "" "%URL%"
    timeout /t 2 >nul
    exit /b 0
)

REM --- Node ------------------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
    echo   Node.js is not installed, or not on the PATH.
    echo.
    echo   Install the LTS build from https://nodejs.org, then open a NEW
    echo   terminal window and run this file again.
    echo.
    pause
    exit /b 1
)

REM --- Configuration ---------------------------------------------------------
if not exist ".env" (
    echo   No .env file yet, so the app does not know which database to use.
    echo.
    echo   Run this once in a terminal here:  npm run setup
    echo.
    pause
    exit /b 1
)

REM --- Dependencies, migrations and build ------------------------------------
REM One script, shared with start.sh, so the two launchers cannot drift. It
REM installs if needed, applies pending migrations, and rebuilds when the code
REM has changed since the last build -- which is what makes a git pull actually
REM show up instead of serving the previous build.
call node scripts\prepare.mjs
if errorlevel 1 goto :Failed

REM --- Open the browser once the port answers --------------------------------
REM Detached, so it can wait while the server takes over this window.
start "" /min powershell -NoProfile -ExecutionPolicy Bypass -Command "for($i=0; $i -lt 90; $i++){ try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', %PORT%); $c.Close(); Start-Process '%URL%'; break } catch { Start-Sleep -Seconds 1 } }"

echo   Starting the server. This window keeps it running.
echo   Close it, or press Ctrl+C, to stop.
echo.
echo   %URL%
echo.

call npm start
if errorlevel 1 goto :Failed

exit /b 0

REM --- Helpers ---------------------------------------------------------------

:PortOpen
REM Sets errorlevel 0 when something is already listening on %PORT%.
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', %PORT%); $c.Close(); exit 0 } catch { exit 1 }"
exit /b %errorlevel%

:Failed
echo.
echo   Something failed above. The message just before this line says what.
echo.
echo   If the database is unreachable, check that PostgreSQL is running:
echo       sc query postgresql-x64-16
echo.
pause
exit /b 1
