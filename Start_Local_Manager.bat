@echo off
title AK Infotech - Local Product & Google Sheets Manager
color 0B
cls

echo ==============================================================================
echo    AK INFOTECH - LOCAL PRODUCT & GOOGLE SHEETS MANAGER
echo    100%% Local JSON Storage • Zero Firestore Reads • Instant Catalog Updates
echo ==============================================================================
echo.
echo  [1/2] Opening Local Manager in Google Chrome...
start "" "http://localhost:3000/local-sync.html"

echo.
echo  [2/2] Starting Local Server on http://localhost:3000 ...
echo  Press Ctrl + C to stop the server at any time.
echo.
node server/server.js
pause
