import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const linkSchema = z.object({
  testCycleId: z.string(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  try {
    const created = await prisma.testPlanCycle.create({
      data: {
        testPlanId: params.id,
        testCycleId: parsed.data.testCycleId,
      },
    });
    return ok(created, 201);
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002") {
      return err("Cycle already linked to this plan", 409);
    }
    throw e;
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const cycleId = new URL(req.url).searchParams.get("cycleId");
  if (!cycleId) return err("cycleId is required");

  await prisma.testPlanCycle.delete({
    where: {
      testPlanId_testCycleId: {
        testPlanId: params.id,
        testCycleId: cycleId,
      },
    },
  });

  return ok({ unlinked: true });
}
