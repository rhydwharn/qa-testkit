import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const createSchema = z.object({
  projectId: z.string(),
  summary: z.string().min(1).max(500),
  description: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "CLOSED"]).optional(),
  priorityId: z.string().optional(),
  environmentId: z.string().optional(),
  buildId: z.string().optional(),
  folderId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  testCaseIds: z.array(z.string()).optional(),
});

export async function GET(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) return err("projectId is required");

  const cycles = await prisma.testCycle.findMany({
    where: { projectId },
    include: {
      priority: true,
      environment: true,
      build: true,
      folder: { select: { id: true, name: true } },
      _count: { select: { executions: true, cases: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Enrich with execution stats — single query instead of N per-cycle queries
  const cycleIds = cycles.map((c) => c.id);
  const allStats = await prisma.testCaseExecution.groupBy({
    by: ["testCycleId", "status"],
    where: { testCycleId: { in: cycleIds } },
    _count: true,
  });
  const statsMap = new Map<string, Record<string, number>>();
  for (const s of allStats) {
    if (!statsMap.has(s.testCycleId)) statsMap.set(s.testCycleId, {});
    statsMap.get(s.testCycleId)![s.status] = s._count;
  }
  const enriched = cycles.map((c) => ({ ...c, executionStats: statsMap.get(c.id) ?? {} }));

  return ok(enriched);
}

export async function POST(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);
  const d = parsed.data;

  const [project, count] = await Promise.all([
    prisma.project.findUnique({ where: { id: d.projectId }, select: { key: true } }),
    prisma.testCycle.count({ where: { projectId: d.projectId } }),
  ]);
  const prefix = project?.key ?? "CYC";
  const key = `${prefix}-CY-${count + 1}`;

  const cycle = await prisma.testCycle.create({
    data: {
      key,
      summary: d.summary,
      description: d.description,
      status: d.status ?? "DRAFT",
      priorityId: d.priorityId,
      environmentId: d.environmentId,
      buildId: d.buildId,
      folderId: d.folderId,
      projectId: d.projectId,
      createdById: caller.userId,
      startDate: d.startDate ? new Date(d.startDate) : undefined,
      endDate: d.endDate ? new Date(d.endDate) : undefined,
    },
    include: { priority: true, environment: true, build: true },
  });

  // Link test cases and create executions
  if (d.testCaseIds?.length) {
    for (const tcId of d.testCaseIds) {
      const latestVersion = await prisma.testCaseVersion.findFirst({
        where: { testCaseId: tcId, isLatest: true },
      });
      if (!latestVersion) continue;

      await prisma.testCycleCase.create({
        data: { testCycleId: cycle.id, testCaseId: tcId },
      });
      await prisma.testCaseExecution.create({
        data: {
          testCycleId: cycle.id,
          testCaseId: tcId,
          testCaseVersionId: latestVersion.id,
          status: "NOT_RUN",
        },
      });
    }
  }

  return ok(cycle, 201);
}
