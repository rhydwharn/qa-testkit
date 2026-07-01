import { prisma } from "@/lib/prisma";

export type FeatureName =
  | "TEST_CASE_CREATE"
  | "TEST_CASE_READ"
  | "TEST_CASE_UPDATE"
  | "TEST_CASE_DELETE"
  | "TEST_CASE_CLONE"
  | "TEST_CASE_IMPORT"
  | "TEST_CASE_EXPORT"
  | "TEST_CASE_ARCHIVE"
  | "TEST_CYCLE_CREATE"
  | "TEST_CYCLE_READ"
  | "TEST_CYCLE_UPDATE"
  | "TEST_CYCLE_DELETE"
  | "TEST_CYCLE_EXECUTE"
  | "TEST_CYCLE_CLONE"
  | "TEST_CYCLE_ARCHIVE"
  | "TEST_PLAN_CREATE"
  | "TEST_PLAN_READ"
  | "TEST_PLAN_UPDATE"
  | "TEST_PLAN_DELETE"
  | "TEST_PLAN_ARCHIVE"
  | "PROJECT_SETTINGS_MANAGE"
  | "PROJECT_MEMBERS_MANAGE"
  | "PROJECT_AUTOMATION_SUBMIT"
  | "PROJECT_REPORTS_VIEW"
  | "PROJECT_COMMENTS_CREATE"
  | "PROJECT_FILTERS_MANAGE"
  | "WORKSPACE_ROLES_MANAGE"
  | "WORKSPACE_PERMISSIONS_MANAGE"
  | "JIRA_INTEGRATION";

/**
 * Check if a user can perform an action based on their project role
 */
export async function canUserDoAction(
  userId: string,
  projectId: string,
  featureName: FeatureName
): Promise<boolean> {
  try {
    // Get user's project role and custom role
    const projectMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (!projectMember) {
      // Fetch feature flag for audit logging (even though access will be denied)
      const flagForLog = await prisma.featureFlag.findFirst({
        where: { projectId, featureName },
        select: { id: true },
      });
      await logPermissionCheck(userId, projectId, null, flagForLog?.id || "flag-not-found", featureName, "DENIED", "Not a project member");
      return false;
    }

    // Get feature permission for this role
    const featureFlag = await prisma.featureFlag.findFirst({
      where: {
        projectId,
        featureName,
      },
      include: {
        rolePermissions: true,
      },
    });

    // If project-specific flag exists, check permissions
    if (featureFlag) {
      // Check custom role permissions first (if assigned)
      if (projectMember.customRoleId) {
        const customRolePermission = featureFlag.rolePermissions.find(
          (rp) => rp.customRoleId === projectMember.customRoleId
        );
        if (customRolePermission) {
          const isAllowed = featureFlag.isEnabled && customRolePermission.isEnabled;
          await logPermissionCheck(
            userId,
            projectId,
            null,
            featureFlag.id,
            featureName,
            isAllowed ? "ALLOWED" : "DENIED",
            isAllowed ? "Custom role allows access" : "Feature disabled for custom role"
          );
          return isAllowed;
        }
      }

      // Fall back to fixed role permissions
      const fixedRolePermission = featureFlag.rolePermissions.find(
        (rp) => rp.roleType === "PROJECT_ROLE" && rp.roleName === projectMember.role
      );
      if (fixedRolePermission) {
        const isAllowed = featureFlag.isEnabled && fixedRolePermission.isEnabled;
        await logPermissionCheck(
          userId,
          projectId,
          null,
          featureFlag.id,
          featureName,
          isAllowed ? "ALLOWED" : "DENIED",
          isAllowed ? "Project role allows access" : "Feature disabled for this role"
        );
        return isAllowed;
      }

      // If no specific permission found, allow by default
      const isAllowed = featureFlag.isEnabled;
      await logPermissionCheck(
        userId,
        projectId,
        null,
        featureFlag.id,
        featureName,
        isAllowed ? "ALLOWED" : "DENIED",
        isAllowed ? "Feature enabled, no role restriction" : "Feature disabled"
      );
      return isAllowed;
    }

    // If no project-specific flag, check workspace default
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { tenantId: true },
    });

    if (!project) {
      await logPermissionCheck(userId, projectId, null, "flag-project-not-found", featureName, "DENIED", "Project not found");
      return false;
    }

    const workspaceFlag = await prisma.featureFlag.findFirst({
      where: {
        tenantId: project.tenantId,
        featureName,
      },
      include: {
        rolePermissions: true,
      },
    });

    // If no workspace flag exists either, allow by default (backward compatibility)
    if (!workspaceFlag) {
      await logPermissionCheck(
        userId,
        projectId,
        project.tenantId,
        "flag-workspace-default",
        featureName,
        "ALLOWED",
        "No permissions configured - allowing by default (backward compatible)"
      );
      return true;
    }

    // Check workspace permissions
    // Note: For workspace defaults, we need to check tenant member's custom or fixed role
    const tenantMember = await prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId: project.tenantId,
          userId,
        },
      },
    });

    if (!tenantMember) {
      await logPermissionCheck(
        userId,
        projectId,
        project.tenantId,
        workspaceFlag.id,
        featureName,
        "DENIED",
        "Not a workspace member"
      );
      return false;
    }

    // Check custom role permissions first
    if (tenantMember.customRoleId) {
      const customRolePermission = workspaceFlag.rolePermissions.find(
        (rp) => rp.customRoleId === tenantMember.customRoleId
      );
      if (customRolePermission) {
        const isAllowed = workspaceFlag.isEnabled && customRolePermission.isEnabled;
        await logPermissionCheck(
          userId,
          projectId,
          project.tenantId,
          workspaceFlag.id,
          featureName,
          isAllowed ? "ALLOWED" : "DENIED",
          isAllowed ? "Workspace custom role allows access" : "Feature disabled for custom role"
        );
        return isAllowed;
      }
    }

    // Fall back to fixed role permissions
    const rolePermission = workspaceFlag.rolePermissions.find(
      (rp) => rp.roleType === "TENANT_ROLE" && rp.roleName === tenantMember.role
    );

    const isAllowed = (workspaceFlag?.isEnabled ?? true) && (rolePermission?.isEnabled ?? true);
    await logPermissionCheck(
      userId,
      projectId,
      project.tenantId,
      workspaceFlag.id,
      featureName,
      isAllowed ? "ALLOWED" : "DENIED",
      isAllowed ? "Workspace default allows access" : "Workspace or role does not allow access"
    );
    return isAllowed;
  } catch (error) {
    console.error("[canUserDoAction] Error checking permission:", error);
    await logPermissionCheck(userId, projectId, null, "error-check-failed", featureName, "DENIED", "Permission check failed");
    return false;
  }
}

