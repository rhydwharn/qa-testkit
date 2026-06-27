import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const createSchema = z.object({
  body: z.string().min(1).max(5000),
  entityType: z.enum(["TEST_CASE", "TEST_CYCLE", "TEST_PLAN"]),
  entityId: z.string(),
});

export async function GET(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");

  if (!entityType || !entityId) return err("entityType and entityId required");

  const comments = await prisma.comment.findMany({
    where: { entityType, entityId },
    include: { author: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return ok(comments);
}

export async function POST(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const comment = await prisma.comment.create({
    data: {
      body: parsed.data.body,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      authorId: caller.userId,
    },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  return ok(comment, 201);
}
