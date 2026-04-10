@echo off
REM ERP System Deployment Script for Windows
REM This script prepares and deploys the ERP system for production

echo Starting ERP System Deployment...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js is not installed. Please install Node.js 18 or higher.
    pause
    exit /b 1
)

echo Node.js is installed. Continuing deployment...

REM Install dependencies
echo Installing dependencies...
npm ci

REM Generate Prisma client
echo Generating Prisma client...
npx prisma generate

REM Run database migrations (if needed)
echo Running database migrations...
npx prisma db push

REM Build the application
echo Building application...
npm run build

REM Run type checking
echo Running type checks...
npm run type-check

REM Run linting
echo Running lint checks...
npm run lint

REM Create production environment file if it doesn't exist
if not exist .env.production (
    echo Creating .env.production file...
    copy .env.example .env.production
    echo Please update .env.production with your production values.
)

REM Create deployment directory
set DEPLOY_DIR=deploy
if exist %DEPLOY_DIR% (
    rmdir /s /q %DEPLOY_DIR%
)
mkdir %DEPLOY_DIR%

REM Copy necessary files for deployment
echo Preparing deployment files...
xcopy /E /I /Y .next %DEPLOY_DIR%\.next
xcopy /E /I /Y public %DEPLOY_DIR%\public
xcopy /E /I /Y node_modules %DEPLOY_DIR%\node_modules
xcopy /E /I /Y prisma %DEPLOY_DIR%\prisma
copy package.json %DEPLOY_DIR%\
copy package-lock.json %DEPLOY_DIR%\
if exist server.js copy server.js %DEPLOY_DIR%\
if exist .env.production copy .env.production %DEPLOY_DIR%\.env

echo.
echo Deployment preparation complete!
echo.
echo Next steps:
echo 1. Update .env.production with your production values
echo 2. Deploy the 'deploy' directory to your server
echo 3. Run 'npm install' in the deploy directory
echo 4. Run 'npm run start:prod' to start the application
echo.
echo For Docker deployment:
echo 1. Run 'docker-compose -f docker-compose.prod.yml up -d'
echo.
echo For Vercel deployment:
echo 1. Run 'npm run build'
echo 2. Deploy the .next directory to Vercel
echo.
pause
