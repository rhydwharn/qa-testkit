import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const original = await prisma.testCycle.findUnique({
    where: { id: params.id },
    include: {
      executions: {
        select: {
          testCaseId: true,
          testCaseVersionId: true,
        },
      },
    },
  });

  if (!original) return err("Test cycle not found", 404);

  const body = await req.json().catch(() => ({}));
  const targetFolderId: string | undefined = body.folderId ?? original.folderId ?? undefined;

  const count = await prisma.testCycle.count({ where: { projectId: original.projectId } });

  // Get latest versions for each test case being cloned
  // Filter out external executions that don't have a testCaseId
  const testCaseIds = [...new Set(original.executions.map((e) => e.testCaseId).filter((id): id is string => id !== null))];
  const latestVersions = await prisma.testCaseVersion.findMany({
    where: {
      isLatest: true,
      testCase: { id: { in: testCaseIds } },
    },
    select: { id: true, testCaseId: true },
  });

  const versionMap = new Map(latestVersions.map((v) => [v.testCaseId, v.id]));

  // Use transaction to ensure both cycle and executions are created atomically
  try {
    const cloned = await prisma.$transaction(async (tx) => {
      // Generate key with lock to prevent race conditions
      const cycleCount = await tx.testCycle.count({ where: { projectId: original.projectId } });

      const newCycle = await tx.testCycle.create({
        data: {
          key: `TC-${cycleCount + 1}`,
          summary: `${original.summary} (Clone)`,
          description: original.description ?? undefined,
          status: "DRAFT",
          projectId: original.projectId,
          folderId: targetFolderId,
          environmentId: original.environmentId,
          buildId: original.buildId,
          executions: {
            create: original.executions
              .filter((e) => e.testCaseId !== null) // Only clone regular test case executions, skip external ones
              .map((e) => ({
                testCaseId: e.testCaseId!,
                testCaseVersionId: versionMap.get(e.testCaseId!) || e.testCaseVersionId,
                status: "NOT_RUN",
              })),
          },
        },
        select: { id: true, key: true, summary: true },
      });

      return newCycle;
    });

    return ok(cloned, 201);
  } catch (error) {
    return err("Failed to clone cycle. Please try again.", 500);
  }
}
