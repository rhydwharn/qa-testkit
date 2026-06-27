import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const linkSchema = z.object({
  testCaseIds: z.array(z.string()).min(1),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const results = [];
  for (const tcId of parsed.data.testCaseIds) {
    const exists = await prisma.testCycleCase.findUnique({
      where: { testCycleId_testCaseId: { testCycleId: params.id, testCaseId: tcId } },
    });
    if (exists) continue;

    const latestVersion = await prisma.testCaseVersion.findFirst({
      where: { testCaseId: tcId, isLatest: true },
    });
    if (!latestVersion) continue;

    await prisma.testCycleCase.create({
      data: { testCycleId: params.id, testCaseId: tcId },
    });

    const exec = await prisma.testCaseExecution.create({
      data: {
        testCycleId: params.id,
        testCaseId: tcId,
        testCaseVersionId: latestVersion.id,
        status: "NOT_RUN",
      },
    });
    results.push(exec);
  }

  return ok({ linked: results.length, results });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const testCaseId = searchParams.get("testCaseId");
  if (!testCaseId) return err("testCaseId is required");

  await prisma.testCycleCase.delete({
    where: { testCycleId_testCaseId: { testCycleId: params.id, testCaseId } },
  });
  await prisma.testCaseExecution.deleteMany({
    where: { testCycleId: params.id, testCaseId },
  });

  return ok({ unlinked: true });
}
