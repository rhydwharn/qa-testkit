import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const schema = z.object({
  status: z.enum(["NOT_RUN", "IN_PROGRESS", "PASS", "FAIL", "BLOCKED", "SKIPPED"]),
  actualResult: z.string().optional(),
  comment: z.string().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; execId: string; stepId: string } }
) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const existing = await prisma.testStepExecution.findFirst({
    where: { executionId: params.execId, testStepId: params.stepId },
  });

  if (existing) {
    const updated = await prisma.testStepExecution.update({
      where: { id: existing.id },
      data: parsed.data,
    });
    return ok(updated);
  } else {
    const created = await prisma.testStepExecution.create({
      data: { executionId: params.execId, testStepId: params.stepId, ...parsed.data },
    });
    return ok(created, 201);
  }
}
