import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyProjectAccess, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const deleteSchema = z.object({
  testCycleIds: z.array(z.string()).min(1).max(100),
});

export async function POST(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  // Verify caller has access to all affected projects
  const cycles = await prisma.testCycle.findMany({
    where: { id: { in: parsed.data.testCycleIds } },
    select: { projectId: true },
  });
  const projectIds = [...new Set(cycles.map((c) => c.projectId))];
  for (const pid of projectIds) {
    const access = await verifyProjectAccess(caller.userId, pid, caller.tenantId);
    if (!access) return err("Not found", 404);
  }

  const result = await prisma.testCycle.deleteMany({
    where: {
      id: { in: parsed.data.testCycleIds },
    },
  });

  return ok(
    {
      deleted: result.count,
    },
    200
  );
}
