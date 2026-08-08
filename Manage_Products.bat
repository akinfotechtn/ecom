@echo off
title AK Infotech - Local Product & Google Sheets Manager
color 0B
cls

echo ==============================================================================
echo    AK INFOTECH - PRODUCT MANAGER & GOOGLE SHEETS SYNCHRONIZER
echo    100%% Local JSON Engine • Add Single Products & Sync Google Sheets
echo ==============================================================================
echo.
echo  [1/2] Launching Local Manager in Google Chrome...
start "" "http://localhost:3000/local-sync.html"

echo.
echo  [2/2] Starting Local Backend Server on http://localhost:3000 ...
echo.
echo  ------------------------------------------------------------------------------
echo   INSTRUCTIONS:
echo   - To Sync Sheets   : Click "Sync Google Sheet Now" in Chrome
echo   - To Add Product   : Fill the form on the right and click "Save Product"
echo   - To Bulk Edit     : Click "Spreadsheet Bulk Edit" in the catalog
echo  ------------------------------------------------------------------------------
echo.
node server/server.js
pause
