import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const original = await prisma.testCase.findUnique({
    where: { id: params.id },
    include: {
      versions: {
        where: { isLatest: true },
        include: {
          steps: { orderBy: { order: "asc" } },
        },
        take: 1,
      },
      labels: { include: { label: true } },
    },
  });

  if (!original) return err("Test case not found", 404);

  const body = await req.json().catch(() => ({}));
  const targetFolderId: string | undefined = body.folderId ?? original.folderId ?? undefined;

  const count = await prisma.testCase.count({ where: { projectId: original.projectId } });
  const latestVersion = original.versions[0];

  const cloned = await prisma.testCase.create({
    data: {
      key: `TC-${count + 1}`,
      summary: `${original.summary} (Copy)`,
      description: original.description ?? undefined,
      status: "DRAFT",
      projectId: original.projectId,
      folderId: targetFolderId,
      jiraRequirementKeys: original.jiraRequirementKeys,
      versions: {
        create: {
          versionNo: 1,
          isLatest: true,
          steps: latestVersion
            ? {
                create: latestVersion.steps.map((s) => ({
                  order: s.order,
                  stepDetails: s.stepDetails,
                  expectedResult: s.expectedResult ?? "",
                  testData: s.testData ?? "",
                })),
              }
            : undefined,
        },
      },
      labels: {
        create: original.labels.map((l) => ({ labelId: l.labelId })),
      },
    },
    select: { id: true, key: true, summary: true },
  });

  return ok(cloned, 201);
}
