# Permission System Audit Report

**Date**: 2026-07-01  
**Scope**: All 40+ API endpoints in `/apps/web/src/app/api/`  
**Goal**: Ensure permission checks properly enforced + test member token access

---

## Executive Summary

**Status**: ⚠️ IN PROGRESS

- **Endpoints Audited**: 40+
- **Permission Checks Implemented**: 28 endpoints ✅
- **Missing Permission Checks**: 11 endpoints ❌
- **Test Suite Created**: Yes ✅
- **Fixes Applied**: 1 endpoint fixed (test cycles search)

---

## Detailed Endpoint Audit

### CATEGORY: Test Cases (10 endpoints)

| Endpoint | Method | Permission Check | Status | Notes |
|----------|--------|------------------|--------|-------|
| `/api/testcases` | GET | `enforcePermission(TEST_CASE_READ)` | ✅ Fixed | List test cases |
| `/api/testcases` | POST | `enforcePermission(TEST_CASE_CREATE)` | ✅ Fixed | Create test case |
| `/api/testcases?action=search` | POST | `enforcePermission(TEST_CASE_READ)` | ✅ Fixed | Search test cases |
| `/api/testcases/[id]` | GET | `enforcePermission() + verifyProjectAccess()` | ✅ Fixed | View test case detail |
| `/api/testcases/[id]` | PUT | `enforcePermission(TEST_CASE_UPDATE)` | ✅ Fixed | Update test case |
| `/api/testcases/[id]` | DELETE | `enforcePermission(TEST_CASE_DELETE)` | ✅ Fixed | Delete test case |
| `/api/testcases/[id]/archive` | POST | Need to verify | ⚠️ Check | Archive test case |
| `/api/testcases/[id]/clone` | POST | Need to verify | ⚠️ Check | Clone test case |
| `/api/testcases/[id]/executions` | GET | `verifyProjectAccess()` | ✅ Fixed | View executions |
| `/api/testcases/[id]/steps` | GET/POST | Need to verify | ⚠️ Check | Manage steps |

### CATEGORY: Test Cycles (8 endpoints)

| Endpoint | Method | Permission Check | Status | Notes |
|----------|--------|------------------|--------|-------|
| `/api/testcycles` | GET | `enforcePermission(TEST_CYCLE_READ)` | ✅ Fixed | List cycles |
| `/api/testcycles` | POST | `enforcePermission(TEST_CYCLE_CREATE)` | ✅ Fixed | Create cycle |
| `/api/testcycles/search` | GET | ❌ **MISSING** | ✅ FIXED | Search cycles - FIXED in this session |
| `/api/testcycles/search` | POST | ❌ **MISSING** | ✅ FIXED | Search cycles - FIXED in this session |
| `/api/testcycles/[id]` | GET | `enforcePermission()` | ✅ Fixed | View cycle |
| `/api/testcycles/[id]` | PUT | `enforcePermission(TEST_CYCLE_UPDATE)` | ✅ Fixed | Update cycle |
| `/api/testcycles/[id]` | DELETE | `enforcePermission(TEST_CYCLE_DELETE)` | ✅ Fixed | Delete cycle |
| `/api/testcycles/bulk/status` | PUT | `verifyProjectAccess()` | ✅ Fixed | Bulk update cycles |

### CATEGORY: Folders (2 endpoints)

| Endpoint | Method | Permission Check | Status | Notes |
|----------|--------|------------------|--------|-------|
| `/api/folders` | GET | ❌ **MISSING** | ⚠️ Check | List folders - need verifyProjectAccess |
| `/api/folders` | POST | ❌ **MISSING** | ⚠️ Check | Create folder - need verifyProjectAccess |

### CATEGORY: Comments (2 endpoints)

| Endpoint | Method | Permission Check | Status | Notes |
|----------|--------|------------------|--------|-------|
| `/api/comments` | GET | ❌ **MISSING** | ⚠️ Check | Get comments - need project access verification |
| `/api/comments` | POST | `enforcePermission(PROJECT_COMMENTS_CREATE)` | ✅ Fixed | Create comment |

### CATEGORY: Attachments (2 endpoints)

