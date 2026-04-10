# Quick Vercel Deployment Guide

## 1. Go to Vercel
Visit: https://vercel.com

## 2. Import Project
1. Click "Add New..." > "Project"
2. Search: `erp-system-arabic`
3. Click "Import"

## 3. Environment Variables (Required)
Add these in Settings > Environment Variables:

```
DATABASE_URL = file:./dev.db
NEXTAUTH_URL = https://erp-system-arabic.vercel.app
NEXTAUTH_SECRET = your-secret-key-here
NODE_ENV = production
```

## 4. Generate Secret Key
Run this command to generate secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 5. Deploy
Click "Deploy" button and wait 2-3 minutes

## 6. Test Your Site
Visit: https://erp-system-arabic.vercel.app

## 7. Custom Domain (Optional)
In Settings > Domains, add your domain

## Database Options

### Option 1: SQLite (Free - Default)
- Use `DATABASE_URL = file:./dev.db`
- Good for testing
- No setup required

### Option 2: PostgreSQL (Production)
- Use Supabase (free): https://supabase.com
- Or Vercel Postgres (in Storage tab)
- Update DATABASE_URL with PostgreSQL connection

## Troubleshooting

### If Build Fails:
1. Check environment variables
2. Verify package.json dependencies
3. Check build logs in Vercel

### If Database Error:
1. Verify DATABASE_URL is correct
2. Test database connection
3. Check if database is accessible

### If Arabic Text Issues:
1. Check RTL configuration
2. Verify font loading
3. Test on different browsers

## Production Checklist

- [ ] Environment variables set
- [ ] Database connection working
- [ ] All pages loading
- [ ] Mobile responsive
- [ ] Arabic text correct
- [ ] Forms working

## Support

- Vercel Docs: https://vercel.com/docs
- GitHub: https://github.com/3bud-ZC/erp-system-arabic
- Issues: https://github.com/3bud-ZC/erp-system-arabic/issues
