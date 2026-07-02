import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyProjectAccess, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const querySchema = z.object({
  projectId: z.string(),
  skip: z.preprocess(v => (v == null || v === "" ? 0 : Number(v)), z.number().int().min(0)).default(0),
  take: z.preprocess(v => (v == null || v === "" ? 50 : Number(v)), z.number().int().min(1).max(100)).default(50),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    projectId: searchParams.get("projectId"),
    skip: searchParams.get("skip"),
    take: searchParams.get("take"),
  });
  if (!parsed.success) return err(parsed.error.message);

  const access = await verifyProjectAccess(caller.userId, parsed.data.projectId, caller.tenantId);
  if (!access) return err("Forbidden", 403);

  const [executions, total] = await Promise.all([
    prisma.testCaseExecution.findMany({
      where: {
        testCaseId: params.id,
      },
      include: {
        testCaseVersion: {
          include: {
            testCase: {
              select: { id: true, key: true, summary: true, priority: true },
            },
            steps: { orderBy: { order: "asc" } },
          },
        },
        testCycle: {
          select: { id: true, key: true, summary: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, image: true },
        },
        stepExecutions: { orderBy: { id: "asc" } },
        defects: true,
        attachments: { orderBy: { createdAt: "asc" } },
      },
      skip: parsed.data.skip,
      take: parsed.data.take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.testCaseExecution.count({
      where: {
        testCaseId: params.id,
      },
    }),
  ]);

  return ok({ executions, total }, 200);
}