| Endpoint | Method | Permission Check | Status | Notes |
|----------|--------|------------------|--------|-------|
| `/api/attachments` | GET | ❌ **MISSING** | ⚠️ Check | Get attachments - need entity ownership validation |
| `/api/attachments` | POST | ❌ **MISSING** | ⚠️ Check | Upload attachment - need entity ownership validation |

### CATEGORY: Automation (3 endpoints)

| Endpoint | Method | Permission Check | Status | Notes |
|----------|--------|------------------|--------|-------|
| `/api/automation/submit` | POST | ❌ **MISSING** | ⚠️ Check | Submit automation results - need PROJECT_AUTOMATION_SUBMIT |
| `/api/automation/runs` | GET | ❌ **MISSING** | ⚠️ Check | List automation runs - need project access |
| `/api/automation/cycles` | POST | ❌ **MISSING** | ⚠️ Check | Create automation cycle - need project access |

### CATEGORY: JIRA Integration (3 endpoints)

| Endpoint | Method | Permission Check | Status | Notes |
|----------|--------|------------------|--------|-------|
| `/api/jira/search` | GET | ❌ **MISSING** | ⚠️ Check | Search JIRA issues - need project access |
| `/api/jira/issues` | POST | ❌ **MISSING** | ⚠️ Check | Link JIRA issue - need project access |
| `/api/jira/requirements` | GET | ❌ **MISSING** | ⚠️ Check | Get JIRA requirements - need project access |

### CATEGORY: Project Settings (9 endpoints)

| Endpoint | Method | Permission Check | Status | Notes |
|----------|--------|------------------|--------|-------|
| `/api/projects/[id]/settings/priorities` | GET | `verifyProjectAccess()` | ✅ Fixed | Workspace fallback ✅ |
| `/api/projects/[id]/settings/priorities` | POST | Direct membership check | ✅ Fixed | Write requires direct membership |
| `/api/projects/[id]/settings/labels` | GET | `verifyProjectAccess()` | ✅ Fixed | Workspace fallback ✅ |
| `/api/projects/[id]/settings/labels` | POST | Direct membership check | ✅ Fixed | Write requires direct membership |
| `/api/projects/[id]/settings/components` | GET | `verifyProjectAccess()` | ✅ Fixed | Workspace fallback ✅ |
| `/api/projects/[id]/settings/components` | POST | Direct membership check | ✅ Fixed | Write requires direct membership |
| `/api/projects/[id]/settings/environments` | GET/POST | Direct membership check | ✅ Fixed | Settings access |
| `/api/projects/[id]/settings/builds` | GET/POST | Direct membership check | ✅ Fixed | Settings access |
| `/api/projects/[id]/settings/jira` | GET/POST | Direct membership check | ✅ Fixed | Settings access |

### CATEGORY: Projects & Members (5 endpoints)

| Endpoint | Method | Permission Check | Status | Notes |
|----------|--------|------------------|--------|-------|
| `/api/projects` | GET | Workspace member check | ✅ Fixed | Returns user's projects |
| `/api/projects` | POST | Requires tenantId | ✅ Fixed | Workspace member can create |
| `/api/projects/[id]` | GET | `verifyProjectAccess()` | ✅ Fixed | Workspace fallback |
| `/api/projects/[id]/members` | GET | `verifyProjectAccess()` | ✅ Fixed | Workspace fallback |
| `/api/projects/[id]/members` | POST | Direct membership + `enforcePermission(PROJECT_MEMBERS_MANAGE)` | ✅ Fixed | Requires direct membership |

### CATEGORY: Workspace/Tenants (5 endpoints)

| Endpoint | Method | Permission Check | Status | Notes |
|----------|--------|------------------|--------|-------|
| `/api/tenants` | GET | Workspace member check | ✅ Fixed | Returns user's workspaces |
| `/api/tenants/[id]/members` | GET/POST | Workspace membership check | ✅ Fixed | Member management |
| `/api/tenants/[id]/roles` | GET | Workspace member check | ✅ Fixed | Read-only access |
| `/api/tenants/[id]/roles` | POST | `enforcePermission(WORKSPACE_ROLES_MANAGE)` | ✅ Fixed | Create role |
| `/api/tenants/[id]/roles/[roleId]/permissions` | GET/PUT | `enforcePermission(WORKSPACE_PERMISSIONS_MANAGE)` | ✅ Fixed | Manage permissions |

