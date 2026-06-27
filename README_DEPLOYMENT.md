# QA TestKit - Vercel Deployment Setup

## Overview

Your QA TestKit application is now ready for deployment to Vercel. This document outlines everything you need to know to get it live.

## Current Status ✅

- ✅ Application built and tested locally
- ✅ All bug fixes implemented (security, pagination, shift-click selection)
- ✅ Vercel configuration files created
- ✅ Environment variable templates provided
- ✅ Deployment scripts included

## What's Included

### Configuration Files
- **`vercel.json`** - Vercel deployment configuration
- **`package.json`** - Dependencies and build scripts
- **`next.config.js`** - Next.js configuration with JIRA integration

### Deployment Guides
- **`VERCEL_QUICK_START.md`** - 5-minute quick start guide
- **`DEPLOYMENT_GUIDE.md`** - Comprehensive deployment documentation
- **`deploy.sh`** - Automated deployment script (macOS/Linux)
- **`deploy.bat`** - Automated deployment script (Windows)

## Quick Start (Choose One)

### Method 1: Automatic Deployment Script 🤖

**macOS/Linux:**
```bash
cd /path/to/project
./deploy.sh
```

**Windows:**
```bash
cd C:\path\to\project
deploy.bat
```

The script will:
1. Verify git setup
2. Push to GitHub
3. Launch Vercel deployment wizard
4. Guide you through environment variable setup

### Method 2: Manual via Vercel Dashboard 🌐

1. Visit [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Select your GitHub repository
4. Accept defaults (Vercel auto-detects Next.js)
5. Add environment variables (see below)
6. Click "Deploy"

### Method 3: Vercel CLI 📦

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod
```

## Required Environment Variables

Before deploying, gather these three values:

### 1. DATABASE_URL
Your PostgreSQL connection string.

**Get one from:**
- **Neon** (Recommended - free tier): https://neon.tech
  - Sign up → Create project → Copy connection string
- **Railway**: https://railway.app
  - Create database → Copy connection string
- **Supabase**: https://supabase.com
  - Create project → Get connection string

Example format:
```
postgresql://user:password@host.neon.tech/database
```

### 2. NEXTAUTH_SECRET
A random 32+ character secret for session encryption.

**Generate with:**
```bash
# macOS/Linux
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32|%{[byte]$_})|Get-Random -Count 32)
```

### 3. NEXTAUTH_URL
Your Vercel deployment URL.

**Format:**
```
https://your-project-name.vercel.app
```

After first deployment, Vercel will show you your URL.

## Step-by-Step Deployment

### Step 1: Push to GitHub (if not done)
```bash
git push -u origin main
```

### Step 2: Deploy to Vercel
Use one of the methods above (script, dashboard, or CLI)

### Step 3: Set Environment Variables

**In Vercel Dashboard:**
1. Go to your project
2. Settings → Environment Variables
3. Add the three variables (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL)
4. Redeploy for changes to take effect

### Step 4: Run Database Migrations

```bash
# After deployment, run this locally
DATABASE_URL="your_production_connection_string" \
pnpm run db:push
```

### Step 5: Verify Deployment

1. Visit your Vercel URL
2. Sign up / login
3. Test creating test cycles and cases
4. Verify data persists

## Architecture

```
┌─────────────────────────────────────────┐
│         Your Browser (Client)           │
└──────────────────┬──────────────────────┘
                   │
         ┌─────────▼──────────┐
         │  Vercel Edge (CDN) │
         └─────────┬──────────┘
                   │
    ┌──────────────▼──────────────┐
    │   Next.js Application       │
    │   (/apps/web)               │
    │   - Pages                   │
    │   - API Routes              │
    │   - Authentication (JIRA)   │
    └──────────────┬──────────────┘
                   │
    ┌──────────────▼──────────────┐
    │   PostgreSQL Database       │
    │   (Neon, Railway, etc.)     │
    └─────────────────────────────┘
