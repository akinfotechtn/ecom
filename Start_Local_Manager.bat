@echo off
title AK Infotech - Local Product & Google Sheets Manager
color 0B
cls

echo ==============================================================================
echo    AK INFOTECH - LOCAL PRODUCT ^& GOOGLE SHEETS MANAGER
echo    100%% Local JSON Storage ^• Zero Firestore Reads ^• Instant Catalog Updates
echo ==============================================================================
echo.
echo  [1/3] Waiting for server to start...
timeout /t 2 /nobreak >nul

echo  [2/3] Opening Local Manager in Google Chrome...

REM Try common Chrome install paths
set CHROME=""
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
)
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set CHROME="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    set CHROME="%LocalAppData%\Google\Chrome\Application\chrome.exe"
)

if not %CHROME%=="" (
    start "" %CHROME% "http://localhost:3000/local-sync.html"
) else (
    echo  Chrome not found - opening in default browser...
    start "" "http://localhost:3000/local-sync.html"
)

echo.
echo  [3/3] Starting Local Server on http://localhost:3000 ...
echo  Press Ctrl + C to stop the server at any time.
echo.
node server/server.js
pause
