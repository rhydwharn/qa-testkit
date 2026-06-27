import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.projectId, userId: caller.userId } },
  });
  if (!membership) return err("Forbidden", 403);

  const builds = await prisma.build.findMany({
    where: { projectId: params.projectId },
    orderBy: { createdAt: "asc" },
  });

  return ok(builds);
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
    const build = await prisma.build.create({
      data: { name: parsed.data.name, projectId: params.projectId },
    });
    return ok(build, 201);
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return err("Name already exists in this project", 409);
    }
    throw e;
  }
}
