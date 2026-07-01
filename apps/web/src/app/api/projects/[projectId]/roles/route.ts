import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";
import { err, ok } from "@/lib/api-helpers";
import { z } from "zod";

const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const caller = await requireAuth(req);
    if (!caller) return err("Unauthorized", 401);

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: { id: true, tenantId: true },
    });

    if (!project) return err("Project not found", 404);

    // Check if user is project member or tenant admin
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

    if (!projectMember && (!tenantMember || !["OWNER", "ADMIN"].includes(tenantMember.role))) {
      return err("Forbidden", 403);
    }

    const roles = await prisma.customRole.findMany({
      where: { projectId: params.projectId },
      orderBy: { createdAt: "desc" },
    });

    return ok({ roles });
  } catch (error) {
    console.error("Error fetching project roles:", error);
    return err("Failed to fetch roles", 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } }
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

    if (!canManage) return err("Only project owners/leads can create roles", 403);

    const body = await req.json();
    const parsed = createRoleSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.errors[0]?.message ?? "Validation failed", 400);

    const { name, description } = parsed.data;

    // Check if role name already exists in this project
    const existing = await prisma.customRole.findFirst({
      where: { projectId: params.projectId, name },
    });
    if (existing) return err("A role with this name already exists", 409);

    const role = await prisma.customRole.create({
      data: {
        projectId: params.projectId,
        name,
        description: description || null,
      },
    });

    return ok(role, 201);
  } catch (error) {
    console.error("Error creating project role:", error);
    return err("Failed to create role", 500);
  }
}
