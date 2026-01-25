@echo off
echo.
echo ============================================
echo   CONNECT TO EXISTING GITHUB REPOSITORY
echo ============================================
echo.

cd /d "d:\Program Files\Coding\imtired"

echo Step 1: Checking if remote already exists...
git remote -v >nul 2>&1
if not errorlevel 1 (
    echo   Remote already configured:
    git remote -v
    echo.
    set /p CONTINUE="Do you want to update it? (y/n): "
    if /i not "%CONTINUE%"=="y" (
        echo   Cancelled.
        pause
        exit /b
    )
    git remote remove origin
)

echo.
echo Step 2: Enter your GitHub username:
set /p GITHUB_USER="GitHub username: "

if "%GITHUB_USER%"=="" (
    echo   Error: Username cannot be empty!
    pause
    exit /b
)

echo.
echo Step 3: Adding remote repository...
echo   Repository: agricatch
echo   Full URL: https://github.com/%GITHUB_USER%/agricatch.git
echo.
git remote add origin https://github.com/%GITHUB_USER%/agricatch.git

echo.
echo Step 4: Verifying remote...
git remote -v

echo.
echo Step 5: Setting branch to main...
git branch -M main

echo.
echo ============================================
echo   Repository connected successfully!
echo ============================================
echo.
echo Next step: Push your code with:
echo   git push -u origin main
echo.
echo Or run UPLOAD_TO_GITHUB.bat to push automatically.
echo.
pause