/**
 * Get all allowed features for a project role
 */
export async function getProjectFeatures(projectId: string, projectRole: string): Promise<FeatureName[]> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { tenantId: true },
    });

    if (!project) return [];

    // Get project-specific features
    const projectFeatures = await prisma.featureFlag.findMany({
      where: {
        projectId,
      },
      include: {
        rolePermissions: {
          where: {
            roleType: "PROJECT_ROLE",
            roleName: projectRole,
          },
        },
      },
    });

    const allowed = projectFeatures
      .filter((flag) => flag.isEnabled && (flag.rolePermissions[0]?.isEnabled ?? true))
      .map((flag) => flag.featureName as FeatureName);

    // Get workspace default features (for features not overridden at project level)
    const projectFeatureNames = projectFeatures.map((f) => f.featureName);

    const workspaceFeatures = await prisma.featureFlag.findMany({
      where: {
        tenantId: project.tenantId,
        featureName: {
          notIn: projectFeatureNames,
        },
      },
      include: {
        rolePermissions: {
          where: {
            roleType: "TENANT_ROLE",
          },
        },
      },
    });

    const workspaceAllowed = workspaceFeatures
      .filter((flag) => flag.isEnabled)
      .map((flag) => flag.featureName as FeatureName);

    return [...allowed, ...workspaceAllowed];
  } catch (error) {
    console.error("[getProjectFeatures] Error fetching features:", error);
    return [];
  }
}

/**
 * Log permission check for audit trail
 */
async function logPermissionCheck(
  userId: string,
  projectId: string | null,
  tenantId: string | null,
  featureFlagId: string,
  featureName: string,
  action: "ALLOWED" | "DENIED",
  reason: string
): Promise<void> {
  try {
    // Only log denials to reduce log volume
    if (action === "DENIED") {
      await prisma.permissionAuditLog.create({
        data: {
          userId,
          projectId,
          tenantId,
          featureFlagId,
          action,
          reason,
        },
      });
    }
  } catch (error) {
    console.error("[logPermissionCheck] Error logging permission check:", error);
    // Don't throw - permission checks should never fail due to logging
  }
}

/**
 * Initialize default feature flags for a new project
 * All features enabled for all roles by default
 */
