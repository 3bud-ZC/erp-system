# Quick Render Deployment

## 1. Go to Render
Visit: https://render.com

## 2. Connect Repository
1. Click "New" > "Web Service"
2. Connect GitHub
3. Select `erp-system-arabic`

## 3. Configure Web Service
- **Environment**: Node
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Health Check**: `/`

## 4. Create Database
1. Click "New" > "PostgreSQL"
2. **Name**: `erp-system-db`
3. **Database**: `erp_system`
4. **User**: `erp_user`

## 5. Environment Variables
```
NODE_ENV = production
DATABASE_URL = [from database]
NEXTAUTH_URL = https://erp-system-arabic.onrender.com
NEXTAUTH_SECRET = 9688b5daf6a7f28f969486c4a1f00ac7c9068f365dcc2f92ac19aab70aa692b7
```

## 6. Deploy
Click "Create Web Service" and wait 5-10 minutes

## 7. Test Your Site
Visit: https://erp-system-arabic.onrender.com

## Database Setup
After deployment, run:
```bash
npx prisma db push
npx prisma db seed
```

## Troubleshooting

### If Build Fails:
- Check build logs
- Verify dependencies
- Check environment variables

### If Database Error:
- Verify DATABASE_URL
- Check database status
- Test connection

### If App Not Loading:
- Check health checks
- Verify start command
- Monitor logs

## Features Included

### Free Plan
- 750 hours/month
- 512MB RAM
- Shared CPU
- 100GB bandwidth

### Starter Plan ($7/month)
- 1GB RAM
- Dedicated CPU
- Custom domains
- Better performance

## Next Steps

1. Deploy to Render
2. Test all functionality
3. Set up custom domain (optional)
4. Monitor performance

## Support

- Render Docs: https://render.com/docs
- GitHub: https://github.com/3bud-ZC/erp-system-arabic
- Issues: https://github.com/3bud-ZC/erp-system-arabic/issues
