import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const createSchema = z.object({
  projectId: z.string(),
  summary: z.string().min(1).max(500),
  description: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
  priorityId: z.string().optional(),
  folderId: z.string().optional(),
  testCycleIds: z.array(z.string()).optional(),
});

export async function GET(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) return err("projectId is required");

  const plans = await prisma.testPlan.findMany({
    where: { projectId },
    include: {
      priority: true,
      folder: { select: { id: true, name: true } },
      cycles: {
        include: {
          testCycle: {
            select: {
              id: true, key: true, summary: true, status: true,
              _count: { select: { executions: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return ok(plans);
}

export async function POST(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);
  const d = parsed.data;

  const count = await prisma.testPlan.count({ where: { projectId: d.projectId } });
  const key = `PLN-${count + 1}`;

  const plan = await prisma.testPlan.create({
    data: {
      key,
      summary: d.summary,
      description: d.description,
      status: d.status ?? "DRAFT",
      priorityId: d.priorityId,
      folderId: d.folderId,
      projectId: d.projectId,
      cycles: d.testCycleIds?.length
        ? { create: d.testCycleIds.map((id) => ({ testCycleId: id })) }
        : undefined,
    },
    include: {
      priority: true,
      cycles: { include: { testCycle: { select: { id: true, key: true, summary: true, status: true } } } },
    },
  });

  return ok(plan, 201);
}
