import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyProjectAccess, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  level: z.number().int().min(1).max(10),
  color: z.string().optional().default("#6366f1"),
});

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const access = await verifyProjectAccess(caller.userId, params.projectId, caller.tenantId);
  if (!access) return err("Forbidden", 403);

  const priorities = await prisma.priority.findMany({
    where: { projectId: params.projectId },
    orderBy: { level: "asc" },
  });

  return ok(priorities);
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
    const priority = await prisma.priority.create({
      data: {
        name: parsed.data.name,
        level: parsed.data.level,
        color: parsed.data.color,
        projectId: params.projectId,
      },
    });
    return ok(priority, 201);
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return err("Name already exists in this project", 409);
    }
    throw e;
  }
}
