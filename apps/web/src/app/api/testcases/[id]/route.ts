import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyProjectAccess, ok, err } from "@/lib/api-helpers";
import { enforcePermission } from "@/lib/permission-middleware";
import { z } from "zod";

const updateSchema = z.object({
  summary: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: z.enum(["DRAFT", "READY", "DEPRECATED"]).optional(),
  priorityId: z.string().nullable().optional(),
  folderId: z.string().nullable().optional(),
  jiraRequirementKeys: z.array(z.string()).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const testCase = await prisma.testCase.findUnique({
    where: { id },
    include: {
      priority: true,
      folder: true,
      labels: { include: { label: true } },
      components: { include: { component: true } },
      versions: {
        orderBy: { versionNo: "desc" },
        include: { steps: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (!testCase) return err("Not found", 404);
  const access = await verifyProjectAccess(caller.userId, testCase.projectId, caller.tenantId);
  if (!access) return err("Not found", 404);

  const permissionError = await enforcePermission(
    caller.userId,
    testCase.projectId,
    "TEST_CASE_READ"
  );
  if (permissionError) return permissionError;

  return ok(testCase);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const tc = await prisma.testCase.findUnique({ where: { id }, select: { projectId: true } });
  if (!tc) return err("Not found", 404);
  const access = await verifyProjectAccess(caller.userId, tc.projectId, caller.tenantId);
  if (!access) return err("Not found", 404);

  const permissionError = await enforcePermission(
    caller.userId,
    tc.projectId,
    "TEST_CASE_UPDATE"
  );
  if (permissionError) return permissionError;

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const updated = await prisma.testCase.update({
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

  const tc = await prisma.testCase.findUnique({ where: { id }, select: { projectId: true } });
  if (!tc) return err("Not found", 404);
  const access = await verifyProjectAccess(caller.userId, tc.projectId, caller.tenantId);
  if (!access) return err("Not found", 404);

  const permissionError = await enforcePermission(
    caller.userId,
    tc.projectId,
    "TEST_CASE_DELETE"
  );
  if (permissionError) return permissionError;

  await prisma.testCase.delete({ where: { id } });
  return ok({ deleted: true });
}
