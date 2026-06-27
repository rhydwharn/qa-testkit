import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const updateSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { id, userId } = await params;
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const myMembership = await prisma.tenantMember.findUnique({
    where: { tenantId_userId: { tenantId: id, userId: caller.userId } },
  });
  if (!myMembership || !["OWNER", "ADMIN"].includes(myMembership.role)) return err("Forbidden", 403);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0]?.message ?? "Validation failed");

  const updated = await prisma.tenantMember.updateMany({
    where: { tenantId: id, userId },
    data: { role: parsed.data.role },
  });

  if (updated.count === 0) return err("Member not found", 404);
  return ok({ updated: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { id, userId } = await params;
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  // Only owner/admin can remove, or a member removing themselves
  const myMembership = await prisma.tenantMember.findUnique({
    where: { tenantId_userId: { tenantId: id, userId: caller.userId } },
  });
  if (!myMembership) return err("Forbidden", 403);

  const isAdminAction = ["OWNER", "ADMIN"].includes(myMembership.role);
  const isSelfRemoval = caller.userId === userId;
  if (!isAdminAction && !isSelfRemoval) return err("Forbidden", 403);

  // Prevent removing the last OWNER
  const targetMembership = await prisma.tenantMember.findUnique({
    where: { tenantId_userId: { tenantId: id, userId } },
  });
  if (targetMembership?.role === "OWNER") {
    const ownerCount = await prisma.tenantMember.count({ where: { tenantId: id, role: "OWNER" } });
    if (ownerCount <= 1) return err("Cannot remove the last owner of a workspace", 400);
  }

  await prisma.tenantMember.deleteMany({ where: { tenantId: id, userId } });
  return ok({ removed: true });
}
