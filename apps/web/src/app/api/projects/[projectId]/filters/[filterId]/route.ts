import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string; filterId: string } }
) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId: params.projectId,
        userId: caller.userId,
      },
    },
  });
  if (!membership) return err("Forbidden", 403);

  const filter = await prisma.savedFilter.findUnique({
    where: { id: params.filterId },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });

  if (!filter) return err("Not found", 404);
  if (filter.projectId !== params.projectId) return err("Forbidden", 403);

  return ok(filter, 200);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { projectId: string; filterId: string } }
) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId: params.projectId,
        userId: caller.userId,
      },
    },
  });
  if (!membership) return err("Forbidden", 403);

  const filter = await prisma.savedFilter.findUnique({
    where: { id: params.filterId },
  });

  if (!filter) return err("Not found", 404);
  if (filter.projectId !== params.projectId) return err("Forbidden", 403);

  await prisma.savedFilter.delete({
    where: { id: params.filterId },
  });

  return ok({ deleted: true }, 200);
}
