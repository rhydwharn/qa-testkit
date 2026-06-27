# Final Deployment Steps - Complete Guide

Your environment variables are ready! Follow these steps to deploy your QA TestKit to Vercel.

## 🔑 Your Configuration

```
DATABASE_URL: postgresql://postgres:Lab33bah12#$@db.jhueabhsipncuinwftxq.supabase.co:5432/postgres
NEXTAUTH_SECRET: eduxmAizaQXSRzOGzVxSSdujWytGBRH8Nauz7SfitTk=
NEXTAUTH_URL: https://qa-testkit.vercel.app
```

---

## Step 1: Push Code to GitHub

### Option A: Using GitHub CLI (Easiest)

```bash
cd /Users/ridwanabdulazeez/Documents/TestManagementTool

# Login to GitHub
gh auth login

# Push to your repository
git push -u origin main
```

### Option B: Using Git with Token

1. Generate a Personal Access Token:
   - Go to https://github.com/settings/tokens
   - Click "Generate new token" → "Generate new token (classic)"
   - Select scopes: `repo`, `workflow`
   - Copy the token

2. Push using token:
   ```bash
   cd /Users/ridwanabdulazeez/Documents/TestManagementTool
   
   # When prompted for password, use the token:
   git push -u origin main
   # Username: rhydwharn
   # Password: [paste your token]
   ```

### Option C: Using SSH (If Configured)

```bash
cd /Users/ridwanabdulazeez/Documents/TestManagementTool
git remote set-url origin git@github.com:rhydwharn/qa-testkit.git
git push -u origin main
```

---

## Step 2: Create Vercel Project

### Via Vercel Dashboard (Recommended)

1. Go to https://vercel.com/dashboard
2. Click **"Add New Project"**
3. Click **"Import Git Repository"**
4. Search for and select: **rhydwharn/qa-testkit**
5. Click **"Import"**

Vercel will auto-detect:
- ✅ Framework: Next.js
- ✅ Root Directory: ./apps/web
- ✅ Build Command: (auto-configured)
- ✅ Output Directory: (auto-configured)

6. Click **"Deploy"**

The initial deploy will fail because environment variables aren't set yet. That's OK!

---

## Step 3: Configure Environment Variables

### In Vercel Dashboard:

1. After import, go to your project → **Settings** → **Environment Variables**
2. Add these three variables:

**Variable 1:**
```
Name: DATABASE_URL
Value: postgresql://postgres:Lab33bah12#$@db.jhueabhsipncuinwftxq.supabase.co:5432/postgres
```

**Variable 2:**
```
Name: NEXTAUTH_SECRET
Value: eduxmAizaQXSRzOGzVxSSdujWytGBRH8Nauz7SfitTk=
```

**Variable 3:**
```
Name: NEXTAUTH_URL
Value: https://qa-testkit.vercel.app
```

Click **"Save"** after adding all three variables.

---

## Step 4: Trigger Redeploy

1. In Vercel Dashboard → **Deployments**
2. Find your latest deployment (that failed)
3. Click **"..." → "Redeploy"**

**OR** push an empty commit to trigger redeploy:

```bash
cd /Users/ridwanabdulazeez/Documents/TestManagementTool
git commit --allow-empty -m "Trigger Vercel redeploy with environment variables"
git push
```

---

## Step 5: Run Database Migrations

After deployment succeeds, run this command locally to set up your database tables:

```bash
cd /Users/ridwanabdulazeez/Documents/TestManagementTool/apps/web

# Install dependencies (if not already installed)
pnpm install

# Run migrations
DATABASE_URL="postgresql://postgres:Lab33bah12#\$@db.jhueabhsipncuinwftxq.supabase.co:5432/postgres" \
pnpm run db:push
```

