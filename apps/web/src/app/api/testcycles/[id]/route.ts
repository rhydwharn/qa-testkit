import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyProjectAccess, ok, err } from "@/lib/api-helpers";
import { enforcePermission } from "@/lib/permission-middleware";
import { z } from "zod";

const updateSchema = z.object({
  summary: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "CLOSED"]).optional(),
  priorityId: z.string().nullable().optional(),
  environmentId: z.string().nullable().optional(),
  buildId: z.string().nullable().optional(),
  folderId: z.string().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const cycle = await prisma.testCycle.findUnique({
    where: { id },
    include: {
      priority: true,
      environment: true,
      build: true,
      folder: true,
      createdBy: { select: { id: true, name: true, email: true, image: true } },
      executions: {
        include: {
          testCaseVersion: {
            include: {
              testCase: { select: { id: true, key: true, summary: true, priority: true, isExternal: true } },
              steps: { orderBy: { order: "asc" } },
            },
          },
          assignee: { select: { id: true, name: true, email: true, image: true } },
          stepExecutions: {
            orderBy: { id: "asc" },
            include: { testStep: { select: { id: true, order: true, stepDetails: true } } },
          },
          defects: true,
          attachments: { orderBy: { createdAt: "asc" } },
          _count: { select: { attachments: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!cycle) return err("Not found", 404);
  const access = await verifyProjectAccess(caller.userId, cycle.projectId, caller.tenantId);
  if (!access) return err("Not found", 404);

  const permissionError = await enforcePermission(
    caller.userId,
    cycle.projectId,
    "TEST_CYCLE_READ"
  );
  if (permissionError) return permissionError;

  return ok(cycle);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const cycle = await prisma.testCycle.findUnique({ where: { id }, select: { projectId: true } });
  if (!cycle) return err("Not found", 404);
  const access = await verifyProjectAccess(caller.userId, cycle.projectId, caller.tenantId);
  if (!access) return err("Not found", 404);

  const permissionError = await enforcePermission(
    caller.userId,
    cycle.projectId,
    "TEST_CYCLE_UPDATE"
  );
  if (permissionError) return permissionError;

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const updated = await prisma.testCycle.update({
    where: { id },
    data: {
      ...parsed.data,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
    },
    include: { priority: true, environment: true, build: true },
  });

  return ok(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const cycle = await prisma.testCycle.findUnique({ where: { id }, select: { projectId: true } });
  if (!cycle) return err("Not found", 404);
  const access = await verifyProjectAccess(caller.userId, cycle.projectId, caller.tenantId);
  if (!access) return err("Not found", 404);

  const permissionError = await enforcePermission(
    caller.userId,
    cycle.projectId,
    "TEST_CYCLE_DELETE"
  );
  if (permissionError) return permissionError;

  await prisma.testCycle.delete({ where: { id } });
  return ok({ deleted: true });
}
