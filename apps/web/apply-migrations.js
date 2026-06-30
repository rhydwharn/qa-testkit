const { PrismaClient } = require('@prisma/client');

async function applyMigrations() {
  const prisma = new PrismaClient();

  try {
    console.log('Applying migrations...\n');

    // Migration 1: Add isExternal flag
    try {
      console.log('1. Adding isExternal column to TestCase...');
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "TestCase" ADD COLUMN "isExternal" BOOLEAN NOT NULL DEFAULT false`
      );
      console.log('   ✅ Column added');

      await prisma.$executeRawUnsafe(
        `CREATE INDEX "TestCase_isExternal_idx" ON "TestCase"("isExternal")`
      );
      console.log('   ✅ Index created\n');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('   ℹ️  Column already exists - skipping\n');
      } else {
        throw e;
      }
    }

    // Migration 2: Allow null testCaseId
    try {
      console.log('2. Making testCaseId and testCaseVersionId nullable...');
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "TestCaseExecution" ALTER COLUMN "testCaseId" DROP NOT NULL`
      );
      console.log('   ✅ testCaseId nullable');

      await prisma.$executeRawUnsafe(
        `ALTER TABLE "TestCaseExecution" ALTER COLUMN "testCaseVersionId" DROP NOT NULL`
      );
      console.log('   ✅ testCaseVersionId nullable\n');
    } catch (e) {
      if (e.message.includes('already exists') || e.message.includes('does not exist')) {
        console.log('   ℹ️  Columns already updated - skipping\n');
      } else {
        throw e;
      }
    }

    // Add externalTestKey if it doesn't exist
    try {
      console.log('3. Adding externalTestKey column...');
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "TestCaseExecution" ADD COLUMN "externalTestKey" TEXT`
      );
      console.log('   ✅ Column added\n');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('   ℹ️  Column already exists - skipping\n');
      } else {
        throw e;
      }
    }

    console.log('✅ All migrations applied successfully!');
    console.log('\nYour production database is now updated.');
    console.log('Refresh your Vercel deployment and it should work!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigrations();