**Note:** On Windows PowerShell, escape the `$`:
```powershell
$env:DATABASE_URL="postgresql://postgres:Lab33bah12#`$@db.jhueabhsipncuinwftxq.supabase.co:5432/postgres"
pnpm run db:push
```

---

## Step 6: Verify Deployment

1. Visit: **https://qa-testkit.vercel.app**
2. You should see the login page
3. Try signing up with a test account
4. Create a test cycle to verify database is working
5. Refresh page to verify data persists

---

## 🔍 Troubleshooting

### Deployment shows "Build failed"

**Check:**
1. Environment variables are saved in Vercel
2. Database URL is correct
3. Check build logs in Vercel dashboard

**Solution:**
```bash
# Redeploy with environment variables
git commit --allow-empty -m "Retry deployment"
git push
```

### Application loads but shows "Cannot connect to database"

**Solution:** Run migrations:
```bash
cd /Users/ridwanabdulazeez/Documents/TestManagementTool/apps/web
DATABASE_URL="postgresql://postgres:Lab33bah12#\$@db.jhueabhsipncuinwftxq.supabase.co:5432/postgres" \
pnpm run db:push
```

### Login doesn't work or "Authentication error"

**Check:**
1. NEXTAUTH_SECRET is exactly: `eduxmAizaQXSRzOGzVxSSdujWytGBRH8Nauz7SfitTk=`
2. NEXTAUTH_URL is exactly: `https://qa-testkit.vercel.app`
3. Both are set in Vercel environment variables
4. Redeploy after setting variables

**Solution:**
```bash
# Verify variables in Vercel dashboard Settings → Environment Variables
# Then redeploy
```

### "Database connection rejected" error

**Possible causes:**
- Database credentials are wrong
- Supabase database isn't accepting connections
- Firewall blocking connection

**Solution:**
1. Test connection locally:
   ```bash
   psql "postgresql://postgres:Lab33bah12#\$@db.jhueabhsipncuinwftxq.supabase.co:5432/postgres"
   ```
2. If it fails, check Supabase dashboard for:
   - Database is running
   - Network access is allowed (check Supabase settings)

---

## ✅ Deployment Checklist

- [ ] Code pushed to GitHub (`rhydwharn/qa-testkit`)
- [ ] Vercel project created from GitHub repo
- [ ] Vercel project named: `qa-testkit` (or your preferred name)
- [ ] Environment variable `DATABASE_URL` set in Vercel
- [ ] Environment variable `NEXTAUTH_SECRET` set in Vercel
- [ ] Environment variable `NEXTAUTH_URL` set in Vercel
- [ ] Deployment redeploy triggered (should succeed now)
- [ ] Deployment shows "Ready" status
- [ ] Database migrations run locally
- [ ] Application loads at https://qa-testkit.vercel.app
- [ ] Can create account and sign in
- [ ] Can create test cycle and verify persistence

---

## 🎯 Expected Timeline

- Push to GitHub: 2 minutes
- Create Vercel project: 3 minutes
- Set environment variables: 2 minutes
- First deployment: 3-5 minutes
- Run migrations: 1 minute
- Verify it works: 2 minutes

**Total: ~15 minutes**

---

## 📝 Git Commits Ready

Your code is already committed locally with these commits:

```
5c1a0fb Mark project ready for Vercel deployment
0d8b0f7 Add comprehensive deployment documentation
b5550b6 Add deployment scripts and quick start guide
10ebd0e Add Vercel deployment configuration and guide
5e13d12 Initial commit: Test Management Tool with all features and bug fixes
```

Just push them with:
```bash
git push -u origin main
```

---

## 🆘 Still Having Issues?

### Check Vercel Logs
In Vercel Dashboard → Deployments → Click deployment → View logs

### Test Database Locally
```bash
# Test Supabase connection
psql "postgresql://postgres:Lab33bah12#\$@db.jhueabhsipncuinwftxq.supabase.co:5432/postgres"

# Or use Prisma Studio to test
cd apps/web
pnpm run db:studio
```

### Check Application Logs
After deployment, visit Vercel dashboard → Deployments → Click deployment → Runtime logs

---

## 📞 Need Help?

- **Vercel Status**: https://www.vercel-status.com
- **Supabase Status**: https://status.supabase.com
- **Documentation**: See [README_DEPLOYMENT.md](./README_DEPLOYMENT.md)

---

## 🎉 You're Almost There!

Just push to GitHub and follow the steps above. Your app will be live within 15 minutes!

**Next:** `git push -u origin main`
