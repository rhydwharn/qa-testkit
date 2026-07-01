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
    // Get user's project role
    const projectMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (!projectMember) {
      await logPermissionCheck(userId, projectId, null, featureName, "DENIED", "Not a project member");
      return false;
    }

    // Get feature permission for this role
    const featureFlag = await prisma.featureFlag.findFirst({
      where: {
        projectId,
        featureName,
      },
      include: {
        rolePermissions: {
          where: {
            roleType: "PROJECT_ROLE",
            roleName: projectMember.role,
          },
        },
      },
    });

    // If no project-specific flag, check workspace default
    if (!featureFlag) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { tenantId: true },
      });

      if (!project) {
        await logPermissionCheck(userId, projectId, null, featureName, "DENIED", "Project not found");
        return false;
      }

      const workspaceFlag = await prisma.featureFlag.findFirst({
        where: {
          tenantId: project.tenantId,
          featureName,
        },
        include: {
          rolePermissions: {
            where: {
              roleType: "TENANT_ROLE",
              // Map project role to tenant role
              roleName: projectMember.role === "OWNER" ? "OWNER" : "ADMIN",
            },
          },
        },
      });

      // If no workspace flag exists either, allow by default (backward compatibility)
      // Only restrict if permissions have been explicitly configured
      if (!workspaceFlag) {
        await logPermissionCheck(
          userId,
          projectId,
          project.tenantId,
          featureName,
          "ALLOWED",
          "No permissions configured - allowing by default (backward compatible)"
        );
        return true;
      }

      const isAllowed = (workspaceFlag?.isEnabled ?? true) && (workspaceFlag?.rolePermissions[0]?.isEnabled ?? true);
      await logPermissionCheck(
        userId,
        projectId,
        project.tenantId,
        featureName,
        isAllowed ? "ALLOWED" : "DENIED",
        isAllowed ? "Workspace default allows access" : "Workspace or role does not allow access"
      );
      return isAllowed;
    }

    // Check if feature is enabled for this role
    const isAllowed = featureFlag.isEnabled && (featureFlag.rolePermissions[0]?.isEnabled ?? true);
    await logPermissionCheck(
      userId,
      projectId,
      null,
      featureName,
      isAllowed ? "ALLOWED" : "DENIED",
      isAllowed ? "Project role allows access" : "Feature disabled for this role"
    );
    return isAllowed;
  } catch (error) {
    console.error("[canUserDoAction] Error checking permission:", error);
    await logPermissionCheck(userId, projectId, null, featureName, "DENIED", "Permission check failed");
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
          featureFlagId: "unknown", // Will need feature flag ID, but this is a fallback
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
