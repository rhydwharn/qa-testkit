import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/api-helpers";
import { err, ok } from "@/lib/api-helpers";
import { initializeWorkspaceFeatures } from "@/lib/permissions";
import { z } from "zod";

const updatePermissionsSchema = z.object({
  permissions: z.array(
    z.object({
      featureName: z.string(),
      roleName: z.string(),
      isEnabled: z.boolean(),
    })
  ),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error, caller } = await requireTenantAccess(req);
    if (error) return error;
    if (!caller) return err("Unauthorized", 401);
    if (caller.tenantId !== params.id) return err("Forbidden", 403);

    const membership = await prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId: params.id,
          userId: (caller as any).userId,
        },
      },
    });

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
      return err("Forbidden", 403);
    }

    // Get all workspace feature flags
    let featureFlags = await prisma.featureFlag.findMany({
      where: { tenantId: params.id },
      include: { rolePermissions: true },
    });

    // Initialize features if none exist
    if (featureFlags.length === 0) {
      await initializeWorkspaceFeatures(params.id);
      featureFlags = await prisma.featureFlag.findMany({
        where: { tenantId: params.id },
        include: { rolePermissions: true },
      });
    }

    // Deduplicate features by featureName (keep first occurrence)
    const seenFeatures = new Set<string>();
    const uniqueFeatureFlags = featureFlags.filter((flag) => {
      if (seenFeatures.has(flag.featureName)) {
        return false;
      }
      seenFeatures.add(flag.featureName);
      return true;
    });

    return ok({
      featureFlags: uniqueFeatureFlags.map((flag) => ({
        id: flag.id,
        featureName: flag.featureName,
        description: flag.description,
        isEnabled: flag.isEnabled,
        rolePermissions: flag.rolePermissions.map((rp) => ({
          id: rp.id,
          roleName: rp.roleName,
          isEnabled: rp.isEnabled,
        })),
      })),
    });
  } catch (error) {
    console.error("Error fetching workspace permissions:", error);
    return err("Failed to fetch permissions", 500);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error, caller } = await requireTenantAccess(req);
    if (error) return error;
    if (!caller) return err("Unauthorized", 401);
    if (caller.tenantId !== params.id) return err("Forbidden", 403);

    const membership = await prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId: params.id,
          userId: (caller as any).userId,
        },
      },
    });

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
      return err("Forbidden", 403);
    }

    const body = await req.json();
    const { permissions } = updatePermissionsSchema.parse(body);

    // Update each permission
    for (const perm of permissions) {
      const flag = await prisma.featureFlag.findFirst({
        where: {
          tenantId: params.id,
          featureName: perm.featureName,
        },
      });

      if (!flag) continue;

      await prisma.rolePermission.updateMany({
        where: {
          featureFlagId: flag.id,
          roleType: "TENANT_ROLE",
          roleName: perm.roleName,
        },
        data: { isEnabled: perm.isEnabled },
      });
    }

    return ok({ message: "Permissions updated successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return err(error.errors[0].message, 400);
    }
    console.error("Error updating workspace permissions:", error);
    return err("Failed to update permissions", 500);
  }
}
