import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyProjectAccess, ok, err } from "@/lib/api-helpers";
import { enforcePermission } from "@/lib/permission-middleware";
import { z } from "zod";

const createSchema = z.object({
  body: z.string().min(1).max(5000),
  entityType: z.enum(["TEST_CASE", "TEST_CYCLE", "TEST_PLAN"]),
  entityId: z.string(),
});

export async function GET(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  let projectId = searchParams.get("projectId");

  if (!entityType || !entityId) return err("entityType and entityId required");

  // If projectId not provided, derive it from the entity
  if (!projectId) {
    if (entityType === "TEST_CASE") {
      const tc = await prisma.testCase.findUnique({
        where: { id: entityId },
        select: { projectId: true },
      });
      projectId = tc?.projectId ?? null;
    } else if (entityType === "TEST_CYCLE") {
      const cycle = await prisma.testCycle.findUnique({
        where: { id: entityId },
        select: { projectId: true },
      });
      projectId = cycle?.projectId ?? null;
    } else if (entityType === "TEST_PLAN") {
      const plan = await prisma.testPlan.findUnique({
        where: { id: entityId },
        select: { projectId: true },
      });
      projectId = plan?.projectId ?? null;
    }
  }

  if (!projectId) return err("Project not found", 404);

  // Verify user has access to the project
  const access = await verifyProjectAccess(caller.userId, projectId, caller.tenantId);
  if (!access) return err("Forbidden", 403);

  const comments = await prisma.comment.findMany({
    where: { entityType, entityId },
    include: { author: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return ok(comments);
}

export async function POST(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  // Get the project ID based on entity type
  let projectId: string | null = null;
  if (parsed.data.entityType === "TEST_CASE") {
    const tc = await prisma.testCase.findUnique({
      where: { id: parsed.data.entityId },
      select: { projectId: true },
    });
    projectId = tc?.projectId ?? null;
  } else if (parsed.data.entityType === "TEST_CYCLE") {
    const cycle = await prisma.testCycle.findUnique({
      where: { id: parsed.data.entityId },
      select: { projectId: true },
    });
    projectId = cycle?.projectId ?? null;
  } else if (parsed.data.entityType === "TEST_PLAN") {
    const plan = await prisma.testPlan.findUnique({
      where: { id: parsed.data.entityId },
      select: { projectId: true },
    });
    projectId = plan?.projectId ?? null;
  }

  if (!projectId) return err("Entity not found", 404);

  const permissionError = await enforcePermission(
    caller.userId,
    projectId,
    "PROJECT_COMMENTS_CREATE"
  );
  if (permissionError) return permissionError;

  const comment = await prisma.comment.create({
    data: {
      body: parsed.data.body,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      authorId: caller.userId,
    },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  return ok(comment, 201);
}
