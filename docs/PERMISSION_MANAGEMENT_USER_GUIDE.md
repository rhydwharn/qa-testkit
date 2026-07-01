# Permission Management System - User Guide

## Overview

The permission management system gives project owners fine-grained control over which features team members can access. Instead of giving all members full access or no access, you can enable or disable specific features for each role.

## Key Concepts

### Roles

Roles determine what actions a user can perform:

**Project-Level Roles**:
- **OWNER**: Full access to all features (can also manage permissions)
- **LEAD**: Can manage most features but not project settings
- **TESTER**: Can execute tests and view most features
- **VIEWER**: Can view test cases and results but cannot create or modify

**Workspace-Level Roles**:
- **OWNER**: Manages workspace, sets defaults for all projects
- **ADMIN**: Can manage workspace settings and member permissions
- **MEMBER**: Regular workspace member

### Permission Levels

Permissions are controlled at two levels:

1. **Workspace Level**: Default permissions for all projects in your workspace
2. **Project Level**: Override workspace defaults for a specific project

### Features

The system controls access to 20+ features:
- Test case operations (create, read, update, delete, clone, import/export, archive)
- Test cycle operations (create, read, update, delete, execute, clone, archive)
- Test plan operations (create, read, update, delete, archive)
- Project operations (manage settings, manage members, submit automation results, view reports, create comments, manage filters, JIRA integration)

## For Project Owners

### Viewing Current Permissions

1. Go to your project
2. Navigate to **Settings** → **Permissions**
3. You'll see two sections:
   - **Project Permissions**: Custom settings for this project
   - **Workspace Defaults**: Inherited permissions from workspace

### Customizing Project Permissions

**To enable custom permissions for your project**:

1. Go to **Settings** → **Permissions**
2. Click **"Customize Permissions for This Project"**
3. You'll now see the permission matrix with checkboxes
4. Each row is a feature, each column is a role
5. Check the boxes to enable features for roles
6. Click **"Save Permissions"**

**To revert to workspace defaults**:

1. Go to **Settings** → **Permissions**
2. Click **"Revert to Workspace Defaults"**
3. Confirm the action
4. All custom settings will be removed

### Permission Matrix Usage

The permission matrix shows all features and roles:

```
┌─────────────────────────┬─────────┬────────┬────────┬────────┐
│ Feature                 │ OWNER   │ LEAD   │ TESTER │ VIEWER │
├─────────────────────────┼─────────┼────────┼────────┼────────┤
│ TEST_CASE_CREATE        │    ✓    │   ✓    │   ✓    │   ✗    │
│ TEST_CASE_UPDATE        │    ✓    │   ✓    │   ✗    │   ✗    │
│ TEST_CASE_DELETE        │    ✓    │   ✗    │   ✗    │   ✗    │
│ TEST_CYCLE_EXECUTE      │    ✓    │   ✓    │   ✓    │   ✗    │
└─────────────────────────┴─────────┴────────┴────────┴────────┘
```

- **Checked (✓)**: Role can access this feature
- **Unchecked (✗)**: Role cannot access this feature

### Common Permission Scenarios

**Scenario 1: QA Team Setup**
- LEAD: Can create test cases, cycles, and manage execution
- TESTER: Can execute tests and create comments
- VIEWER: Can read test cases and view results

Configuration:
- TEST_CASE_CREATE: ✓ LEAD, ✗ TESTER
- TEST_CASE_UPDATE: ✓ LEAD, ✗ TESTER
- TEST_CYCLE_EXECUTE: ✓ LEAD, ✓ TESTER
- PROJECT_COMMENTS_CREATE: ✓ LEAD, ✓ TESTER

**Scenario 2: Restricted Automation**
- OWNER: Full access
- LEAD: Cannot submit automation results
- TESTER: Can view but not submit

Configuration:
- PROJECT_AUTOMATION_SUBMIT: ✓ OWNER, ✗ LEAD, ✗ TESTER

**Scenario 3: Read-Only Access**
- VIEWER: Can only view, not modify anything

Configuration:
- All CREATE, UPDATE, DELETE, EXECUTE: ✗ VIEWER
- All READ operations: ✓ VIEWER

### Inviting Members with Permissions

When inviting a member to your project:

1. Go to **Settings** → **Members**
2. Click **"Invite Member"**
3. Enter their email address
4. Select their role from the dropdown
5. Review the **"Permissions Preview"** section to see what they can access
6. Send the invitation

The permissions preview shows exactly which features they'll have access to based on their selected role.

## For Workspace Owners

### Setting Workspace Defaults

Workspace-level permissions serve as defaults for all new projects:

1. Go to **Settings** → **Workspace Permissions**
2. View the permission matrix for workspace roles
3. Only workspace OWNER and ADMIN can modify these
4. Changes take effect immediately for new projects

**Note**: Existing projects with custom settings won't be affected by workspace changes. New projects will inherit these defaults.

### Permission Inheritance

