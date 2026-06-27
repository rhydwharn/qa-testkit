-- AlterTable
ALTER TABLE "TestCaseExecution" ADD COLUMN     "executionMethod" TEXT DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "TestCycle" ADD COLUMN     "createdById" TEXT;

-- AddForeignKey
ALTER TABLE "TestCycle" ADD CONSTRAINT "TestCycle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