export async function initializeProjectFeatures(projectId: string): Promise<void> {
  try {
    const features: FeatureName[] = [
      "TEST_CASE_CREATE",
      "TEST_CASE_READ",
      "TEST_CASE_UPDATE",
      "TEST_CASE_DELETE",
      "TEST_CASE_CLONE",
      "TEST_CASE_IMPORT",
      "TEST_CASE_EXPORT",
      "TEST_CASE_ARCHIVE",
      "TEST_CYCLE_CREATE",
      "TEST_CYCLE_READ",
      "TEST_CYCLE_UPDATE",
      "TEST_CYCLE_DELETE",
      "TEST_CYCLE_EXECUTE",
      "TEST_CYCLE_CLONE",
      "TEST_CYCLE_ARCHIVE",
      "TEST_PLAN_CREATE",
      "TEST_PLAN_READ",
      "TEST_PLAN_UPDATE",
      "TEST_PLAN_DELETE",
      "TEST_PLAN_ARCHIVE",
      "PROJECT_SETTINGS_MANAGE",
      "PROJECT_MEMBERS_MANAGE",
      "PROJECT_AUTOMATION_SUBMIT",
      "PROJECT_REPORTS_VIEW",
      "PROJECT_COMMENTS_CREATE",
      "PROJECT_FILTERS_MANAGE",
      "JIRA_INTEGRATION",
    ];

    const roles = ["OWNER", "LEAD", "TESTER", "VIEWER"];

    for (const feature of features) {
      const flag = await prisma.featureFlag.create({
        data: {
          projectId,
          featureName: feature,
          description: `${feature.replace(/_/g, " ")} feature`,
          isEnabled: true,
        },
      });

      // Create role permissions (all enabled by default)
      for (const role of roles) {
        await prisma.rolePermission.create({
          data: {
            featureFlagId: flag.id,
            roleType: "PROJECT_ROLE",
            roleName: role,
            isEnabled: true,
          },
        });
      }
    }
  } catch (error) {
    console.error("[initializeProjectFeatures] Error initializing features:", error);
    // Don't throw - this should not block project creation
  }
}

/**
 * Initialize default feature flags for a new workspace
 * All features enabled for all roles by default
 */
export async function initializeWorkspaceFeatures(tenantId: string): Promise<void> {
  try {
    const features: FeatureName[] = [
      "TEST_CASE_CREATE",
      "TEST_CASE_READ",
      "TEST_CASE_UPDATE",
      "TEST_CASE_DELETE",
      "TEST_CASE_CLONE",
      "TEST_CASE_IMPORT",
      "TEST_CASE_EXPORT",
      "TEST_CASE_ARCHIVE",
      "TEST_CYCLE_CREATE",
      "TEST_CYCLE_READ",
      "TEST_CYCLE_UPDATE",
      "TEST_CYCLE_DELETE",
      "TEST_CYCLE_EXECUTE",
      "TEST_CYCLE_CLONE",
      "TEST_CYCLE_ARCHIVE",
      "TEST_PLAN_CREATE",
      "TEST_PLAN_READ",
      "TEST_PLAN_UPDATE",
      "TEST_PLAN_DELETE",
      "TEST_PLAN_ARCHIVE",
      "PROJECT_SETTINGS_MANAGE",
      "PROJECT_MEMBERS_MANAGE",
      "PROJECT_AUTOMATION_SUBMIT",
      "PROJECT_REPORTS_VIEW",
      "PROJECT_COMMENTS_CREATE",
      "PROJECT_FILTERS_MANAGE",
      "WORKSPACE_ROLES_MANAGE",
      "WORKSPACE_PERMISSIONS_MANAGE",
      "JIRA_INTEGRATION",
    ];

    const roles = ["OWNER", "ADMIN", "MEMBER"];

    for (const feature of features) {
      const flag = await prisma.featureFlag.create({
        data: {
          tenantId,
          featureName: feature,
          description: `${feature.replace(/_/g, " ")} feature`,
          isEnabled: true,
        },
      });

      // Create role permissions (all enabled by default)
      for (const role of roles) {
        await prisma.rolePermission.create({
          data: {
            featureFlagId: flag.id,
            roleType: "TENANT_ROLE",
            roleName: role,
            isEnabled: true,
          },
        });
      }
    }
  } catch (error) {
    console.error("[initializeWorkspaceFeatures] Error initializing features:", error);
    // Don't throw - this should not block permission setup
  }
}

/**
 * Check if user can manage project settings
 */
export async function canManageProjectSettings(userId: string, projectId: string): Promise<boolean> {
  try {
    const projectMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (!projectMember) return false;

    // OWNER and LEAD can manage settings
    return ["OWNER", "LEAD"].includes(projectMember.role);
  } catch (error) {
    console.error("[canManageProjectSettings] Error:", error);
    return false;
  }
}
