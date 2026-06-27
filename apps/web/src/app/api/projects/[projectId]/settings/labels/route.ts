import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().optional().default("#6366f1"),
});

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.projectId, userId: caller.userId } },
  });
  if (!membership) return err("Forbidden", 403);

  const labels = await prisma.label.findMany({
    where: { projectId: params.projectId },
    orderBy: { name: "asc" },
  });

  return ok(labels);
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.projectId, userId: caller.userId } },
  });
  if (!membership) return err("Forbidden", 403);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  try {
    const label = await prisma.label.create({
      data: { name: parsed.data.name, color: parsed.data.color, projectId: params.projectId },
    });
    return ok(label, 201);
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return err("Name already exists in this project", 409);
    }
    throw e;
  }
}
