import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/api-helpers";
import { err, ok } from "@/lib/api-helpers";
import { z } from "zod";

const updatePermissionsSchema = z.object({
  permissions: z.array(
    z.object({
      featureName: z.string(),
      roleName: z.string(),
      isEnabled: z.boolean(),
    })
  ),
  useWorkspaceDefaults: z.boolean().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const caller = await requireTenantAccess(req, params.projectId);
  if (!caller) return err("Unauthorized", 401);

  try {
    // Verify user is project member
    const projectMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: params.projectId,
          userId: (caller as any).userId,
        },
      },
    });

    if (!projectMember) return err("Not a project member", 403);

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: { tenantId: true },
    });

    if (!project) return err("Project not found", 404);

    // Get project-specific feature flags
    const projectFlags = await prisma.featureFlag.findMany({
      where: { projectId: params.projectId },
      include: { rolePermissions: true },
    });

    // Get workspace defaults for features not overridden
    const overriddenNames = projectFlags.map((f) => f.featureName);
    const workspaceFlags = await prisma.featureFlag.findMany({
      where: {
        tenantId: project.tenantId,
        featureName: { notIn: overriddenNames },
      },
      include: { rolePermissions: true },
    });

    const formatFlags = (flags: any[]) =>
      flags.map((flag) => ({
        id: flag.id,
        featureName: flag.featureName,
        description: flag.description,
        isEnabled: flag.isEnabled,
        rolePermissions: flag.rolePermissions.map((rp: any) => ({
          id: rp.id,
          roleName: rp.roleName,
          isEnabled: rp.isEnabled,
        })),
      }));

    return ok({
      projectFeatures: formatFlags(projectFlags),
      workspaceDefaults: formatFlags(workspaceFlags),
    });
  } catch (error) {
    console.error("Error fetching project permissions:", error);
    return err("Failed to fetch permissions", 500);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const caller = await requireTenantAccess(req, params.projectId);
  if (!caller) return err("Unauthorized", 401);

  try {
    // Verify user is OWNER or LEAD
    const projectMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: params.projectId,
          userId: (caller as any).userId,
        },
      },
    });

    if (!projectMember || !["OWNER", "LEAD"].includes(projectMember.role)) {
      return err("Forbidden", 403);
    }

    const body = await req.json();
    const { permissions, useWorkspaceDefaults } = updatePermissionsSchema.parse(body);

    if (useWorkspaceDefaults) {
      // Delete all project-specific permissions to revert to workspace defaults
      await prisma.featureFlag.deleteMany({
        where: { projectId: params.projectId },
      });
      return ok({ message: "Reverted to workspace defaults" });
    }

    // Update or create project-specific permissions
    for (const perm of permissions) {
      let flag = await prisma.featureFlag.findFirst({
        where: {
          projectId: params.projectId,
          featureName: perm.featureName,
        },
      });

      if (!flag) {
        flag = await prisma.featureFlag.create({
          data: {
            projectId: params.projectId,
            featureName: perm.featureName,
            description: perm.featureName,
            isEnabled: true,
          },
        });
      }

      // Update or create role permission
      const existing = await prisma.rolePermission.findFirst({
        where: {
          featureFlagId: flag.id,
          roleType: "PROJECT_ROLE",
          roleName: perm.roleName,
        },
      });

      if (existing) {
        await prisma.rolePermission.update({
          where: { id: existing.id },
          data: { isEnabled: perm.isEnabled },
        });
      } else {
        await prisma.rolePermission.create({
          data: {
            featureFlagId: flag.id,
            roleType: "PROJECT_ROLE",
            roleName: perm.roleName,
            isEnabled: perm.isEnabled,
          },
        });
      }
    }

    return ok({ message: "Permissions updated successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return err(error.errors[0].message, 400);
    }
    console.error("Error updating project permissions:", error);
    return err("Failed to update permissions", 500);
  }
}
