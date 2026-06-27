import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const memberships = await prisma.projectMember.findMany({
    where: {
      userId: caller.userId,
      ...(caller.tenantId ? { project: { tenantId: caller.tenantId } } : {}),
    },
    select: { projectId: true },
  });
  const projectIds = memberships.map((m) => m.projectId);

  const [totalProjects, totalCases, totalCycles, execStats] = await Promise.all([
    prisma.project.count({ where: { id: { in: projectIds } } }),
    prisma.testCase.count({ where: { projectId: { in: projectIds } } }),
    prisma.testCycle.count({ where: { projectId: { in: projectIds } } }),
    prisma.testCaseExecution.groupBy({
      by: ["status"],
      where: { testCycle: { projectId: { in: projectIds } } },
      _count: true,
    }),
  ]);

  const statusMap: Record<string, number> = {};
  execStats.forEach((s) => { statusMap[s.status] = s._count; });
  const total = Object.values(statusMap).reduce((a, b) => a + b, 0);
  const passRate = total > 0 ? Math.round(((statusMap.PASS ?? 0) / total) * 100) : 0;

  return ok({ totalProjects, totalCases, totalCycles, passRate, totalExecutions: total });
}