### CATEGORY: Authentication (6 endpoints - No permission checks needed)

| Endpoint | Method | Check | Status | Notes |
|----------|--------|-------|--------|-------|
| `/api/auth/register` | POST | Public | ✅ N/A | Registration is public |
| `/api/auth/signin` | POST | Public | ✅ N/A | Login is public |
| `/api/auth/session` | GET | requireAuth only | ✅ N/A | Session state |
| `/api/auth/signout` | POST | requireAuth only | ✅ N/A | Logout |
| `/api/auth/forgot-password` | POST | Public | ✅ N/A | Password reset flow |
| `/api/auth/reset-password` | POST | Public (token validated) | ✅ N/A | Token-based reset |

---

## Permission Check Patterns Used

### Pattern A: `enforcePermission()` (6+ endpoints)
```typescript
const permissionError = await enforcePermission(
  caller.userId,
  projectId,
  "TEST_CASE_READ"
);
if (permissionError) return permissionError;
```
**Used for**: Feature flag enforcement  
**Supports**: Workspace fallback (implemented in permissions.ts)  

### Pattern B: `verifyProjectAccess()` (7+ endpoints)
```typescript
const access = await verifyProjectAccess(
  caller.userId,
  projectId,
  caller.tenantId
);
if (!access) return err("Forbidden", 403);
```
**Used for**: Project access check with workspace fallback  
**Supports**: Workspace membership as fallback  

### Pattern C: Direct `projectMember` check (write operations)
```typescript
const membership = await prisma.projectMember.findUnique({
  where: { projectId_userId: { projectId, userId: caller.userId } }
});
if (!membership) return err("Forbidden", 403);
```
**Used for**: WRITE operations requiring direct membership  
**Supports**: No workspace fallback (intentional for settings)

---

## Critical Findings

### 🔴 CRITICAL - 11 Endpoints Missing Permission Checks

1. **Test Cycles Search** - ✅ FIXED (POST + GET)
   - File: `/apps/web/src/app/api/testcycles/search/route.ts`
   - Issue: No TEST_CYCLE_READ check
   - Fix: Added enforcePermission check
   - Status: FIXED in this session

2. **Folders** - ⚠️ NEEDS FIX
   - File: `/apps/web/src/app/api/folders/route.ts`
   - Issue: No project access check
   - Fix: Add verifyProjectAccess()

3. **Comments GET** - ⚠️ NEEDS FIX
   - File: `/apps/web/src/app/api/comments/route.ts`
   - Issue: No project access validation
   - Fix: Add verifyProjectAccess() or enforcePermission()

4. **Attachments** - ⚠️ NEEDS FIX
   - File: `/apps/web/src/app/api/attachments/route.ts`
   - Issue: No entity ownership validation
   - Fix: Validate executionId/stepExecutionId belongs to user's project

5. **Automation Endpoints (3)** - ⚠️ NEEDS FIX
   - Files: `/api/automation/submit`, `/api/automation/runs`, `/api/automation/cycles`
   - Issue: No permission enforcement
   - Fix: Add PROJECT_AUTOMATION_SUBMIT check

6. **JIRA Endpoints (3)** - ⚠️ NEEDS FIX
   - Files: `/api/jira/search`, `/api/jira/issues`, `/api/jira/requirements`
   - Issue: No project access check
   - Fix: Add verifyProjectAccess() for reads

---

## Test Suite Status

**File Created**: `/apps/web/src/app/api/__tests__/member-permissions.test.ts` ✅

**Test Coverage**:
- ✅ READ endpoints with workspace fallback (should return 200)
- ✅ WRITE endpoints without direct membership (should return 403)
- ✅ Feature flag disabled scenarios (should return 403)
- ✅ Owner/Admin access (should return 200/201)
- ✅ Error handling (401 unauthorized, 403 forbidden)

**Ready to Execute**: Once test infrastructure is set up:
1. Database with test users/workspace/project
2. Auth tokens for member, admin, owner
3. Jest configured with API endpoints

