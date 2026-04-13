# Dockerfile for Render deployment
FROM node:18-slim

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy all files
COPY . .

# Build the app
RUN npm run build

# Expose port
EXPOSE 3000

# Start command
CMD ["npm", "start"]
