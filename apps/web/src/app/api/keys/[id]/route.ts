import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ok, err } from "@/lib/api-helpers";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return err("Unauthorized", 401);

  const key = await prisma.apiKey.findUnique({
    where: { id: params.id },
    select: { userId: true },
  });

  if (!key) return err("Not found", 404);
  if (key.userId !== session.user.id) return err("Forbidden", 403);

  await prisma.apiKey.delete({ where: { id: params.id } });
  return ok({ deleted: true });
}
