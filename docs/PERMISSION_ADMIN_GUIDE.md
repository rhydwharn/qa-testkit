# Permission Management System - Admin Guide

## Overview

This guide provides system administrators with comprehensive information for managing, monitoring, and troubleshooting the role-based permission management system.

## Architecture

### Data Model

```
Tenant/Workspace
    ├─ FeatureFlag (workspace-level defaults)
    │   └─ RolePermission (TENANT_ROLE)
    │
Project
    ├─ FeatureFlag (project-specific overrides)
    │   └─ RolePermission (PROJECT_ROLE)
    │
PermissionAuditLog (tracks all permission denials)
```

### Permission Check Flow

```
1. User attempts action in project
2. API checks: canUserDoAction(userId, projectId, featureName)
3. Check project-level feature flag first
4. If no project override, check workspace default
5. Check RolePermission for user's role
6. Allow if enabled, deny if disabled
7. Log denial to PermissionAuditLog
```

## Database Schema

### FeatureFlag Table

```sql
CREATE TABLE "FeatureFlag" (
    id TEXT PRIMARY KEY,
    projectId TEXT NULL,      -- NULL = workspace-level
    tenantId TEXT NULL,       -- NULL = project-level
    featureName TEXT NOT NULL,
    description TEXT NOT NULL,
    isEnabled BOOLEAN DEFAULT true,
    createdAt TIMESTAMP DEFAULT now(),
    updatedAt TIMESTAMP DEFAULT now()
);

-- Indexes for performance
CREATE INDEX "FeatureFlag_projectId_featureName_idx" ON "FeatureFlag"(projectId, featureName);
CREATE INDEX "FeatureFlag_tenantId_featureName_idx" ON "FeatureFlag"(tenantId, featureName);
```

### RolePermission Table

```sql
CREATE TABLE "RolePermission" (
    id TEXT PRIMARY KEY,
    featureFlagId TEXT NOT NULL REFERENCES "FeatureFlag"(id) ON DELETE CASCADE,
    roleType TEXT NOT NULL,  -- 'TENANT_ROLE' or 'PROJECT_ROLE'
    roleName TEXT NOT NULL,  -- e.g., 'OWNER', 'LEAD', 'TESTER'
    isEnabled BOOLEAN DEFAULT true,
    createdAt TIMESTAMP DEFAULT now(),
    updatedAt TIMESTAMP DEFAULT now(),
    UNIQUE(featureFlagId, roleType, roleName)
);

CREATE INDEX "RolePermission_featureFlagId_idx" ON "RolePermission"(featureFlagId);
```

### PermissionAuditLog Table

```sql
CREATE TABLE "PermissionAuditLog" (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    projectId TEXT NULL REFERENCES "Project"(id) ON DELETE SET NULL,
    tenantId TEXT NULL REFERENCES "Tenant"(id) ON DELETE SET NULL,
    featureFlagId TEXT NOT NULL REFERENCES "FeatureFlag"(id) ON DELETE CASCADE,
    action TEXT NOT NULL,    -- 'DENIED' (only denials are logged)
    reason TEXT NOT NULL,    -- Why permission was denied
    timestamp TIMESTAMP DEFAULT now()
);

CREATE INDEX "PermissionAuditLog_userId_timestamp_idx" ON "PermissionAuditLog"(userId, timestamp);
CREATE INDEX "PermissionAuditLog_projectId_timestamp_idx" ON "PermissionAuditLog"(projectId, timestamp);
CREATE INDEX "PermissionAuditLog_tenantId_timestamp_idx" ON "PermissionAuditLog"(tenantId, timestamp);
CREATE INDEX "PermissionAuditLog_featureFlagId_idx" ON "PermissionAuditLog"(featureFlagId);
```

## API Reference

### Workspace-Level Endpoints

#### GET `/api/tenants/[tenantId]/settings/permissions`
Returns all workspace-level permissions

**Response**:
```json
{
  "featureFlags": [
    {
      "id": "ff-1",
      "featureName": "TEST_CASE_CREATE",
      "description": "Create test cases",
      "isEnabled": true,
      "rolePermissions": [
        {
          "id": "rp-1",
          "roleName": "OWNER",
          "isEnabled": true
        },
        {
          "id": "rp-2",
          "roleName": "MEMBER",
          "isEnabled": true
        }
      ]
    }
  ]
}
```

#### PUT `/api/tenants/[tenantId]/settings/permissions`
Update workspace-level permissions

**Request Body**:
```json
{
  "permissions": [
    {
      "featureName": "TEST_CASE_DELETE",
      "roleName": "MEMBER",
      "isEnabled": false
    }
  ]
}
```

### Project-Level Endpoints

#### GET `/api/projects/[projectId]/settings/permissions`
Returns both project and workspace permissions

