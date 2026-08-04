@echo off
title AK Info Ecom - Google Sheets Product Sync Tool
color 0B

echo ========================================================
echo     AK INFO ECOM - GOOGLE SHEETS PRODUCT SYNC TOOL
echo ========================================================
echo.

cd /d "%~dp0"

echo Triggering Product Sync from Google Sheets via local server API...
echo.

powershell -Command "try { $res = Invoke-RestMethod -Uri 'http://localhost:3000/api/sync-google-sheet' -Method POST -ContentType 'application/json' -Body '{}'; Write-Host 'SUCCESS:' $res.message -ForegroundColor Green } catch { Write-Host 'ERROR: Ensure server is running (Start_Store.bat). ' $_.Exception.Message -ForegroundColor Red }"

echo.
echo ========================================================
pause
