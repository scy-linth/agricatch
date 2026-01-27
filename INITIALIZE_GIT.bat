@echo off
echo.
echo ============================================
echo   INITIALIZE GIT REPOSITORY
echo ============================================
echo.

cd /d "d:\Program Files\Coding\imtired"

echo Step 1: Initializing Git repository...
git init

echo.
echo Step 2: Checking Git configuration...
git config user.name >nul 2>&1
if errorlevel 1 (
    echo   Git user name not configured.
    set /p GIT_NAME="Enter your name: "
    git config --global user.name "%GIT_NAME%"
)

git config user.email >nul 2>&1
if errorlevel 1 (
    echo   Git user email not configured.
    set /p GIT_EMAIL="Enter your email: "
    git config --global user.email "%GIT_EMAIL%"
)

echo.
echo Step 3: Adding all files to Git...
git add .

echo.
echo Step 4: Creating initial commit...
git commit -m "Initial commit: AgriCatch marketplace system"

echo.
echo ============================================
echo   Git repository initialized successfully!
echo ============================================
echo.
echo Next steps:
echo 1. Create a repository on GitHub
echo 2. Run this command (replace with your repo URL):
echo    git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
echo 3. Then run: git push -u origin main
echo.
pause
