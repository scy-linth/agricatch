@echo off
echo ========================================
echo   Killing Server on Port 3000
echo ========================================
echo.

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo Found process %%a on port 3000
    echo Killing process %%a...
    taskkill /F /PID %%a 2>nul
    if errorlevel 1 (
        echo Failed to kill process %%a
    ) else (
        echo Successfully killed process %%a
    )
)

timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   Starting Server
echo ========================================
echo.

cd /d "%~dp0"

echo Current directory: %CD%
echo.
echo Starting node server.js...
echo.

node server.js

if errorlevel 1 (
    echo.
    echo ========================================
    echo   ERROR: Server failed to start
    echo ========================================
    echo.
    pause
)
