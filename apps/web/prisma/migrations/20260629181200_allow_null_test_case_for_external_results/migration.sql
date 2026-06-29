-- Allow TestCaseExecution to have null testCaseId and testCaseVersionId for unmatched automation results
-- Add externalTestKey to store the requested test case key for unmatched results

ALTER TABLE "TestCaseExecution"
  ALTER COLUMN "testCaseId" DROP NOT NULL,
  ALTER COLUMN "testCaseVersionId" DROP NOT NULL;

ALTER TABLE "TestCaseExecution"
  ADD COLUMN "externalTestKey" TEXT;

-- Drop the foreign key constraint for testCaseId since it's now optional
ALTER TABLE "TestCaseExecution"
  DROP CONSTRAINT "TestCaseExecution_testCaseVersionId_fkey";

-- Add back the foreign key but make it optional
ALTER TABLE "TestCaseExecution"
  ADD CONSTRAINT "TestCaseExecution_testCaseVersionId_fkey"
  FOREIGN KEY ("testCaseVersionId")
  REFERENCES "TestCaseVersion" ("id");
