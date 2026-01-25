in@echo off
echo.
echo ============================================
echo   RESTARTING SERVER TO FIX OTP ROUTE
echo ============================================
echo.

cd /d "d:\Program Files\Coding\imtired\backend"

echo Step 1: Stopping old server...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo   Killing process %%a...
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo Step 2: Waiting 2 seconds...
timeout /t 2 /nobreak >nul

echo.
echo Step 3: Starting new server...
echo   (Look for "✅ OTP route loaded successfully" message)
echo.
echo ============================================
echo.

node server.js

pause
