import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyProjectAccess, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["NOT_RUN", "IN_PROGRESS", "PASS", "FAIL", "BLOCKED", "SKIPPED"]).optional(),
  actualResult: z.string().optional(),
  comment: z.string().optional(),
  assigneeId: z.string().nullable().optional(),
  duration: z.number().int().optional(),
  executionMethod: z.string().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; execId: string } }
) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  // Verify access to the test cycle's project
  const testCycle = await prisma.testCycle.findUnique({
    where: { id: params.id },
    select: { projectId: true },
  });

  if (!testCycle) return err("Not found", 404);

  const access = await verifyProjectAccess(caller.userId, testCycle.projectId, caller.tenantId);
  if (!access) return err("Not found", 404);

  const isExecuted = parsed.data.status && parsed.data.status !== "NOT_RUN";
  const data = {
    ...parsed.data,
    executedAt: isExecuted ? new Date() : undefined,
    assigneeId: isExecuted ? caller.userId : parsed.data.assigneeId,
  };

  const updated = await prisma.testCaseExecution.update({
    where: { id: params.execId, testCycleId: params.id },
    data,
    include: {
      stepExecutions: true,
      defects: true,
      assignee: { select: { id: true, name: true, image: true } },
    },
  });

  return ok(updated);
}
