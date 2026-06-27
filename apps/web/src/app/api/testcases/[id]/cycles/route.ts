import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
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

  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId: parsed.data.projectId,
        userId: caller.userId,
      },
    },
  });
  if (!membership) return err("Forbidden", 403);

  const [cycles, total] = await Promise.all([
    prisma.testCycle.findMany({
      where: {
        cases: {
          some: {
            testCaseId: params.id,
          },
        },
      },
      include: {
        priority: true,
        environment: true,
        build: true,
        folder: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true, image: true } },
        _count: { select: { executions: true, cases: true } },
      },
      skip: parsed.data.skip,
      take: parsed.data.take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.testCycle.count({
      where: {
        cases: {
          some: {
            testCaseId: params.id,
          },
        },
      },
    }),
  ]);

  return ok({ cycles, total }, 200);
}
