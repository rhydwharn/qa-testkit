-- Add isExternal flag to TestCase
-- This field tracks test cases that were auto-created from unmatched automation results

ALTER TABLE "TestCase" ADD COLUMN "isExternal" BOOLEAN NOT NULL DEFAULT false;

-- Create index for filtering external test cases
CREATE INDEX "TestCase_isExternal_idx" ON "TestCase"("isExternal");
