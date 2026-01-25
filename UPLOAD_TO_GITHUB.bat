@echo off
echo.
echo ============================================
echo   UPLOAD TO GITHUB - QUICK SCRIPT
echo ============================================
echo.

cd /d "d:\Program Files\Coding\imtired"

echo Step 1: Checking if Git repository exists...
if not exist ".git" (
    echo   Git repository not found. Initializing...
    git init
    echo   Git repository initialized!
    echo.
    echo   IMPORTANT: Before continuing, you need to:
    echo   1. Create a repository on GitHub
    echo   2. Run: git remote add origin YOUR_REPO_URL
    echo   3. Then run this script again
    echo.
    pause
    exit /b
)

echo Step 2: Checking Git status...
git status

echo.
echo Step 3: Adding all files...
git add .

echo.
echo Step 4: Please enter commit message:
set /p COMMIT_MSG="Commit message: "

if "%COMMIT_MSG%"=="" (
    set COMMIT_MSG=Update: %date% %time%
)

echo.
echo Step 5: Committing changes...
git commit -m "%COMMIT_MSG%"

echo.
echo Step 6: Checking if remote is configured...
git remote -v >nul 2>&1
if errorlevel 1 (
    echo   No remote repository configured!
    echo.
    echo   Please run this command first:
    echo   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
    echo.
    echo   Or if you already have a remote, continue anyway...
    pause
)

echo.
echo Step 7: Pushing to GitHub...
git push

echo.
echo ============================================
echo   Done! Check GitHub to verify upload.
echo ============================================
echo.

pause