```

## Key Features Implemented

- ✅ **Test Cycle Management** - Create, edit, clone test cycles
- ✅ **Test Case Management** - Full CRUD with versioning
- ✅ **Test Execution Tracking** - Status tracking with reports
- ✅ **Defect Management** - Link defects to test executions
- ✅ **Pagination** - Fixed! Works correctly across pages
- ✅ **Shift-Click Selection** - Select multiple items efficiently
- ✅ **Authorization** - Secure project-based access control
- ✅ **JIRA Integration** - Link test plans with JIRA issues
- ✅ **Export** - Generate CSV/PDF reports
- ✅ **Responsive UI** - Works on desktop and mobile

## Monitoring After Deployment

### Vercel Dashboard
- **Analytics**: View performance metrics
- **Deployments**: See deployment history
- **Logs**: Check for errors and issues
- **Function Logs**: Monitor API endpoint performance

### Performance Tips
1. Enable Vercel Analytics (free)
2. Set up error tracking (Sentry integration)
3. Monitor database query performance
4. Use Vercel's serverless function metrics

## Troubleshooting

### Build Fails
**Error:** "Build failed"

**Solution:**
1. Check all environment variables are set in Vercel
2. Ensure DATABASE_URL is correct
3. Check build logs for specific errors

### Application Loads but No Database
**Error:** "Cannot connect to database"

**Solution:**
1. Verify DATABASE_URL in Vercel environment variables
2. Run migrations: `DATABASE_URL="..." pnpm run db:push`
3. Check database server is accessible from Vercel

### Login Doesn't Work
**Error:** "AuthenticationError" or redirect loops

**Solution:**
1. Verify NEXTAUTH_SECRET is set (32+ characters)
2. Verify NEXTAUTH_URL matches your Vercel domain
3. Restart deployment from Vercel dashboard

### White Screen After Deployment
**Error:** Blank page loads

**Solution:**
1. Check browser console for errors (F12)
2. Check Vercel deployment logs
3. Try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

## Redployment

To deploy new changes:

```bash
# 1. Commit changes
git add -A
git commit -m "Your message"

# 2. Push to GitHub
git push

# 3. Vercel automatically redeploys!
```

Vercel automatically redeploys when you push to the `main` branch.

## Custom Domain (Optional)

To use your own domain:

1. In Vercel Dashboard → Settings → Domains
2. Add your domain
3. Follow DNS configuration steps
4. Update NEXTAUTH_URL environment variable

## Database Backups

For production deployments:

1. **Enable automated backups** in your database provider
2. **Test restores** regularly
3. **Keep local snapshots** of production data

## Security Checklist

- ✅ NEXTAUTH_SECRET is 32+ characters
- ✅ DATABASE_URL is secure and not exposed
- ✅ NEXTAUTH_URL matches production domain
- ✅ HTTPS enforced (automatic on Vercel)
- ✅ API routes validate authorization
- ✅ Environment variables not in git

## Support & Resources

### Documentation
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma ORM Documentation](https://www.prisma.io/docs)
- [NextAuth.js Documentation](https://next-auth.js.org)

### Getting Help
- Vercel Support: vercel.com/support
- GitHub Issues: rhydwharn/qa-testkit/issues
- NextAuth.js Discord: https://discord.gg/nextauth

## Helpful Commands

```bash
# Development
pnpm install          # Install dependencies
pnpm run dev          # Start dev server
pnpm run build        # Build for production
pnpm run start        # Start production server

# Database
pnpm run db:push      # Push schema to database
pnpm run db:migrate   # Create migration
pnpm run db:studio    # Open Prisma Studio
pnpm run db:seed      # Seed test data

# Deployment
./deploy.sh           # Auto-deploy (macOS/Linux)
vercel --prod         # Deploy using Vercel CLI
```

## Costs

### Free Tier (Vercel + Database)

**Vercel**
- $0/month for standard deployments
- 100 GB bandwidth/month

**PostgreSQL Database**
- **Neon**: Free tier (1 GB storage, unlimited query time)
- **Railway**: Free $5/month credit (includes database)
- **Supabase**: Free tier (500 MB storage)

### Estimated Monthly Cost
- Small app (< 10K users): **$0 - $10/month**
- Medium app (10K - 100K users): **$20 - $100/month**
- Large app (100K+ users): Custom pricing

## Next Steps

1. **Decide on database**: Neon (free) or Railway
2. **Deploy**: Run `./deploy.sh` or use dashboard
3. **Configure environment**: Add 3 environment variables
4. **Test**: Verify login and data persistence
5. **Share**: Get your live URL and share!

---

**Questions?** Check [VERCEL_QUICK_START.md](./VERCEL_QUICK_START.md) or [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for more details.
