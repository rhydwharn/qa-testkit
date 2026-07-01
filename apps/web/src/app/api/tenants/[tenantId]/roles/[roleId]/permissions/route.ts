import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/api-helpers";
import { err, ok } from "@/lib/api-helpers";
import { z } from "zod";

const updatePermissionsSchema = z.object({
  permissions: z.array(
    z.object({
      featureName: z.string(),
      isEnabled: z.boolean(),
    })
  ),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { tenantId: string; roleId: string } }
) {
  try {
    const { error, caller } = await requireTenantAccess(req);
    if (error) return error;
    if (!caller) return err("Unauthorized", 401);
    if (caller.tenantId !== params.tenantId) return err("Forbidden", 403);

    // Verify role belongs to this tenant
    const role = await prisma.customRole.findUnique({
      where: { id: params.roleId },
      include: {
        rolePermissions: {
          include: {
            featureFlag: {
              select: { id: true, featureName: true, description: true },
            },
          },
        },
      },
    });

    if (!role || role.tenantId !== params.tenantId) {
      return err("Role not found", 404);
    }

    const permissions = role.rolePermissions.map((rp) => ({
      id: rp.id,
      featureName: rp.featureFlag.featureName,
      featureDescription: rp.featureFlag.description,
      isEnabled: rp.isEnabled,
    }));

    return ok({ permissions });
  } catch (error) {
    console.error("Error fetching role permissions:", error);
    return err("Failed to fetch permissions", 500);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { tenantId: string; roleId: string } }
) {
  try {
    const { error, caller } = await requireTenantAccess(req);
    if (error) return error;
    if (!caller) return err("Unauthorized", 401);
    if (caller.tenantId !== params.tenantId) return err("Forbidden", 403);

    // Check if user is tenant owner/admin
    const membership = await prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId: params.tenantId,
          userId: (caller as any).userId,
        },
      },
    });

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
      return err("Only workspace owners/admins can update role permissions", 403);
    }

    // Verify role belongs to this tenant
    const role = await prisma.customRole.findUnique({
      where: { id: params.roleId },
    });

    if (!role || role.tenantId !== params.tenantId) {
      return err("Role not found", 404);
    }

    const body = await req.json();
    const parsed = updatePermissionsSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.errors[0]?.message ?? "Validation failed", 400);

    const { permissions } = parsed.data;

    // Get tenant-level feature flags
    const tenantFeatures = await prisma.featureFlag.findMany({
      where: { tenantId: params.tenantId },
      select: { id: true, featureName: true },
    });

    const featureMap = new Map(tenantFeatures.map((f) => [f.featureName, f.id]));

    // Update permissions
    for (const perm of permissions) {
      const featureFlagId = featureMap.get(perm.featureName);
      if (!featureFlagId) continue;

      const existing = await prisma.rolePermission.findFirst({
        where: { featureFlagId, customRoleId: params.roleId },
      });

      if (existing) {
        await prisma.rolePermission.update({
          where: { id: existing.id },
          data: { isEnabled: perm.isEnabled },
        });
      } else {
        await prisma.rolePermission.create({
          data: {
            featureFlagId,
            customRoleId: params.roleId,
            roleType: "TENANT_ROLE",
            isEnabled: perm.isEnabled,
          },
        });
      }
    }

    return ok({ message: "Permissions updated successfully" });
  } catch (error) {
    console.error("Error updating role permissions:", error);
    return err("Failed to update permissions", 500);
  }
}