```
┌─────────────────────────────────┐
│  Workspace Default Permissions  │
│   (Set at workspace level)      │
└────────────────┬────────────────┘
                 │
         ┌───────▼────────┐
         │  New Projects  │ ← Inherit workspace defaults
         └────────────────┘
                 │
         ┌───────▼────────────────────┐
         │  Project Custom Overrides  │ ← Override workspace if set
         └────────────────────────────┘
```

**Example**:
- Workspace: TEST_CASE_DELETE disabled for TESTER
- Project A: Uses workspace defaults (TEST_CASE_DELETE disabled for TESTER)
- Project B: Customized (TEST_CASE_DELETE enabled for TESTER)
- Result: TESTER can delete test cases only in Project B

## For System Administrators

### Viewing Audit Logs

Permission denials are logged for compliance:

```
Each permission denial records:
- Who attempted the action (User ID)
- Which feature they tried to access
- Which project it occurred in
- Why access was denied
- When it occurred (timestamp)
```

Access logs in your system database:
```sql
SELECT * FROM "PermissionAuditLog" 
WHERE "action" = 'DENIED'
ORDER BY "timestamp" DESC;
```

### Testing Permissions

Use the Permission Testing Dashboard at `/admin/permissions-test`:

1. **Single Feature Test**: Test one feature for one role
2. **Comprehensive Test**: Run all features × all roles
3. **Export Results**: Download results as CSV

This helps verify your permission configuration is working as expected.

### Monitoring Permission Changes

When you update permissions:
1. Changes take effect immediately
2. All active users are subject to new permissions
3. API calls that violate new permissions will be denied
4. Permission denials are logged in audit trail

### Default Permission Configuration

**Default Behavior** (All features enabled for all roles):
- Ensures backward compatibility when system is deployed
- All existing users retain full access until permissions are customized
- Project owners must explicitly enable permission restrictions

## Troubleshooting

### I can't see a feature I should have access to

**Possible reasons**:
1. Feature is disabled at project level
2. Feature is disabled at workspace level (and project inherits it)
3. Your role doesn't have permission for that feature
4. You're not assigned to the project with the correct role

**Solution**:
1. Ask your project owner to check project permissions
2. If using workspace defaults, ask workspace owner to check workspace permissions
3. Verify your role assignment in project settings

### Permission changes aren't taking effect

**Possible reasons**:
1. You need to refresh the page for UI to update
2. API requests include cached permissions
3. You're viewing a cached version of the app

**Solution**:
1. Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)
2. Clear browser cache for this site
3. Log out and log back in

### I see "Feature not available for your role"

This means:
- Your role doesn't have permission for this feature
- The feature is disabled for your role at either workspace or project level

**Next steps**:
1. Contact your project owner to request permission
2. Provide the name of the feature you need access to
3. They can enable it in Settings → Permissions

## Best Practices

### For Project Owners

1. **Start with workspace defaults**: Don't customize every project; use workspace defaults as much as possible
2. **Clear naming**: Use meaningful role assignments that match team structure
3. **Regular review**: Periodically review permissions to ensure they match your team's needs
4. **Audit access**: Check audit logs for unusual permission denials

### For Team Members

1. **Report access issues early**: If you need a feature, ask immediately
2. **Use appropriate roles**: Request the role that matches your responsibility
3. **Don't bypass restrictions**: Restrictions exist for a reason

### General

1. **Test before enforcing**: Use testing dashboard to verify configuration before restricting access
2. **Gradual rollout**: Don't restrict everything at once; start with critical features
3. **Communicate changes**: Notify team when permissions change
4. **Document decisions**: Keep notes on why specific permissions are configured

## Frequently Asked Questions

**Q: Can OWNER role always do everything?**
A: OWNER roles can access all features regardless of permission settings. However, if you want to restrict even OWNER, you can disable the entire feature flag.

**Q: Do permissions take effect immediately?**
A: Yes. When you change permissions, they apply to all project members immediately without requiring logout/login.

**Q: Can I grant PROJECT_COMMENTS_CREATE to only certain people?**
A: No, permissions are role-based. All users with a role get the same features. To grant access to specific users, they need a role that has that feature enabled.

**Q: What happens if I revert to workspace defaults?**
A: All project-specific permission customizations are deleted. The project will use workspace defaults going forward. You can re-customize later.

**Q: Can I see what permissions someone else has?**
A: Yes. Go to Settings → Members, find the user, and view their role. Use the permission matrix to see what their role can access.

**Q: How do I give someone read-only access?**
A: Assign them the VIEWER role and ensure VIEWER only has read permissions (TEST_*_READ, PROJECT_REPORTS_VIEW) enabled.

## Support

For additional help:
1. Check the [Permission Testing Guide](./PERMISSION_TESTING_GUIDE.md) for testing procedures
2. Review the [Admin Guide](./PERMISSION_ADMIN_GUIDE.md) for administration
3. Contact your workspace administrator
4. Check audit logs for specific permission denial reasons
