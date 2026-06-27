import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const createFilterSchema = z.object({
  name: z.string().min(1).max(200),
  entityType: z.enum(["TEST_CASE", "TEST_CYCLE", "TEST_PLAN"]),
  criteria: z.record(z.any()),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId: params.projectId,
        userId: caller.userId,
      },
    },
  });
  if (!membership) return err("Forbidden", 403);

  const filters = await prisma.savedFilter.findMany({
    where: {
      projectId: params.projectId,
    },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return ok(filters, 200);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId: params.projectId,
        userId: caller.userId,
      },
    },
  });
  if (!membership) return err("Forbidden", 403);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = createFilterSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const filter = await prisma.savedFilter.create({
    data: {
      name: parsed.data.name,
      entityType: parsed.data.entityType,
      criteria: parsed.data.criteria,
      projectId: params.projectId,
      createdById: caller.userId,
    },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });

  return ok(filter, 201);
}
