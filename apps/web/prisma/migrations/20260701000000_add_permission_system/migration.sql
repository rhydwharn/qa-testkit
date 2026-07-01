-- CreateEnum RoleType
CREATE TYPE "RoleType" AS ENUM ('TENANT_ROLE', 'PROJECT_ROLE');

-- CreateTable FeatureFlag
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "tenantId" TEXT,
    "featureName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable RolePermission
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "featureFlagId" TEXT NOT NULL,
    "roleType" "RoleType" NOT NULL,
    "roleName" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable PermissionAuditLog
CREATE TABLE "PermissionAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "tenantId" TEXT,
    "featureFlagId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermissionAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeatureFlag_projectId_featureName_idx" ON "FeatureFlag"("projectId", "featureName");

-- CreateIndex
CREATE INDEX "FeatureFlag_tenantId_featureName_idx" ON "FeatureFlag"("tenantId", "featureName");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_featureFlagId_roleType_roleName_key" ON "RolePermission"("featureFlagId", "roleType", "roleName");

-- CreateIndex
CREATE INDEX "RolePermission_featureFlagId_idx" ON "RolePermission"("featureFlagId");

-- CreateIndex
CREATE INDEX "PermissionAuditLog_userId_timestamp_idx" ON "PermissionAuditLog"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "PermissionAuditLog_projectId_timestamp_idx" ON "PermissionAuditLog"("projectId", "timestamp");

-- CreateIndex
CREATE INDEX "PermissionAuditLog_tenantId_timestamp_idx" ON "PermissionAuditLog"("tenantId", "timestamp");

-- CreateIndex
CREATE INDEX "PermissionAuditLog_featureFlagId_idx" ON "PermissionAuditLog"("featureFlagId");

-- AddForeignKey
ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_featureFlagId_fkey" FOREIGN KEY ("featureFlagId") REFERENCES "FeatureFlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionAuditLog" ADD CONSTRAINT "PermissionAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionAuditLog" ADD CONSTRAINT "PermissionAuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionAuditLog" ADD CONSTRAINT "PermissionAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionAuditLog" ADD CONSTRAINT "PermissionAuditLog_featureFlagId_fkey" FOREIGN KEY ("featureFlagId") REFERENCES "FeatureFlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
