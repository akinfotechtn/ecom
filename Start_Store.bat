@echo off
title AK Info Ecom - Server & Admin Launcher
color 0A

echo ========================================================
echo        AK INFO ECOM - E-COMMERCE STORE LAUNCHER
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
    echo [INFO] Installing required dependencies (Express, Razorpay, Axios, CSV Parser)...
    call npm install
    echo.
)

echo [INFO] Starting AK Info Ecom Express Server on http://localhost:3000 ...
echo [INFO] Opening Storefront and Admin Panel in web browser...
echo.

start "" "http://localhost:3000"
start "" "http://localhost:3000/admin.html"

node server/server.js

pause
