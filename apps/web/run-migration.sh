#!/bin/bash

# Production Migration Script
# This script applies pending Prisma migrations to your production database

cd "$(dirname "$0")"

echo "🔄 Checking migration status..."
npx prisma migrate status

echo ""
echo "📦 Applying migrations..."
npx prisma migrate deploy

echo ""
echo "✅ Migrations complete! Your production database is now updated."
