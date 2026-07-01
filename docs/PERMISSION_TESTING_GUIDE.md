# Permission Management System - Testing Guide

This guide provides comprehensive instructions for testing the role-based permission management system.

## Overview

The permission system controls which features each project member can access based on their assigned role. Testing validates that:
- Permissions are correctly enforced at both workspace and project levels
- Users can only access features enabled for their role
- Permission changes take effect immediately
- Inheritance from workspace to project works correctly

## Quick Start

### Admin Permission Testing Dashboard
Access the testing dashboard at: `/admin/permissions-test`

This tool allows you to:
- Test individual feature permissions for specific roles
- Run comprehensive test suites (all roles × all features)
- Export results as CSV for documentation
- Verify permission configurations before inviting users

## Manual Testing Scenarios

### Scenario 1: Workspace Permission Defaults

**Objective**: Verify that workspace-level permissions serve as defaults for new projects

**Steps**:
1. Navigate to Settings → Workspace Permissions
2. Locate the TEST_CASE_CREATE feature
3. Disable it for the TESTER role
4. Create a new project
5. Assign a user as TESTER to the new project
6. As TESTER, verify you CANNOT create test cases

**Expected Result**: TESTER users cannot create test cases in new projects (inheritance working)

### Scenario 2: Project-Level Permission Override

**Objective**: Verify that project-specific permissions override workspace defaults

**Steps**:
1. In an existing project, navigate to Settings → Permissions
2. Click "Customize Permissions for This Project"
3. Enable TEST_CASE_DELETE for TESTER (if disabled at workspace level)
4. Assign a user as TESTER to the project
5. As TESTER, verify you CAN delete test cases in this project only

**Expected Result**: TESTER users can delete test cases in this specific project, but not in other projects (project override working)

### Scenario 3: Role Granularity - Mixed Permissions

**Objective**: Verify different features have different permissions per role

**Steps**:
1. In project settings, ensure:
   - TEST_CASE_CREATE: ✓ LEAD, ✗ TESTER
   - TEST_CASE_DELETE: ✗ LEAD, ✓ TESTER
2. Create two users: one LEAD, one TESTER
3. As LEAD: Try to create a test case (should succeed) and delete it (should fail)
4. As TESTER: Try to create a test case (should fail) and delete it (should succeed)

**Expected Result**: Each role respects its specific feature permissions

### Scenario 4: Invitation with Permission Preview

**Objective**: Verify users see permission preview during invitation

**Steps**:
1. Go to Project Settings → Members
2. Click "Invite Member"
3. In the invitation form, select different roles from dropdown
4. Observe the "Permissions Preview" section updates to show what features that role can access
5. Complete the invitation
6. Verify invited user's access matches the preview

**Expected Result**: Permission preview accurately shows available features before invitation is sent

### Scenario 5: Permission Change Takes Effect Immediately

**Objective**: Verify permission changes apply instantly without requiring logout/login

**Steps**:
1. Have User A open the test case creation page
2. In another browser/session, as admin, disable TEST_CASE_CREATE for TESTER role
3. Try to create a test case as User A (TESTER)
4. Verify permission denied error appears

**Expected Result**: Permission changes take effect without requiring page refresh or login

### Scenario 6: Feature Disabled at Feature Level

**Objective**: Verify that disabling a feature at flag level blocks all roles

**Steps**:
1. In project settings, disable the TEST_CYCLE_EXECUTE feature entirely
2. Try to execute a test cycle as OWNER role
3. Verify execution is blocked (even OWNER cannot execute)

**Expected Result**: Disabled features block everyone, even owners (unless owner role has override)

### Scenario 7: Workspace vs Project Permission Precedence

**Objective**: Verify project permissions correctly override workspace defaults

**Steps**:
1. Workspace: Disable JIRA_INTEGRATION for MEMBER role
2. Project: Enable JIRA_INTEGRATION for TESTER role (which maps from workspace)
3. Assign TESTER to the project
4. Verify they CAN access JIRA integration in this project

**Expected Result**: Project-level override takes precedence over workspace default

## Automated Testing

### Running Test Suite Programmatically

```bash
# Via admin dashboard
1. Navigate to /admin/permissions-test
2. Select a project ID
3. Click "Run All Tests" to test all features × all roles
4. Click "Export Results" to download CSV

# Expected output: CSV file with columns:
# Feature,Role,Result,Message,Timestamp
```

### Test Coverage

The automated test suite covers:
- **Features**: 20+ features (TEST_CASE_*, TEST_CYCLE_*, TEST_PLAN_*, PROJECT_*, etc.)
- **Roles**: OWNER, LEAD, TESTER, VIEWER (project level)
- **Combinations**: 80+ feature-role pairs
- **Result Tracking**: Each test records pass/fail with timestamp

## Regression Testing Checklist

