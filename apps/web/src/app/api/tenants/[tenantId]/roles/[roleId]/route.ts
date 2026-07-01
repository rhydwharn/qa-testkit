import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/api-helpers";
import { err, ok } from "@/lib/api-helpers";
import { z } from "zod";

const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
});

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
      return err("Only workspace owners/admins can update roles", 403);
    }

    // Verify role belongs to this tenant
    const role = await prisma.customRole.findUnique({
      where: { id: params.roleId },
    });

    if (!role || role.tenantId !== params.tenantId) {
      return err("Role not found", 404);
    }

    const body = await req.json();
    const parsed = updateRoleSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.errors[0]?.message ?? "Validation failed", 400);

    const { name, description } = parsed.data;

    // If name is being updated, check for duplicates
    if (name && name !== role.name) {
      const existing = await prisma.customRole.findFirst({
        where: { tenantId: params.tenantId, name },
      });
      if (existing) return err("A role with this name already exists", 409);
    }

    const updated = await prisma.customRole.update({
      where: { id: params.roleId },
      data: {
        ...(name && { name }),
        ...("description" in { description } && { description }),
      },
    });

    return ok(updated);
  } catch (error) {
    console.error("Error updating role:", error);
    return err("Failed to update role", 500);
  }
}

export async function DELETE(
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
      return err("Only workspace owners/admins can delete roles", 403);
    }

    // Verify role belongs to this tenant
    const role = await prisma.customRole.findUnique({
      where: { id: params.roleId },
    });

    if (!role || role.tenantId !== params.tenantId) {
      return err("Role not found", 404);
    }

    // Delete the role (cascade will handle related records)
    await prisma.customRole.delete({
      where: { id: params.roleId },
    });

    return ok({ message: "Role deleted successfully" });
  } catch (error) {
    console.error("Error deleting role:", error);
    return err("Failed to delete role", 500);
  }
}
