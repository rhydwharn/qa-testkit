import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";

export async function PUT(req: NextRequest, { params }: { params: { projectId: string; priorityId: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.projectId, userId: caller.userId } },
  });
  if (!membership) return err("Forbidden", 403);

  const { name, level, color } = await req.json();
  const updated = await prisma.priority.update({
    where: { id: params.priorityId },
    data: { name: name || undefined, level: level || undefined, color: color || undefined },
  });
  return ok(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { projectId: string; priorityId: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.projectId, userId: caller.userId } },
  });
  if (!membership) return err("Forbidden", 403);

  await prisma.priority.delete({ where: { id: params.priorityId } });
  return ok({ deleted: true });
}
