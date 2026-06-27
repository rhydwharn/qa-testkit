-- CreateEnum
CREATE TYPE "LogoDisplay" AS ENUM ('LOGO_ONLY', 'NAME_ONLY', 'LOGO_AND_NAME');

-- DropIndex
DROP INDEX "Project_key_idx";

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "logoDisplay" "LogoDisplay" NOT NULL DEFAULT 'NAME_ONLY',
ADD COLUMN     "logoStorageKey" TEXT,
ADD COLUMN     "logoUrl" TEXT;
