#!/bin/bash

# Render build script for ERP System
echo "Starting build process..."

# Install dependencies
echo "Installing dependencies..."
npm install

# Verify Next.js is installed
echo "Verifying Next.js installation..."
npx next --version

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Build the application
echo "Building application..."
npm run build

echo "Build completed successfully!"
