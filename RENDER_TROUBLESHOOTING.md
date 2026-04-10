# Render Deployment Troubleshooting

## Current Issue
The deployment is still failing with "next: not found" error.

## Solutions to Try

### Option 1: Use NPM Scripts Directly
Update render.yaml to use individual commands:

```yaml
buildCommand: npm ci && npm run build
```

### Option 2: Specify Node Version
Add .nvmrc file:
```
18
```

### Option 3: Use Full Path
Update render.yaml:
```yaml
buildCommand: ./node_modules/.bin/next build
```

### Option 4: Manual Build Steps
Create comprehensive build script:
```bash
npm install
./node_modules/.bin/next build
```

## Debug Steps

### 1. Check Package.json
Ensure Next.js is in dependencies:
```json
"next": "14.2.3"
```

### 2. Verify Node Version
Render is using Node.js 25.9.0 - this should work.

### 3. Check Lock File
Ensure package-lock.json exists and is committed.

### 4. Test Locally
Run the same commands locally to verify they work.

## Alternative: Use Vercel Instead

If Render continues to fail, Vercel is more reliable for Next.js:

### Vercel Steps:
1. Go to https://vercel.com
2. Import `erp-system-arabic` repository
3. Add environment variables:
   ```
   DATABASE_URL = file:./dev.db
   NEXTAUTH_URL = https://erp-system-arabic.vercel.app
   NEXTAUTH_SECRET = 9688b5daf6a7f28f969486c4a1f00ac7c9068f365dcc2f92ac19aab70aa692b7
   NODE_ENV = production
   ```
4. Deploy

## Quick Fix for Render

Try this render.yaml configuration:

```yaml
services:
  - type: web
    name: erp-system-arabic
    env: node
    plan: starter
    buildCommand: npm ci && npm run build
    startCommand: npm start
    healthCheckPath: /
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: erp-system-db
          property: connectionString
      - key: NEXTAUTH_URL
        value: https://erp-system-arabic.onrender.com
      - key: NEXTAUTH_SECRET
        generateValue: true
        sync: false

  - type: pserv
    name: erp-system-db
    plan: starter
    env: docker
    databaseName: erp_system
    user: erp_user
    healthCheckPath: /
    envVars:
      - key: POSTGRES_DB
        value: erp_system
      - key: POSTGRES_USER
        value: erp_user
      - key: POSTGRES_PASSWORD
        generateValue: true
        sync: false

version: "1"
autoDeploy: true
```

## Recommendation

**Use Vercel instead of Render** - it's more reliable for Next.js applications and has better support for the Next.js build process.

Render is better for:
- Custom Docker applications
- Non-Next.js applications
- Applications needing custom server configurations

Vercel is better for:
- Next.js applications
- Static sites
- Serverless functions
- Edge computing
