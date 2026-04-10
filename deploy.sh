#!/bin/bash

# ERP System Deployment Script
# This script prepares and deploys the ERP system for production

set -e

echo "Starting ERP System Deployment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm ci

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Run database migrations (if needed)
echo "Running database migrations..."
npx prisma db push

# Build the application
echo "Building application..."
npm run build

# Run type checking
echo "Running type checks..."
npm run type-check

# Run linting
echo "Running lint checks..."
npm run lint

# Create production environment file if it doesn't exist
if [ ! -f .env.production ]; then
    echo "Creating .env.production file..."
    cp .env.example .env.production
    echo "Please update .env.production with your production values."
fi

# Create deployment directory
DEPLOY_DIR="./deploy"
if [ -d "$DEPLOY_DIR" ]; then
    rm -rf "$DEPLOY_DIR"
fi
mkdir -p "$DEPLOY_DIR"

# Copy necessary files for deployment
echo "Preparing deployment files..."
cp -r .next "$DEPLOY_DIR/"
cp -r public "$DEPLOY_DIR/"
cp -r node_modules "$DEPLOY_DIR/"
cp -r prisma "$DEPLOY_DIR/"
cp package.json "$DEPLOY_DIR/"
cp package-lock.json "$DEPLOY_DIR/"
cp server.js "$DEPLOY_DIR/" 2>/dev/null || true
cp .env.production "$DEPLOY_DIR/.env" 2>/dev/null || true

echo "Deployment preparation complete!"
echo ""
echo "Next steps:"
echo "1. Update .env.production with your production values"
echo "2. Deploy the 'deploy' directory to your server"
echo "3. Run 'npm install' in the deploy directory"
echo "4. Run 'npm run start:prod' to start the application"
echo ""
echo "For Docker deployment:"
echo "1. Run 'docker-compose -f docker-compose.prod.yml up -d'"
echo ""
echo "For Vercel deployment:"
echo "1. Run 'npm run build'"
echo "2. Deploy the .next directory to Vercel"
