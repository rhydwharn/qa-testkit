import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const cycle = await prisma.testCycle.update({
    where: { id: params.id },
    data: { isArchived: false },
  });

  return ok({ archived: false, testCycle: cycle });
}
