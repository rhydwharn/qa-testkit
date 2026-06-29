import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const testCaseId: string | undefined = body.testCaseId;

  if (testCaseId) {
    // Sync a specific test case
    const latestVersion = await prisma.testCaseVersion.findFirst({
      where: { testCaseId, isLatest: true },
    });

    if (!latestVersion) {
      return err("No latest version found for test case");
    }

    await prisma.testCaseExecution.updateMany({
      where: { testCycleId: params.id, testCaseId },
      data: { testCaseVersionId: latestVersion.id },
    });

    return ok({ synced: true, testCaseId, latestVersionId: latestVersion.id });
  } else {
    // Sync all test cases in the cycle to their latest versions (atomically)
    try {
      const result = await prisma.$transaction(async (tx) => {
        const executions = await tx.testCaseExecution.findMany({
          where: { testCycleId: params.id },
          select: { testCaseId: true, id: true },
          distinct: ["testCaseId"],
        });

        // Filter out external executions that don't have a testCaseId
        const testCaseIds = executions.map((e) => e.testCaseId).filter((id): id is string => id !== null);
        const latestVersions = await tx.testCaseVersion.findMany({
          where: { testCaseId: { in: testCaseIds }, isLatest: true },
          select: { id: true, testCaseId: true },
        });

        const versionMap = new Map(latestVersions.map((v) => [v.testCaseId, v.id]));

        for (const [testCaseId, versionId] of versionMap) {
          await tx.testCaseExecution.updateMany({
            where: { testCycleId: params.id, testCaseId },
            data: { testCaseVersionId: versionId },
          });
        }

        return versionMap.size;
      });

      return ok({ synced: true, totalCases: result });
    } catch (error) {
      return err("Failed to sync versions. Please try again.", 500);
    }
  }
}
