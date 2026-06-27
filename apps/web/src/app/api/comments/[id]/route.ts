import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const updateSchema = z.object({
  body: z.string().min(1).max(5000),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const comment = await prisma.comment.findUnique({ where: { id: params.id } });
  if (!comment) return err("Comment not found", 404);

  // Only author can edit
  if (comment.authorId !== caller.userId) {
    return err("Forbidden", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const updated = await prisma.comment.update({
    where: { id: params.id },
    data: { body: parsed.data.body },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  return ok(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const comment = await prisma.comment.findUnique({ where: { id: params.id } });
  if (!comment) return err("Comment not found", 404);

  // Only author can delete
  if (comment.authorId !== caller.userId) {
    return err("Forbidden", 403);
  }

  await prisma.comment.delete({ where: { id: params.id } });
  return ok({ deleted: true });
}
