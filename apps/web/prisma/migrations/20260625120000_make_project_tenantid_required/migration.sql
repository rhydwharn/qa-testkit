-- Make Project.tenantId non-nullable (all rows should have it after backfill)
ALTER TABLE "Project" ALTER COLUMN "tenantId" SET NOT NULL;

-- Drop old single-column unique on Project.key
DROP INDEX IF EXISTS "Project_key_key";

-- Add composite unique (tenantId, key)
CREATE UNIQUE INDEX "Project_tenantId_key_key" ON "Project"("tenantId", "key");