When changes are made to permission system, verify:

### Backend Integration
- [ ] Test case creation respects TEST_CASE_CREATE permission
- [ ] Test case update respects TEST_CASE_UPDATE permission
- [ ] Test case deletion respects TEST_CASE_DELETE permission
- [ ] Test cycle operations respect TEST_CYCLE_* permissions
- [ ] Test plan operations respect TEST_PLAN_* permissions
- [ ] Comments respect PROJECT_COMMENTS_CREATE permission
- [ ] Project settings respect PROJECT_SETTINGS_MANAGE permission
- [ ] Project members management respects PROJECT_MEMBERS_MANAGE permission

### UI Behavior
- [ ] Disabled features show "Not Available" or permission error
- [ ] Permission matrix UI updates when permissions are changed
- [ ] Workspace defaults page loads correctly
- [ ] Project permissions page shows both project and workspace settings
- [ ] "Revert to Workspace Defaults" button works correctly
- [ ] Invitation flow shows permission preview

### Permission Inheritance
- [ ] New projects inherit workspace defaults
- [ ] Project overrides don't affect workspace defaults
- [ ] Reverting project to workspace defaults removes all overrides
- [ ] Workspace permission changes affect projects using defaults
- [ ] Audit logs record permission denials

## Audit Log Review

### Accessing Audit Logs

Permission denials are logged for compliance and troubleshooting:

```sql
-- Query audit logs for a specific user
SELECT * FROM "PermissionAuditLog"
WHERE "userId" = 'user-id'
  AND "action" = 'DENIED'
ORDER BY "timestamp" DESC;

-- Query by project
SELECT * FROM "PermissionAuditLog"
WHERE "projectId" = 'project-id'
  AND "action" = 'DENIED'
ORDER BY "timestamp" DESC;
```

### Interpreting Audit Logs

Each denied access attempt records:
- **userId**: Which user attempted the action
- **projectId**: Which project the access was for
- **featureFlagId**: Which feature was denied
- **action**: Always "DENIED" for these logs
- **reason**: Why access was denied (e.g., "Feature disabled for this role")
- **timestamp**: When the denial occurred

## Test Data Setup

### Creating Test Users with Specific Roles

```sql
-- Create TESTER user for testing
INSERT INTO "User" (id, email, name, role)
VALUES ('test-tester', 'tester@test.com', 'Test Tester', 'TESTER');

-- Assign to project with TESTER role
INSERT INTO "ProjectMember" (id, projectId, userId, role)
VALUES ('pm-1', 'project-id', 'test-tester', 'TESTER');
```

### Creating Test Project

1. Create a new project via UI
2. Configure permissions as needed for testing
3. Assign test users to the project
4. Use for testing before cleaning up

## Common Issues and Troubleshooting

### Issue: Permission denied but should be allowed

**Possible Causes**:
- User doesn't have correct role in the project
- Feature is disabled at workspace level (check inheritance)
- Feature flag not initialized for this role
- Workspace default changed and project doesn't inherit it

**Fix**:
1. Verify user role: `SELECT * FROM ProjectMember WHERE userId = '...'`
2. Check feature flag: `SELECT * FROM FeatureFlag WHERE featureName = '...'`
3. Check role permission: `SELECT * FROM RolePermission WHERE featureFlagId = '...'`
4. Review audit logs for specific denial reason

### Issue: Invitation shows wrong permission preview

**Possible Causes**:
- Project hasn't been initialized with workspace defaults
- Project-specific override not reflecting correctly
- Workspace defaults not created yet

**Fix**:
1. Initialize project features by creating first permission entry
2. Verify workspace has permission flags created
3. Check both PROJECT_ROLE and TENANT_ROLE permissions

### Issue: Permission changes not taking effect

**Possible Causes**:
- API cache not cleared
- Client-side cache holding old permissions
- Database transaction not committed

**Fix**:
1. Clear browser cache (Ctrl+Shift+Del)
2. Hard refresh page (Ctrl+Shift+R)
3. Check database for recent updates
4. Review API response for correct data

## Documentation

### API Endpoints

- `GET /api/tenants/[tenantId]/settings/permissions` - Get workspace permissions
- `PUT /api/tenants/[tenantId]/settings/permissions` - Update workspace permissions
- `GET /api/projects/[projectId]/settings/permissions` - Get project permissions
- `PUT /api/projects/[projectId]/settings/permissions` - Update project permissions
- `GET /api/projects/[projectId]/permissions/preview?role=TESTER` - Get permission preview

### Feature Flags

All 20+ features can be individually controlled. See [Feature List](./FEATURES.md) for descriptions.

## Support

For issues or questions:
1. Check this guide's troubleshooting section
2. Review audit logs for specific permission denials
3. Use admin testing dashboard to verify configurations
4. Contact platform team with audit logs and reproduction steps
