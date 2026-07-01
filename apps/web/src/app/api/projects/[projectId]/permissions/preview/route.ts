import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/api-helpers";
import { err, ok } from "@/lib/api-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const caller = await requireTenantAccess(req, params.projectId);
  if (!caller) return err("Unauthorized", 401);

  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role");

    if (!role) {
      return err("Role parameter required", 400);
    }

    // Verify user is project member
    const projectMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: params.projectId,
          userId: (caller as any).caller.userId,
        },
      },
    });

    if (!projectMember) return err("Not a project member", 403);

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: { tenantId: true },
    });

    if (!project) return err("Project not found", 404);

    // Get project-specific features
    const projectFlags = await prisma.featureFlag.findMany({
      where: { projectId: params.projectId },
      include: {
        rolePermissions: {
          where: {
            roleType: "PROJECT_ROLE",
            roleName: role,
          },
        },
      },
    });

    // Get workspace defaults for features not overridden
    const overriddenNames = projectFlags.map((f) => f.featureName);
    const workspaceFlags = await prisma.featureFlag.findMany({
      where: {
        tenantId: project.tenantId,
        featureName: { notIn: overriddenNames },
      },
      include: {
        rolePermissions: {
          where: {
            roleType: "TENANT_ROLE",
            roleName: role === "OWNER" ? "OWNER" : "ADMIN",
          },
        },
      },
    });

    const formatFlags = (flags: any[]) =>
      flags
        .filter((flag) => flag.isEnabled && (flag.rolePermissions[0]?.isEnabled ?? true))
        .map((flag) => ({
          featureName: flag.featureName,
          description: flag.description,
        }));

    const allowedFeatures = [
      ...formatFlags(projectFlags),
      ...formatFlags(workspaceFlags),
    ];

    return ok({
      role,
      allowedFeatures,
      featureCount: allowedFeatures.length,
    });
  } catch (error) {
    console.error("Error fetching permission preview:", error);
    return err("Failed to fetch preview", 500);
  }
}
