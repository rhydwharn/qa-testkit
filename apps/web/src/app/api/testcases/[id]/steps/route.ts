import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const stepSchema = z.object({
  order: z.number().int().min(1),
  stepDetails: z.string().min(1),
  expectedResult: z.string().nullable().optional().transform(v => v ?? ""),
  testData: z.string().nullable().optional().transform(v => v ?? ""),
});

const upsertSchema = z.object({
  steps: z.array(stepSchema),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  // Get latest version
  const latest = await prisma.testCaseVersion.findFirst({
    where: { testCaseId: params.id, isLatest: true },
  });
  if (!latest) return err("Test case or version not found", 404);

  // Replace all steps atomically, first clearing execution records that
  // reference the old steps (no cascade on that FK in the schema).
  const steps = await prisma.$transaction(async (tx) => {
    const existingStepIds = (
      await tx.testStep.findMany({
        where: { versionId: latest.id },
        select: { id: true },
      })
    ).map((s) => s.id);

    if (existingStepIds.length > 0) {
      await tx.testStepExecution.deleteMany({
        where: { testStepId: { in: existingStepIds } },
      });
    }

    await tx.testStep.deleteMany({ where: { versionId: latest.id } });

    return Promise.all(
      parsed.data.steps.map((s) =>
        tx.testStep.create({
          data: {
            versionId: latest.id,
            order: s.order,
            stepDetails: s.stepDetails,
            expectedResult: s.expectedResult,
            testData: s.testData,
          },
        })
      )
    );
  });

  return ok(steps);
}
