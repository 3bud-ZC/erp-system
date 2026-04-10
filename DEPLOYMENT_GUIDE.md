# ERP System Deployment Guide

## Quick Start

### Automatic Deployment (Recommended)
```bash
# Windows
.\deploy.bat

# Linux/Mac
./deploy.sh
```

## Manual Deployment

### 1. Environment Setup

#### Prerequisites
- Node.js 18+ 
- PostgreSQL 13+
- Git

#### Environment Variables
Create `.env.production` file:
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/erp_system"

# Next.js
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="your-secure-secret-key-here"

# Production
NODE_ENV="production"
```

### 2. Build & Test

#### Install Dependencies
```bash
npm ci
```

#### Generate Prisma Client
```bash
npx prisma generate
```

#### Database Setup
```bash
npx prisma db push
npx prisma db seed
```

#### Build Application
```bash
npm run build
```

#### Type Checking
```bash
npm run type-check
```

#### Linting
```bash
npm run lint
```

#### Test Production Build
```bash
npm run start:prod
```

### 3. Production Deployment Options

#### Option 1: Vercel (Easiest)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to production
vercel --prod

# Add custom domain
vercel domains add yourdomain.com
```

#### Option 2: Docker (Recommended for scalability)
```bash
# Build and run with Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose logs -f app
```

#### Option 3: Traditional Server
```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start npm --name "erp-system" -- start:prod

# Save PM2 configuration
pm2 save
pm2 startup
```

#### Option 4: Static Export
```bash
# Export static files
npm run export

# Deploy to any static hosting service
# Upload the 'out' directory
```

### 4. Database Configuration

#### PostgreSQL Setup
```sql
-- Create database
CREATE DATABASE erp_system;

-- Create user
CREATE USER erp_user WITH PASSWORD 'secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE erp_system TO erp_user;
```

#### Database Migration
```bash
# Generate migration
npx prisma migrate dev --name init

# Apply to production
npx prisma migrate deploy
```

### 5. Performance Optimization

#### Bundle Analysis
```bash
# Analyze bundle size
npm run build:analyze
```

#### Image Optimization
- Images are automatically optimized with WebP/AVIF
- Lazy loading enabled for all images
- CDN caching configured for 30 days

#### Caching Strategy
- Static assets: 1 year cache
- API responses: 1 hour cache
- Images: 30 days cache

### 6. Security Configuration

#### HTTPS Setup
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### Security Headers
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security
- X-XSS-Protection

### 7. Monitoring & Logging

#### Application Monitoring
```bash
# PM2 Monitoring
pm2 monit

# Check logs
pm2 logs erp-system
```

#### Error Tracking
- Built-in error logging
- Performance metrics
- User activity tracking

### 8. Backup Strategy

#### Database Backup
```bash
# Daily backup
pg_dump erp_system > backup_$(date +%Y%m%d).sql

# Automated backup script
0 2 * * * /path/to/backup-script.sh
```

#### Application Backup
- Code repository (GitHub)
- Configuration files
- Asset backups

### 9. Scaling Considerations

#### Horizontal Scaling
- Load balancer configuration
- Multiple app instances
- Database read replicas

#### Vertical Scaling
- Increase server resources
- Optimize database queries
- Cache frequently accessed data

### 10. Troubleshooting

#### Common Issues
1. **Build fails**: Check Node.js version and dependencies
2. **Database connection**: Verify DATABASE_URL and network access
3. **Memory issues**: Increase Node.js memory limit
4. **Slow performance**: Check database queries and enable caching

#### Debug Commands
```bash
# Check Node.js version
node --version

# Check dependencies
npm list

# Database connection test
npx prisma db pull

# Build with verbose output
npm run build --verbose
```

## mobile optimization features

### responsive design
- mobile-first approach
- collapsible sidebar
- touch-friendly interfaces
- swipe gestures support

### performance optimizations
- image optimization
- code splitting
- lazy loading
- service worker support

### pwa features
- manifest.json
- offline support
- install prompt
- push notifications

## security considerations

### authentication
- session management
- csrf protection
- rate limiting
- secure headers

### data protection
- input validation
- sql injection prevention
- xss protection
- encryption at rest

## monitoring & analytics

### performance monitoring
- core web vitals
- error tracking
- user analytics
- uptime monitoring

### logging
- application logs
- error logs
- audit trails
- performance metrics

## backup & recovery

### database backup
- automated backups
- point-in-time recovery
- backup verification
- disaster recovery

### application backup
- code repository
- configuration backup
- asset backup
- rollback procedures
