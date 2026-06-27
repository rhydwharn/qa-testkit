import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyProjectAccess, ok, err } from "@/lib/api-helpers";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const tc = await prisma.testCase.findUnique({
    where: { id: params.id },
    select: { projectId: true },
  });

  if (!tc) return err("Not found", 404);

  const access = await verifyProjectAccess(caller.userId, tc.projectId, caller.tenantId);
  if (!access) return err("Not found", 404);

  const updated = await prisma.testCase.update({
    where: { id: params.id },
    data: { isArchived: true },
  });

  return ok({ archived: true, testCase: updated });
}
