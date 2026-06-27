import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyProjectAccess, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const updateSchema = z.object({
  summary: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
  priorityId: z.string().nullable().optional(),
  folderId: z.string().nullable().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const plan = await prisma.testPlan.findUnique({
    where: { id },
    include: {
      priority: true,
      folder: true,
      cycles: {
        include: {
          testCycle: {
            include: {
              priority: true,
              environment: true,
              build: true,
              _count: { select: { executions: true } },
            },
          },
        },
      },
    },
  });

  if (!plan) return err("Not found", 404);
  const access = await verifyProjectAccess(caller.userId, plan.projectId, caller.tenantId);
  if (!access) return err("Not found", 404);

  const cycleIds = plan.cycles.map((c) => c.testCycleId);

  const execStats = await prisma.testCaseExecution.groupBy({
    by: ["testCycleId", "status"],
    where: { testCycleId: { in: cycleIds } },
    _count: true,
  });

  const statsByCycle: Record<string, Record<string, number>> = {};
  execStats.forEach((s) => {
    if (!statsByCycle[s.testCycleId]) statsByCycle[s.testCycleId] = {};
    statsByCycle[s.testCycleId][s.status] = s._count;
  });

  return ok({ ...plan, executionStatsByCycle: statsByCycle });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const plan = await prisma.testPlan.findUnique({ where: { id }, select: { projectId: true } });
  if (!plan) return err("Not found", 404);
  const access = await verifyProjectAccess(caller.userId, plan.projectId, caller.tenantId);
  if (!access) return err("Not found", 404);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const updated = await prisma.testPlan.update({
    where: { id },
    data: parsed.data,
    include: { priority: true, folder: true },
  });

  return ok(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const plan = await prisma.testPlan.findUnique({ where: { id }, select: { projectId: true } });
  if (!plan) return err("Not found", 404);
  const access = await verifyProjectAccess(caller.userId, plan.projectId, caller.tenantId);
  if (!access) return err("Not found", 404);

  await prisma.testPlan.delete({ where: { id } });
  return ok({ deleted: true });
}
