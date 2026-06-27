import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const versions = await prisma.testCaseVersion.findMany({
    where: { testCaseId: params.id },
    include: { steps: { orderBy: { order: "asc" } } },
    orderBy: { versionNo: "desc" },
  });

  return ok(versions);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const testCase = await prisma.testCase.findUnique({
    where: { id: params.id },
    include: { versions: { orderBy: { versionNo: "desc" }, take: 1 } },
  });

  if (!testCase) return err("Test case not found", 404);

  const latestVersion = testCase.versions[0];
  const nextVersionNo = (latestVersion?.versionNo ?? 0) + 1;

  // Mark previous latest as not latest
  if (latestVersion) {
    await prisma.testCaseVersion.update({
      where: { id: latestVersion.id },
      data: { isLatest: false },
    });
  }

  const newVersion = await prisma.testCaseVersion.create({
    data: {
      testCaseId: params.id,
      versionNo: nextVersionNo,
      isLatest: true,
      steps: latestVersion?.id
        ? {
            create: (
              await prisma.testStep.findMany({
                where: { versionId: latestVersion.id },
                orderBy: { order: "asc" },
              })
            ).map((s) => ({
              order: s.order,
              stepDetails: s.stepDetails,
              expectedResult: s.expectedResult,
              testData: s.testData,
            })),
          }
        : undefined,
    },
    include: { steps: { orderBy: { order: "asc" } } },
  });

  return ok(newVersion, 201);
}
