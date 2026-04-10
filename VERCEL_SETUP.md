# Vercel Deployment Setup Guide

## Step 1: Import Project to Vercel

### 1.1 Go to Vercel
- Visit https://vercel.com
- Sign up or login with your GitHub account

### 1.2 Import Repository
1. Click "Add New..." > "Project"
2. Search for `erp-system-arabic` (your GitHub repository)
3. Click "Import"

### 1.3 Configure Build Settings
Vercel will automatically detect Next.js settings:
- **Framework Preset**: Next.js
- **Root Directory**: ./
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm ci`

## Step 2: Environment Variables Configuration

### 2.1 Go to Project Settings
1. After importing, go to your project dashboard
2. Click "Settings" tab
3. Click "Environment Variables"

### 2.2 Add Required Environment Variables

#### For Development/Testing (Free Option):
```
DATABASE_URL = file:./dev.db
NEXTAUTH_URL = https://your-project-name.vercel.app
NEXTAUTH_SECRET = your-secret-key-here
NODE_ENV = production
```

#### For Production (Recommended):
```
DATABASE_URL = postgresql://username:password@host:port/database
NEXTAUTH_URL = https://your-domain.com
NEXTAUTH_SECRET = generate-secure-secret-key
NODE_ENV = production
```

### 2.3 Generate NEXTAUTH_SECRET
```bash
# Generate secure secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 3: Database Setup Options

### Option 1: SQLite (Free & Simple)
1. Use the default `DATABASE_URL = file:./dev.db`
2. Vercel will create SQLite database automatically
3. Good for testing and small projects

### Option 2: PostgreSQL (Production Ready)
1. **Free PostgreSQL Options:**
   - [Supabase](https://supabase.com) - Free PostgreSQL
   - [Neon](https://neon.tech) - Free PostgreSQL
   - [PlanetScale](https://planetscale.com) - MySQL compatible

2. **Setup with Supabase:**
   - Create account on Supabase
   - Create new project
   - Get connection string from Settings > Database
   - Add to Vercel environment variables

### Option 3: Vercel Postgres (Easiest)
1. In Vercel dashboard, go to "Storage"
2. Click "Create Database"
3. Choose "Postgres"
4. Vercel will automatically add DATABASE_URL

## Step 4: Deploy Project

### 4.1 Initial Deployment
1. Click "Deploy" button
2. Wait for build to complete (2-3 minutes)
3. Your site will be live at `https://erp-system-arabic.vercel.app`

### 4.2 Check Deployment
- Visit your Vercel URL
- Check if the site loads correctly
- Test navigation between pages

## Step 5: Advanced Configuration

### 5.1 Custom Domain (Optional)
1. Go to "Settings" > "Domains"
2. Add your custom domain
3. Update DNS records as instructed
4. Wait for SSL certificate (5-10 minutes)

### 5.2 Performance Optimization
Add these environment variables:
```
NEXT_PUBLIC_APP_URL = https://your-domain.com
ANALYZE = false
NODE_OPTIONS = --max-old-space-size=4096
```

### 5.3 Security Headers
Already configured in `vercel.json` file, but you can add more in Vercel dashboard:
```
X-Frame-Options = DENY
X-Content-Type-Options = nosniff
Referrer-Policy = origin-when-cross-origin
```

## Step 6: Testing & Monitoring

### 6.1 Test All Features
1. **Navigation**: Test all pages
2. **Mobile**: Check mobile responsiveness
3. **Arabic Text**: Verify RTL layout works
4. **Forms**: Test add/edit functionality

### 6.2 Monitor Performance
1. Go to "Analytics" tab in Vercel
2. Check Core Web Vitals
3. Monitor error rates
4. Check build logs

### 6.3 Error Handling
1. Go to "Functions" tab
2. Check function logs
3. Monitor any errors
4. Set up alerts if needed

## Step 7: Continuous Deployment

### 7.1 Auto-Deploy Setup
Vercel automatically:
- Deploys on every push to main/master
- Creates preview URLs for pull requests
- Handles rollbacks automatically

### 7.2 Branch Deployment
1. Go to "Settings" > "Git"
2. Configure which branches to deploy
3. Set up preview deployments

## Troubleshooting

### Common Issues & Solutions:

#### 1. Build Failures
```
Error: Module not found
Solution: Check package.json dependencies
```

#### 2. Database Connection Error
```
Error: Can't reach database
Solution: Verify DATABASE_URL is correct
```

#### 3. Environment Variables Not Working
```
Error: process.env.UNDEFINED
Solution: Add variables in Vercel dashboard
```

#### 4. Arabic Text Issues
```
Error: Text not displaying correctly
Solution: Check RTL configuration in globals.css
```

#### 5. Performance Issues
```
Error: Slow loading
Solution: Enable image optimization, check bundle size
```

## Quick Commands

### Local Testing
```bash
# Test build locally
npm run build
npm start

# Test with production variables
cp .env.example .env.local
# Edit .env.local with production values
npm run build
npm start
```

### Deployment Commands
```bash
# Deploy to Vercel
vercel --prod

# Check deployment status
vercel ls

# View logs
vercel logs
```

## Production Checklist

Before going live, verify:

- [ ] All environment variables set
- [ ] Database connection working
- [ ] All pages load correctly
- [ ] Mobile responsive design
- [ ] Arabic text displays properly
- [ ] Forms are functional
- [ ] Security headers configured
- [ ] Custom domain (if needed)
- [ ] Monitoring setup
- [ ] Backup strategy

## Support Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [GitHub Repository](https://github.com/3bud-ZC/erp-system-arabic)
- [Project Issues](https://github.com/3bud-ZC/erp-system-arabic/issues)
