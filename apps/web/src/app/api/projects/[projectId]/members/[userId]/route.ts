import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ projectId: string; userId: string }> }) {
  const { projectId, userId } = await params;
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: caller.userId } },
  });
  if (!membership || !["OWNER", "LEAD"].includes(membership.role)) return err("Forbidden — only OWNER or LEAD can remove members", 403);

  const target = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!target) return err("Member not found", 404);
  if (target.role === "OWNER") return err("Cannot remove project owner", 400);

  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId, userId } },
  });

  return ok({ removed: true });
}
