-- CreateTable
CREATE TABLE "JiraTenant" (
    "id" TEXT NOT NULL,
    "clientKey" TEXT NOT NULL,
    "sharedSecret" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "productType" TEXT NOT NULL DEFAULT 'jira',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "uninstalledAt" TIMESTAMP(3),

    CONSTRAINT "JiraTenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JiraTenant_clientKey_key" ON "JiraTenant"("clientKey");

-- CreateIndex
CREATE INDEX "JiraTenant_clientKey_isActive_idx" ON "JiraTenant"("clientKey", "isActive");
