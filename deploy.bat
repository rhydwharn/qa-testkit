@echo off
REM QA TestKit Deployment Script for Windows
REM This script deploys the application to Vercel

setlocal enabledelayedexpansion

echo.
echo 🚀 QA TestKit Deployment Script
echo ================================
echo.

REM Check if vercel CLI is installed
where vercel >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo 📦 Installing Vercel CLI...
    call npm install -g vercel
)

REM Check if git is initialized
git rev-parse --git-dir >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Not a git repository. Please run 'git init' first.
    exit /b 1
)

REM Check for uncommitted changes
git diff-index --quiet HEAD --
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  You have uncommitted changes. Commit them first:
    echo    git add -A ^&^& git commit -m "Your message"
    exit /b 1
)

REM Check if remote is set
git config --get remote.origin.url >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ No remote repository set. Add it with:
    echo    git remote add origin https://github.com/USERNAME/REPO.git
    exit /b 1
)

echo ✅ Checks passed!
echo.

REM Push to GitHub
echo 📤 Pushing to GitHub...
call git push -u origin main

echo.
echo 🌐 Starting Vercel deployment...
echo.

REM Deploy to Vercel
call vercel

echo.
echo ✅ Deployment complete!
echo.
echo Next steps:
echo 1. Set environment variables in Vercel dashboard:
echo    - DATABASE_URL
echo    - NEXTAUTH_SECRET
echo    - NEXTAUTH_URL
echo.
echo 2. Run database migrations (if needed):
echo    DATABASE_URL="..." pnpm run db:push
echo.
echo 3. Visit your deployment at the URL provided above
echo.

pause
