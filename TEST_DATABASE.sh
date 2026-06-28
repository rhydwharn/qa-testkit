#!/bin/bash

# QA TestKit - Database Connection Test Script
# Run this locally to verify your database connection

DB_URL="postgresql://postgres:Lab33bah12#\$@db.jhueabhsipncuinwftxq.supabase.co:5432/postgres"

echo "════════════════════════════════════════════════════════════"
echo "  🔍 QA TestKit - Database Connection Test"
echo "════════════════════════════════════════════════════════════"
echo ""

# Test 1: Network Connectivity
echo "Test 1: Network Connectivity"
echo "───────────────────────────"
echo "Testing connection to: db.jhueabhsipncuinwftxq.supabase.co:5432"

if nc -zv db.jhueabhsipncuinwftxq.supabase.co 5432 2>&1 | grep -q "succeeded\|succeeded!"; then
    echo "✅ Network: CONNECTED"
else
    echo "❌ Network: FAILED - Cannot reach database server"
    echo "   Check: Supabase is running, firewall allows port 5432"
    exit 1
fi
echo ""

# Test 2: Prisma Connection
echo "Test 2: Prisma Connection Test"
echo "──────────────────────────────"

cd "$(dirname "$0")/apps/web" || exit 1

# Create a test Prisma query
cat > /tmp/test_prisma.js << 'EOF'
const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  const prisma = new PrismaClient();

  try {
    console.log("Testing Prisma connection...");

    // Test basic connection
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log("✅ Prisma Connected");

    // Get database info
    const info = await prisma.$queryRaw`
      SELECT
        current_database() as database,
        current_user as user,
        version() as version
    `;

    console.log("✅ Database Information:");
    console.log(`   Database: ${info[0].database}`);
    console.log(`   User: ${info[0].user}`);
    console.log(`   PostgreSQL: ${info[0].version.split(',')[0]}`);
    console.log("");

    // Check for tables
    const tables = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    console.log("✅ Database Tables:");
    if (tables.length === 0) {
      console.log("   ⚠️  No tables found");
      console.log("   Action: Run 'pnpm run db:push' to create tables");
    } else {
      console.log(`   Found ${tables.length} table(s):`);
      tables.forEach(t => console.log(`   • ${t.table_name}`));
    }

    console.log("");
    console.log("✅ DATABASE CONNECTION: WORKING!");

    process.exit(0);
  } catch (error) {
    console.log("❌ Connection Failed");
    console.log(`Error: ${error.message}`);
    console.log("");

    // Diagnose issue
    if (error.message.includes('ECONNREFUSED')) {
      console.log("Issue: Cannot reach database - connection refused");
    } else if (error.message.includes('ETIMEDOUT')) {
      console.log("Issue: Connection timeout - database not responding");
    } else if (error.message.includes('password')) {
      console.log("Issue: Authentication failed - check password in DATABASE_URL");
    } else if (error.message.includes('does not exist')) {
      console.log("Issue: Database does not exist");
    } else if (error.message.includes('user')) {
      console.log("Issue: User authentication problem");
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
EOF

# Run the test
echo "Running Prisma test..."
DATABASE_URL="$DB_URL" npx ts-node /tmp/test_prisma.js 2>&1 || \
  DATABASE_URL="$DB_URL" node /tmp/test_prisma.js 2>&1

if [ $? -eq 0 ]; then
    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo "  ✅ ALL TESTS PASSED - DATABASE IS READY!"
    echo "════════════════════════════════════════════════════════════"
    echo ""
    echo "Next steps:"
    echo "  1. Deploy to Vercel: https://vercel.com/dashboard/projects/qa-testkit"
    echo "  2. After deployment shows 'READY', run migrations:"
    echo "     DATABASE_URL=\"$DB_URL\" pnpm run db:push"
    echo "  3. Visit: https://qa-testkit.vercel.app"
    echo ""
else
    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo "  ❌ DATABASE CONNECTION TEST FAILED"
    echo "════════════════════════════════════════════════════════════"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Verify DATABASE_URL: $DB_URL"
    echo "  2. Check Supabase dashboard: https://app.supabase.com"
    echo "  3. Verify database is running"
    echo "  4. Check firewall allows port 5432"
    echo ""
fi
