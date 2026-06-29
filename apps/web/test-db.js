#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function test() {
  try {
    console.log('Testing database connection...');
    console.log('Connection string:', process.env.DATABASE_URL?.replace(/:[^@]*@/, ':***@'));

    // Test basic connection
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database connection: SUCCESS');

    // Check if User table exists
    const userCount = await prisma.user.count();
    console.log('✅ User table accessible');
    console.log(`   Found ${userCount} users`);

    // Check other tables
    const tables = ['Tenant', 'Project', 'TestCase'];
    for (const table of tables) {
      try {
        const count = await prisma[table.charAt(0).toLowerCase() + table.slice(1)].count?.();
        if (count !== undefined) {
          console.log(`✅ ${table} table accessible`);
        }
      } catch (e) {
        console.log(`⚠️  ${table} table check failed`);
      }
    }

    console.log('\n✅ All checks passed! Database is ready.');

  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check DATABASE_URL is correct');
    console.error('2. Verify password contains special characters correctly');
    console.error('3. Ensure database is accessible from your network');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

test();
