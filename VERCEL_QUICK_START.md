# Vercel Deployment - Quick Start

## 🚀 Fastest Way to Deploy (5 minutes)

### 1️⃣ Push to GitHub (if not done yet)

```bash
git push -u origin main
```

### 2️⃣ Deploy to Vercel

**Option A: Using Script (Recommended)**
```bash
# macOS/Linux
./deploy.sh

# Windows
deploy.bat
```

**Option B: Manual via Dashboard**
- Go to https://vercel.com/dashboard
- Click "Add New Project"
- Select your GitHub repo
- Click "Deploy"

### 3️⃣ Add Environment Variables

In Vercel Dashboard → Project Settings → Environment Variables:

```
DATABASE_URL = postgresql://...your database connection...
NEXTAUTH_SECRET = (generate with: openssl rand -base64 32)
NEXTAUTH_URL = https://your-app.vercel.app
```

### 4️⃣ Run Database Migrations

```bash
DATABASE_URL="your_production_url" pnpm run db:push
```

### ✅ Done! Your app is live!

---

## 🔗 Useful Links

- **View Deployment**: https://vercel.com/dashboard
- **View Logs**: Your project → Deployments → View Details
- **Redeploy**: Push to `main` branch (automatic)
- **Custom Domain**: Settings → Domains

## 📝 Required Environment Variables

| Variable | Example | Where to get |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://user:pass@host/db` | Cloud provider (Neon, Railway, etc) |
| `NEXTAUTH_SECRET` | `abc123def456...` (32+ chars) | Generate locally |
| `NEXTAUTH_URL` | `https://app.vercel.app` | Your Vercel URL |

## 🔑 Generate NEXTAUTH_SECRET

```bash
# macOS/Linux
openssl rand -base64 32

# Windows PowerShell
-join ([char[]]'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'|Get-Random -Count 32)
```

## 🆘 Troubleshooting

**Build failed?**
- Check environment variables are set
- Ensure DATABASE_URL is correct

**App not loading?**
- Run migrations: `DATABASE_URL="..." pnpm run db:push`
- Check NEXTAUTH_URL matches your domain

**Need help?**
- See full guide: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- Vercel docs: https://vercel.com/docs
