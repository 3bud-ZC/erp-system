# Render Deployment Guide

## Step 1: Create Render Account

### 1.1 Sign Up
- Go to https://render.com
- Click "Sign Up"
- Use GitHub, Google, or email

### 1.2 Choose Plan
- **Free Plan** (Recommended for testing)
- **Starter Plan** ($7/month for production)

## Step 2: Connect Repository

### 2.1 Connect GitHub
1. Click "New" > "Web Service"
2. Click "Connect" next to GitHub
3. Authorize Render access
4. Select `erp-system-arabic` repository

### 2.2 Configure Basic Settings
- **Name**: `erp-system-arabic`
- **Region**: Choose nearest region
- **Branch**: `master` (or `main`)

## Step 3: Configure Build Settings

### 3.1 Environment
- **Environment**: `Node`
- **Build Command**: `npm run build`
- **Start Command**: `npm start`

### 3.2 Advanced Settings
- **Health Check Path**: `/`
- **Auto-Deploy**: Enable

## Step 4: Setup Database

### 4.1 Create PostgreSQL Database
1. Click "New" > "PostgreSQL"
2. **Name**: `erp-system-db`
3. **Database Name**: `erp_system`
4. **User**: `erp_user`
5. **Plan**: Free (for testing)

### 4.2 Database Configuration
```
Database Name: erp_system
User: erp_user
Password: auto-generated
Connection String: provided by Render
```

## Step 5: Environment Variables

### 5.1 Required Variables
```
NODE_ENV = production
DATABASE_URL = [from database connection]
NEXTAUTH_URL = https://erp-system-arabic.onrender.com
NEXTAUTH_SECRET = [generate secure secret]
```

### 5.2 Generate NEXTAUTH_SECRET
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5.3 Database Connection
Render automatically provides DATABASE_URL from the database service.

## Step 6: Deploy

### 6.1 Initial Deploy
1. Click "Create Web Service"
2. Render will automatically build and deploy
3. Wait 5-10 minutes for first deployment

### 6.2 Monitor Deployment
- Check build logs
- Monitor health checks
- Verify database connection

## Step 7: Post-Deployment Setup

### 7.1 Database Migration
```bash
# Connect to Render shell
# Run database migrations
npx prisma db push
npx prisma db seed
```

### 7.2 Test Application
- Visit: https://erp-system-arabic.onrender.com
- Test all pages
- Verify database connectivity
- Check mobile responsiveness

## Step 8: Custom Domain (Optional)

### 8.1 Add Custom Domain
1. Go to service settings
2. Click "Custom Domains"
3. Add your domain
4. Update DNS records

### 8.2 SSL Certificate
- Render automatically provides SSL
- Certificate issued automatically

## render.yaml Configuration

### Complete Configuration File
```yaml
services:
  # Web Service
  - type: web
    name: erp-system-arabic
    env: node
    plan: starter
    buildCommand: npm run build
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

  # PostgreSQL Database
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

# Auto-deploy configuration
version: "1"
autoDeploy: true
```

## Troubleshooting

### Common Issues

#### 1. Build Failures
```
Solution: Check build logs, verify dependencies
```

#### 2. Database Connection
```
Solution: Verify DATABASE_URL, check database status
```

#### 3. Health Check Failures
```
Solution: Check if app is running, verify health check path
```

#### 4. Environment Variables
```
Solution: Ensure all required variables are set
```

### Debug Commands
```bash
# Check build logs in Render dashboard
# Test database connection
# Verify environment variables
# Check health endpoint
```

## Performance Optimization

### Render Features
- **Auto-scaling**: Available on paid plans
- **CDN**: Automatic global CDN
- **SSL**: Free SSL certificates
- **Monitoring**: Built-in monitoring

### Application Optimization
- Enable caching
- Optimize database queries
- Use CDN for static assets
- Monitor performance metrics

## Pricing

### Free Plan Limits
- 750 hours/month
- 512MB RAM
- Shared CPU
- 100GB bandwidth

### Starter Plan ($7/month)
- 750 hours/month
- 1GB RAM
- Dedicated CPU
- 100GB bandwidth
- Custom domains

## Support

### Render Documentation
- https://render.com/docs
- https://render.com/docs/web-services

### Community Support
- Render Discord
- GitHub Discussions
- Stack Overflow

### Project Support
- GitHub: https://github.com/3bud-ZC/erp-system-arabic
- Issues: https://github.com/3bud-ZC/erp-system-arabic/issues

## Next Steps

1. Create Render account
2. Connect GitHub repository
3. Configure services using render.yaml
4. Deploy and test
5. Set up custom domain (optional)
6. Monitor performance
