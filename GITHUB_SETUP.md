# GitHub Setup Instructions

## Step 1: Create GitHub Repository

### Option A: Using GitHub Web Interface
1. Go to [GitHub](https://github.com)
2. Click the "+" icon in the top right corner
3. Select "New repository"
4. Repository name: `erp-system-arabic`
5. Description: `Complete ERP System with Modern Arabic UI`
6. Choose "Public" or "Private"
7. **DO NOT** initialize with README, .gitignore, or license (we already have these)
8. Click "Create repository"

### Option B: Using GitHub CLI (if installed)
```bash
gh repo create erp-system-arabic --public --description "Complete ERP System with Modern Arabic UI"
```

## Step 2: Connect Local Repository to GitHub

### Get Repository URL
After creating the repository, GitHub will show you the repository URL. It will be:
```
https://github.com/YOUR_USERNAME/erp-system-arabic.git
```

### Add Remote Origin
```bash
git remote add origin https://github.com/YOUR_USERNAME/erp-system-arabic.git
```

## Step 3: Push to GitHub

```bash
# Push to GitHub
git push -u origin master

# Or if you're using main branch
git push -u origin main
```

## Step 4: Verify Upload

1. Go to your GitHub repository
2. Check that all files are uploaded
3. Verify the README.md is displayed correctly

## Step 5: Setup Vercel Deployment

### Option A: Automatic Deployment
1. Go to [Vercel](https://vercel.com)
2. Click "Import Project"
3. Connect your GitHub account
4. Select the `erp-system-arabic` repository
5. Vercel will automatically detect it's a Next.js project
6. Click "Deploy"

### Option B: Using Vercel CLI
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Link project to Vercel
vercel link

# Deploy to production
vercel --prod
```

## Step 6: Configure Environment Variables

In Vercel Dashboard:
1. Go to your project settings
2. Click "Environment Variables"
3. Add these variables:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `NEXTAUTH_URL`: Your Vercel deployment URL
   - `NEXTAUTH_SECRET`: Generate a secure secret key

## Step 7: Custom Domain (Optional)

1. In Vercel Dashboard, go to "Domains"
2. Add your custom domain
3. Update DNS settings as instructed by Vercel

## Troubleshooting

### Common Issues:
1. **Authentication Error**: Make sure you're logged into GitHub
2. **Permission Denied**: Check if the repository is private and you have access
3. **Branch Name**: Some systems use `main` instead of `master`

### Commands to Check:
```bash
# Check current branch
git branch

# Switch to main if needed
git checkout main
git push -u origin main

# Check remote origin
git remote -v

# Check status
git status
```

## Next Steps

After successful GitHub upload:

1. **Deploy to Vercel**: Follow Step 5
2. **Test Deployment**: Visit your Vercel URL
3. **Share Repository**: Share the GitHub link with your team
4. **Continuous Deployment**: Enable automatic deployments on push

## Repository Structure

Your GitHub repository will contain:
- Complete ERP System code
- Documentation files
- Deployment configurations
- Docker files
- Environment examples

## Security Notes

- Never commit `.env` files with real credentials
- Use environment variables for sensitive data
- Keep your `NEXTAUTH_SECRET` secure
- Use HTTPS for all deployments
