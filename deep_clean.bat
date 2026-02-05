@echo off
echo =============================================================================
echo SENTINEL TRACK: DEEP CLEAN SCRIPT
echo =============================================================================
echo This script will kill all pending processes and clear problematic caches.

echo [1/3] Killing hanging processes...
taskkill /F /IM electron.exe /T >nul 2>&1
taskkill /F /IM TimeTracker.exe /T >nul 2>&1
taskkill /F /IM node.exe /T >nul 2>&1

echo [2/3] Cleaning build output...
if exist out rmdir /s /q out
if exist dist rmdir /s /q dist

echo [3/3] Clearing Chromium Cache (Fixes "Access Denied")...
set CACHE_DIR=%APPDATA%\sentinel-track
if exist "%CACHE_DIR%" (
    echo Clearing app data in %CACHE_DIR%
    rmdir /s /q "%CACHE_DIR%"
)

echo.
echo SUCCESS: Environment cleaned. 
echo PLEASE RESTART the app using: npm run dev
echo =============================================================================
pause
