import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/api-helpers";
import { err, ok } from "@/lib/api-helpers";
import { z } from "zod";

const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
});

const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const { error, caller } = await requireTenantAccess(req);
    if (error) return error;
    if (!caller) return err("Unauthorized", 401);
    if (caller.tenantId !== params.tenantId) return err("Forbidden", 403);

    const roles = await prisma.customRole.findMany({
      where: { tenantId: params.tenantId },
      orderBy: { createdAt: "desc" },
    });

    return ok({ roles });
  } catch (error) {
    console.error("Error fetching roles:", error);
    return err("Failed to fetch roles", 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { tenantId: string } }
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
      return err("Only workspace owners/admins can create roles", 403);
    }

    const body = await req.json();
    const parsed = createRoleSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.errors[0]?.message ?? "Validation failed", 400);

    const { name, description } = parsed.data;

    // Check if role name already exists in this tenant
    const existing = await prisma.customRole.findFirst({
      where: { tenantId: params.tenantId, name },
    });
    if (existing) return err("A role with this name already exists", 409);

    const role = await prisma.customRole.create({
      data: {
        tenantId: params.tenantId,
        name,
        description: description || null,
      },
    });

    return ok(role, 201);
  } catch (error) {
    console.error("Error creating role:", error);
    return err("Failed to create role", 500);
  }
}
