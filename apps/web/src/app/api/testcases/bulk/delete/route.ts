import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyProjectAccess, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const deleteSchema = z.object({
  testCaseIds: z.array(z.string()).min(1).max(100),
});

export async function POST(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  // Verify caller has access to all affected projects
  const cases = await prisma.testCase.findMany({
    where: { id: { in: parsed.data.testCaseIds } },
    select: { projectId: true },
  });
  const projectIds = [...new Set(cases.map((c) => c.projectId))];
  for (const pid of projectIds) {
    const access = await verifyProjectAccess(caller.userId, pid, caller.tenantId);
    if (!access) return err("Not found", 404);
  }

  const result = await prisma.testCase.deleteMany({
    where: {
      id: { in: parsed.data.testCaseIds },
    },
  });

  return ok(
    {
      deleted: result.count,
      testCaseIds: parsed.data.testCaseIds,
    },
    200
  );
}