**Response**:
```json
{
  "projectFeatures": [
    { "featureName": "TEST_CASE_CREATE", "isEnabled": true }
  ],
  "workspaceDefaults": [
    { "featureName": "TEST_CYCLE_EXECUTE", "isEnabled": true }
  ]
}
```

#### PUT `/api/projects/[projectId]/settings/permissions`
Update project-specific permissions or revert to workspace defaults

**Request Body** (Override):
```json
{
  "permissions": [
    {
      "featureName": "TEST_CASE_DELETE",
      "roleName": "TESTER",
      "isEnabled": false
    }
  ]
}
```

**Request Body** (Revert to defaults):
```json
{
  "useWorkspaceDefaults": true
}
```

### Permission Preview Endpoint

#### GET `/api/projects/[projectId]/permissions/preview?role=TESTER`
Preview what a role can access (useful for invitations)

**Response**:
```json
{
  "role": "TESTER",
  "allowedFeatures": [
    {
      "featureName": "TEST_CASE_READ",
      "description": "View test cases"
    },
    {
      "featureName": "TEST_CASE_EXECUTE",
      "description": "Execute test cycles"
    }
  ],
  "featureCount": 8
}
```

## Monitoring and Maintenance

### Checking Current Configuration

**Get all workspace permissions**:
```sql
SELECT ff.featureName, rp.roleName, rp.isEnabled
FROM "FeatureFlag" ff
JOIN "RolePermission" rp ON ff.id = rp.featureFlagId
WHERE ff.tenantId = 'tenant-id'
  AND ff.projectId IS NULL
ORDER BY ff.featureName, rp.roleName;
```

**Get project-specific overrides**:
```sql
SELECT ff.featureName, rp.roleName, rp.isEnabled
FROM "FeatureFlag" ff
JOIN "RolePermission" rp ON ff.id = rp.featureFlagId
WHERE ff.projectId = 'project-id'
  AND ff.tenantId IS NULL
ORDER BY ff.featureName, rp.roleName;
```

**Check which projects have custom permissions**:
```sql
SELECT DISTINCT projectId
FROM "FeatureFlag"
WHERE projectId IS NOT NULL
ORDER BY projectId;
```

### Audit Log Analysis

**Recent permission denials**:
```sql
SELECT 
  pal.timestamp,
  u.email AS user_email,
  pal.action,
  pal.reason,
  ff.featureName
FROM "PermissionAuditLog" pal
JOIN "User" u ON pal.userId = u.id
JOIN "FeatureFlag" ff ON pal.featureFlagId = ff.id
WHERE pal.timestamp > now() - interval '24 hours'
  AND pal.action = 'DENIED'
ORDER BY pal.timestamp DESC;
```

**Permission denials by feature**:
```sql
SELECT 
  ff.featureName,
  COUNT(*) as denial_count,
  COUNT(DISTINCT pal.userId) as unique_users
FROM "PermissionAuditLog" pal
JOIN "FeatureFlag" ff ON pal.featureFlagId = ff.id
WHERE pal.action = 'DENIED'
  AND pal.timestamp > now() - interval '7 days'
GROUP BY ff.featureName
ORDER BY denial_count DESC;
```

**Permission denials by user**:
```sql
SELECT 
  u.email,
  COUNT(*) as denial_count,
  COUNT(DISTINCT ff.featureName) as unique_features
FROM "PermissionAuditLog" pal
JOIN "User" u ON pal.userId = u.id
JOIN "FeatureFlag" ff ON pal.featureFlagId = ff.id
WHERE pal.action = 'DENIED'
  AND pal.timestamp > now() - interval '7 days'
GROUP BY u.id, u.email
ORDER BY denial_count DESC;
```

### Performance Monitoring

**Check FeatureFlag table size**:
```sql
SELECT 
  COUNT(*) as total_feature_flags,
  COUNT(DISTINCT projectId) as projects_with_customization,
  COUNT(DISTINCT tenantId) as workspaces
FROM "FeatureFlag";
```

**Check audit log growth**:
```sql
SELECT 
  DATE_TRUNC('day', timestamp)::date as day,
  COUNT(*) as denial_count
FROM "PermissionAuditLog"
WHERE action = 'DENIED'
GROUP BY DATE_TRUNC('day', timestamp)
ORDER BY day DESC
LIMIT 30;
```

## Troubleshooting

### Issue: Permission checks timing out

**Symptoms**: API requests are slow, permission checks taking >500ms

**Diagnosis**:
```sql
-- Check if indexes exist
SELECT * FROM pg_indexes 
WHERE tablename = 'FeatureFlag' OR tablename = 'RolePermission';

-- Check FeatureFlag table size
SELECT pg_size_pretty(pg_total_relation_size('FeatureFlag'));
```

**Solution**:
1. Ensure indexes are created (see Database Schema section)
2. Consider archiving old audit logs
3. Add database connection pooling

### Issue: Permission denials increase unexpectedly

**Symptoms**: Audit logs show many permission denials

