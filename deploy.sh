#!/bin/bash

# QA TestKit Deployment Script
# This script deploys the application to Vercel

set -e

echo "🚀 QA TestKit Deployment Script"
echo "================================"
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

# Check if git is initialized
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Not a git repository. Please run 'git init' first."
    exit 1
fi

# Check if there are uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  You have uncommitted changes. Commit them first:"
    echo "   git add -A && git commit -m 'Your message'"
    exit 1
fi

# Check if remote is set
if ! git config --get remote.origin.url > /dev/null; then
    echo "❌ No remote repository set. Add it with:"
    echo "   git remote add origin https://github.com/USERNAME/REPO.git"
    exit 1
fi

echo "✅ Checks passed!"
echo ""

# Push to GitHub
echo "📤 Pushing to GitHub..."
git push -u origin main || true

echo ""
echo "🌐 Starting Vercel deployment..."
echo ""

# Deploy to Vercel
vercel

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Set environment variables in Vercel dashboard:"
echo "   - DATABASE_URL"
echo "   - NEXTAUTH_SECRET"
echo "   - NEXTAUTH_URL"
echo ""
echo "2. Run database migrations (if needed):"
echo "   DATABASE_URL='...' pnpm run db:push"
echo ""
echo "3. Visit your deployment at the URL provided above"
echo ""