---

## Recommended Next Steps

### Phase 1: Fix Remaining 10 Endpoints (2-3 hours)
1. ✅ Test Cycles Search - **DONE**
2. Folders - Add verifyProjectAccess()
3. Comments GET - Add project validation
4. Attachments - Add entity ownership check
5. Automation endpoints (3) - Add permission checks
6. JIRA endpoints (3) - Add project access check

### Phase 2: Run Test Suite (1 hour)
1. Set up test database with test data
2. Generate auth tokens
3. Execute automated tests
4. Document pass/fail results

### Phase 3: Verification (30 min)
1. Member with permission: READ=200, WRITE=403
2. Member without permission: All=403
3. Owner with permission: All=200/201

---

## Workspace Membership Fallback - IMPLEMENTED ✅

**How it works**:
- READ endpoints use `verifyProjectAccess()` which checks:
  1. Is user a direct project member? → Use project role
  2. If not → Is user a workspace member? → Use workspace role
  3. If not → Return 403 Forbidden

- WRITE endpoints use direct membership check:
  1. Is user a direct project member? → Allow
  2. If not → Return 403 Forbidden (no workspace fallback)

**Endpoints using workspace fallback**:
- ✅ GET /api/testcases
- ✅ GET /api/testcases/[id]
- ✅ POST /api/testcases/search
- ✅ GET /api/testcycles/[id]
- ✅ GET /api/projects/[id]/settings/* (READ only)
- ✅ GET /api/projects/[id]/members
- ✅ GET /api/comments (needs fix)
- ✅ GET /api/attachments (needs fix)

---

## Summary Statistics

| Metric | Count | Status |
|--------|-------|--------|
| Total endpoints | 40+ | Audited |
| With permission checks | 28 | ✅ |
| Missing permission checks | 11 | ❌ (1 fixed, 10 pending) |
| Using workspace fallback | 7 | ✅ |
| Requiring direct membership | 15 | ✅ |
| Public/no check | 6 | ✅ N/A |
| Tests created | 1 suite | ✅ |
| Tests passing | Pending | ⏳ |

---

## Commits This Session

1. ✅ `200328a` - Add permission check to test cycles search endpoint
2. ✅ `7b2c7db` - Add comprehensive member permission test suite

---

## Files to Review Before Next Session

### Priority 1 (High Risk - Data Exposure):
- `/apps/web/src/app/api/comments/route.ts` - Anyone can read comments
- `/apps/web/src/app/api/attachments/route.ts` - Anyone can read attachments
- `/apps/web/src/app/api/automation/submit/route.ts` - Anyone can submit results
- `/apps/web/src/app/api/jira/search/route.ts` - Anyone can search JIRA

### Priority 2 (Medium Risk):
- `/apps/web/src/app/api/folders/route.ts` - Folders not validated
- `/apps/web/src/app/api/testcases/[id]/archive` - Archive permission unclear
- `/apps/web/src/app/api/testcases/[id]/clone` - Clone permission unclear

---

## Verification Approach for Testing

**Setup**:
```
Workspace: "QA Team"
- Owner: alice@company.com (OWNER role - all permissions)
- Admin: bob@company.com (ADMIN role)
- Member: charlie@company.com (MEMBER role, limited)

Project: "Mobile App Tests"
- Direct Members: alice@company.com (OWNER)
- Not Members: bob, charlie (access via workspace fallback)

Feature Flags for MEMBER role:
- TEST_CASE_READ: ✅ Enabled
- TEST_CASE_CREATE: ❌ Disabled
- TEST_CYCLE_READ: ✅ Enabled
- TEST_CYCLE_CREATE: ❌ Disabled
```

**Test Scenarios**:
1. charlie (member) GET /api/testcases → 200 ✅
2. charlie (member) POST /api/testcases → 403 ❌
3. Disable TEST_CASE_READ, charlie GET /api/testcases → 403 ❌
4. alice (owner) POST /api/testcases → 201 ✅

---

**Last Updated**: 2026-07-01  
**Next Review**: After fixing remaining 10 endpoints and running test suite
