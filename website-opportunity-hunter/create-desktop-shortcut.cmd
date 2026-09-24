@echo off
REM ===========================================================================
REM  Puts a "Website Opportunity Hunter" shortcut on the desktop.
REM
REM  Run once. The shortcut points at start.cmd in this folder, so moving or
REM  renaming the project folder means running this again.
REM
REM  Windows only by nature: macOS and Linux have no single equivalent of a
REM  .lnk file, so there is no twin of this script.
REM ===========================================================================

setlocal
chcp 65001 >nul 2>nul
title Website Opportunity Hunter - desktop shortcut

cd /d "%~dp0"

if not exist "start.cmd" (
    echo.
    echo   start.cmd is not next to this file, so there is nothing to point at.
    echo   Keep both files together in the project folder.
    echo.
    pause
    exit /b 1
)

echo.
echo   Creating the desktop shortcut...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$target = Join-Path '%~dp0' 'start.cmd'; $desktop = [Environment]::GetFolderPath('Desktop'); $link = Join-Path $desktop 'Website Opportunity Hunter.lnk'; $shell = New-Object -ComObject WScript.Shell; $s = $shell.CreateShortcut($link); $s.TargetPath = $target; $s.WorkingDirectory = '%~dp0'.TrimEnd('\'); $s.Description = 'Start the Website Opportunity Hunter dashboard'; $s.Save(); Write-Host ('  Created: ' + $link)"

if errorlevel 1 (
    echo.
    echo   The shortcut could not be created.
    echo.
    echo   You can always do it by hand: right-click start.cmd, then
    echo   Show more options -^> Send to -^> Desktop ^(create shortcut^).
    echo.
    pause
    exit /b 1
)

echo.
echo   Done. Double-click it on the desktop to start the dashboard.
echo.
pause
exit /b 0
