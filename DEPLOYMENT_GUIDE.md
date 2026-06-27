# Vercel Deployment Guide for QA TestKit

This guide walks you through deploying the QA TestKit application to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Account**: Your code needs to be on GitHub
3. **Vercel CLI** (optional): For local deployments
4. **Environment Variables**: Database URL and authentication secrets

## Step 1: Push to GitHub

First, ensure your code is on GitHub. If not yet pushed:

```bash
# From the project root
git push -u origin main
```

If you're getting permission errors, use a Personal Access Token:
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Create a token with `repo` scope
3. Use the token as your password when prompted

## Step 2: Connect to Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Import your GitHub repository (rhydwharn/qa-testkit)
4. Vercel will auto-detect Next.js
5. Configure environment variables (see below)
6. Deploy

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy from project root
vercel

# For production deployment
vercel --prod
```

## Step 3: Configure Environment Variables

In Vercel Dashboard, go to your project settings and add these environment variables:

### Required Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | Your database connection string | Use PostgreSQL in production |
| `NEXTAUTH_SECRET` | 32+ character random string | Generate with: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your Vercel deployment URL | Format: `https://your-app.vercel.app` |

### How to Generate NEXTAUTH_SECRET

**On macOS/Linux:**
```bash
openssl rand -base64 32
```

**On Windows (PowerShell):**
```powershell
[Convert]::ToBase64String((1..32|%{[byte]$_})|Get-Random -Count 32)
```

## Step 4: Database Setup

### Option A: Use PostgreSQL from a Cloud Provider

Popular choices:
- **Neon**: https://neon.tech (Free tier available)
- **Supabase**: https://supabase.com (PostgreSQL + Auth)
- **Railway**: https://railway.app (Easy deployment)

1. Create a PostgreSQL database
2. Note the connection string
3. Add to Vercel environment variables as `DATABASE_URL`

### Option B: Deploy Database on Railway/Render

```bash
# Railway example
railway login
railway init  # Select PostgreSQL
# Get connection string and add to Vercel
```

## Step 5: Run Migrations on Production

After deployment, you need to run Prisma migrations on your production database:

```bash
# From your local machine
DATABASE_URL="your_production_db_url" pnpm run db:push
```

Or add a deployment hook to Vercel:

1. In Vercel Dashboard → Project Settings → Git
2. Add a "Deploy Hook"
3. In the build command, add: `pnpm run db:push`

## Step 6: Verify Deployment

Once deployed:

1. Visit your Vercel URL: `https://your-project-name.vercel.app`
2. Check that the application loads
3. Test login functionality
4. Verify data persistence

## Troubleshooting

### Build Fails with "database connection error"

**Solution**: Make sure `DATABASE_URL` is set in Vercel environment variables before deployment.

### Application loads but shows database error

**Solution**: Run migrations:
```bash
DATABASE_URL="your_production_db_url" pnpm run db:push
```

### NextAuth errors after deployment

**Solution**: 
1. Verify `NEXTAUTH_SECRET` is set (32+ characters)
2. Verify `NEXTAUTH_URL` matches your Vercel domain
3. Restart the deployment

### Monorepo build issues

**Solution**: Vercel should auto-detect the monorepo structure. If not:
1. Go to Settings → Build & Development Settings
2. Set "Root Directory" to `.` (root)
3. Set "Build Command" to `cd apps/web && pnpm run build`
4. Set "Output Directory" to `apps/web/.next`

## Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Vercel project created
- [ ] DATABASE_URL environment variable set
- [ ] NEXTAUTH_SECRET environment variable set
- [ ] NEXTAUTH_URL environment variable set
- [ ] Database migrations run on production
- [ ] Application accessible at Vercel URL
- [ ] Login functionality works
- [ ] Data persists after page refresh

## Post-Deployment

After successful deployment:

1. **Monitor**: Check Vercel Analytics for performance
2. **Logs**: View deployment logs in Vercel Dashboard
3. **Testing**: Test all critical features
4. **DNS**: (Optional) Add custom domain in Vercel settings

## Custom Domain

To add a custom domain:

1. In Vercel Dashboard → Settings → Domains
2. Add your domain
3. Update DNS records according to Vercel's instructions
4. Update `NEXTAUTH_URL` to your custom domain

## Redeployment

To trigger a new deployment:

1. **Automatic**: Push to main branch
2. **Manual**: Vercel Dashboard → Deployments → Redeploy
3. **Via CLI**: `vercel --prod`

## Support

- Vercel Docs: https://vercel.com/docs
- Next.js Docs: https://nextjs.org/docs
- Prisma Docs: https://www.prisma.io/docs

## Quick Start Commands

```bash
# Setup locally
pnpm install
pnpm run dev

# Build locally
pnpm run build

# Deploy to production
vercel --prod

# View logs
vercel logs --follow
```
