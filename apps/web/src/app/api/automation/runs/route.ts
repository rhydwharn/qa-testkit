import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyProjectAccess, ok, err } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const caller = await requireAuth(req);
  console.log("[automation/runs] Auth result:", caller ? `User ${caller.userId}` : "No auth");
  if (!caller) return err("Unauthorized", 401);

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return err("projectId is required");

  const access = await verifyProjectAccess(caller.userId, projectId, caller.tenantId);
  if (!access) return err("Forbidden", 403);

  try {
    const runs = await prisma.automationRun.findMany({
      where: { projectId },
      include: {
        testCycle: {
          select: {
            id: true,
            key: true,
            summary: true,
          },
        },
      },
      orderBy: { submittedAt: "desc" },
      take: 3,
    });

    const formatted = runs.map((run) => ({
      id: run.id,
      framework: run.framework,
      cycleName: run.testCycle?.summary,
      summary: run.testCycle?.summary,
      passCount: run.passed,
      failCount: run.failed,
      createdAt: run.submittedAt,
      testCycle: run.testCycle ? {
        key: run.testCycle.key,
        summary: run.testCycle.summary,
      } : null,
    }));

    return ok(formatted);
  } catch (e) {
    console.error("[automation/runs] error:", e);
    return err("Failed to fetch automation runs", 500);
  }
}
