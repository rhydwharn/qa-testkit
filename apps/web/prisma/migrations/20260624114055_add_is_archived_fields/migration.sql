-- AlterTable
ALTER TABLE "TestCase" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TestCycle" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TestPlan" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "TestCase_projectId_isArchived_idx" ON "TestCase"("projectId", "isArchived");

-- CreateIndex
CREATE INDEX "TestCycle_projectId_isArchived_idx" ON "TestCycle"("projectId", "isArchived");

-- CreateIndex
CREATE INDEX "TestPlan_projectId_isArchived_idx" ON "TestPlan"("projectId", "isArchived");
