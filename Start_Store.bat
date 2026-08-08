@echo off
title AK Info Ecom - Local Server & Admin Launcher
color 0A

echo ========================================================
echo        AK INFO ECOM - LOCAL STORE & ADMIN LAUNCHER
echo ========================================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not added to PATH.
    echo Please download and install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [INFO] Installing required dependencies...
    call npm install
    echo.
)

echo [INFO] Starting AK Info Ecom Local Express Server on http://localhost:3000 ...
echo [INFO] Opening Admin Panel and Storefront in Google Chrome...
echo.

start "" "http://localhost:3000/admin.html"
start "" "http://localhost:3000"

node server/server.js

pause