**Diagnosis**:
```sql
-- Find recently added restrictions
SELECT ff.featureName, rp.roleName, rp.updatedAt
FROM "RolePermission" rp
JOIN "FeatureFlag" ff ON rp.featureFlagId = ff.id
WHERE rp.updatedAt > now() - interval '24 hours'
  AND rp.isEnabled = false
ORDER BY rp.updatedAt DESC;
```

**Solution**:
1. Review recent permission changes
2. Check if change was intentional
3. Revert if necessary, or notify users of new restrictions

### Issue: Projects not inheriting workspace defaults

**Symptoms**: New projects don't use workspace permissions

**Diagnosis**:
```sql
-- Check if project has custom permissions when it shouldn't
SELECT COUNT(*) as custom_perms
FROM "FeatureFlag"
WHERE projectId = 'problematic-project-id';

-- Should be 0 if using workspace defaults
```

**Solution**:
1. Check project creation code
2. Verify initializeProjectFeatures() is called
3. Review project settings UI for inheritance status

### Issue: Workspace permissions not applying to new projects

**Symptoms**: New projects don't use workspace defaults

**Diagnosis**:
```sql
-- Check if workspace has permissions defined
SELECT COUNT(*) 
FROM "FeatureFlag" 
WHERE tenantId = 'workspace-id' AND projectId IS NULL;
```

**Solution**:
1. Ensure workspace admin set permissions
2. Initialize workspace defaults via workspace settings UI
3. Verify permission API is working

## Maintenance Tasks

### Daily
- Monitor audit logs for unusual patterns
- Check for failed permission checks in application logs

### Weekly
- Review permission denials by feature
- Check audit log table size
- Verify no permission configuration drift

### Monthly
- Analyze permission usage patterns
- Identify unused features or roles
- Review and optimize workspace defaults

### Quarterly
- Archive old audit logs (>90 days)
- Review permission structure for business changes
- Update documentation if needed

### Ad-hoc
- When new feature added: Add FeatureFlag entries and RolePermission for all roles
- When new role added: Add RolePermission entries for all existing features
- When workspace created: Initialize default workspace permissions
- When project created: Initialize project with workspace defaults

## Best Practices

### For System Configuration

1. **Start permissive**: Initialize all features as enabled for all roles
2. **Restrict gradually**: Start restricting access only when needed
3. **Test thoroughly**: Use admin testing dashboard before enforcing restrictions
4. **Document decisions**: Record why specific permissions are configured

### For Audit Logs

1. **Regular review**: Review audit logs weekly for patterns
2. **Archive old logs**: Delete logs older than 90 days if not needed for compliance
3. **Alert on anomalies**: Setup alerts for unusual permission denial patterns
4. **Track by feature**: Monitor which features cause most denials

### For Performance

1. **Index usage**: Ensure all recommended indexes are created
2. **Audit log retention**: Don't keep audit logs forever; archive/delete old ones
3. **Permission caching**: Consider caching permission results for short periods
4. **Database optimization**: Run ANALYZE regularly on permission tables

### For Security

1. **Audit trail**: Maintain audit logs for compliance
2. **Fail-secure**: Default to denying access when permission check fails
3. **Role validation**: Verify users are assigned correct roles
4. **Change tracking**: Track all permission configuration changes

## Recovery Procedures

### Restore Workspace Defaults

If workspace defaults are corrupted:

```sql
-- Backup current settings
CREATE TABLE "FeatureFlag_backup" AS SELECT * FROM "FeatureFlag";

-- Reset workspace defaults by deleting and recreating
DELETE FROM "FeatureFlag" 
WHERE tenantId = 'workspace-id' AND projectId IS NULL;

-- Recreate via API call or manual SQL insert
```

### Restore Project Permissions

If project permissions are lost:

```sql
-- Check if project has custom permissions
SELECT COUNT(*) FROM "FeatureFlag" WHERE projectId = 'project-id';

-- If 0, project will use workspace defaults (correct)
-- If corrupted, delete and project reverts to workspace defaults
DELETE FROM "FeatureFlag" WHERE projectId = 'project-id';
```

### Audit Log Recovery

If audit logs need to be reviewed:

```sql
-- Export audit logs to CSV
COPY (
  SELECT * FROM "PermissionAuditLog"
  WHERE timestamp > '2024-01-01'
  ORDER BY timestamp DESC
) TO '/tmp/audit_logs.csv' WITH CSV HEADER;
```

## Version History

### v1.0 (Initial Release)
- Workspace-level permission defaults
- Project-level permission overrides
- 20+ feature flags
- Audit logging for permission denials
- Admin testing dashboard
- Permission inheritance model

## Support and Escalation

For issues that cannot be resolved using this guide:

1. Check application logs for stack traces
2. Export relevant audit logs and configuration
3. Run diagnostic queries from Troubleshooting section
4. Contact platform team with diagnostic information
