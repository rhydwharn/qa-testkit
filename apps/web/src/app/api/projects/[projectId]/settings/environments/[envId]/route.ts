import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";

export async function PUT(req: NextRequest, { params }: { params: { projectId: string; envId: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.projectId, userId: caller.userId } },
  });
  if (!membership) return err("Forbidden", 403);

  const { name } = await req.json();
  const updated = await prisma.environment.update({
    where: { id: params.envId },
    data: { name: name || undefined },
  });
  return ok(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { projectId: string; envId: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.projectId, userId: caller.userId } },
  });
  if (!membership) return err("Forbidden", 403);

  await prisma.environment.delete({ where: { id: params.envId } });
  return ok({ deleted: true });
}
