import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";
import { err, ok } from "@/lib/api-helpers";
import { z } from "zod";

const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { projectId: string; roleId: string } }
) {
  try {
    const caller = await requireAuth(req);
    if (!caller) return err("Unauthorized", 401);

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: { id: true, tenantId: true },
    });

    if (!project) return err("Project not found", 404);

    // Check if user is project owner/lead or tenant owner/admin
    const projectMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: params.projectId,
          userId: (caller as any).userId,
        },
      },
    });

    const tenantMember = await prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId: project.tenantId,
          userId: (caller as any).userId,
        },
      },
    });

    const canManage =
      (projectMember && ["OWNER", "LEAD"].includes(projectMember.role)) ||
      (tenantMember && ["OWNER", "ADMIN"].includes(tenantMember.role));

    if (!canManage) return err("Only project owners/leads can update roles", 403);

    // Verify role belongs to this project
    const role = await prisma.customRole.findUnique({
      where: { id: params.roleId },
    });

    if (!role || role.projectId !== params.projectId) {
      return err("Role not found", 404);
    }

    const body = await req.json();
    const parsed = updateRoleSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.errors[0]?.message ?? "Validation failed", 400);

    const { name, description } = parsed.data;

    // If name is being updated, check for duplicates
    if (name && name !== role.name) {
      const existing = await prisma.customRole.findFirst({
        where: { projectId: params.projectId, name },
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
    console.error("Error updating project role:", error);
    return err("Failed to update role", 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { projectId: string; roleId: string } }
) {
  try {
    const caller = await requireAuth(req);
    if (!caller) return err("Unauthorized", 401);

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: { id: true, tenantId: true },
    });

    if (!project) return err("Project not found", 404);

    // Check if user is project owner/lead or tenant owner/admin
    const projectMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: params.projectId,
          userId: (caller as any).userId,
        },
      },
    });

    const tenantMember = await prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId: project.tenantId,
          userId: (caller as any).userId,
        },
      },
    });

    const canManage =
      (projectMember && ["OWNER", "LEAD"].includes(projectMember.role)) ||
      (tenantMember && ["OWNER", "ADMIN"].includes(tenantMember.role));

    if (!canManage) return err("Only project owners/leads can delete roles", 403);

    // Verify role belongs to this project
    const role = await prisma.customRole.findUnique({
      where: { id: params.roleId },
    });

    if (!role || role.projectId !== params.projectId) {
      return err("Role not found", 404);
    }

    // Delete the role (cascade will handle related records)
    await prisma.customRole.delete({
      where: { id: params.roleId },
    });

    return ok({ message: "Role deleted successfully" });
  } catch (error) {
    console.error("Error deleting project role:", error);
    return err("Failed to delete role", 500);
  }
}
