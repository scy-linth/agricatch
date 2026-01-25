@echo off
echo Stopping server on port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo Killing process %%a
    taskkill /F /PID %%a
)
timeout /t 2 /nobreak >nul
echo.
echo Starting server...
cd /d "%~dp0"
node server.js
