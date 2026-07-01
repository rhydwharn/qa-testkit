const { PrismaClient } = require('@prisma/client');

async function checkMigrations() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: "postgresql://postgres.jhueabhsipncuinwftxq:Lab33bah12345@aws-1-eu-north-1.pooler.supabase.com:6543/postgres"
      }
    }
  });

  try {
    console.log("Checking latest migrations...");
    const migrations = await prisma.$queryRaw`SELECT * FROM "_prisma_migrations" ORDER BY "executedAt" DESC LIMIT 3;`;
    console.log("✅ Latest 3 migrations applied:");
    migrations.forEach(m => console.log(`  - ${m.id.substring(0, 14)}: ${m.name}`));
    console.log("\n✅ Production database has migrations applied!");
    process.exit(0);
  } catch (error) {
    if (error.message.includes("does not exist")) {
      console.log("⚠️  No _prisma_migrations table found");
    } else {
      console.log("❌ Error:", error.message.substring(0, 100));
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkMigrations();
