import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyProjectAccess, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const createSchema = z.object({ name: z.string().min(1).max(100) });

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const access = await verifyProjectAccess(caller.userId, params.projectId, caller.tenantId);
  if (!access) return err("Forbidden", 403);

  const components = await prisma.component.findMany({
    where: { projectId: params.projectId },
    orderBy: { name: "asc" },
  });
  return ok(components);
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.projectId, userId: caller.userId } },
  });
  if (!membership) return err("Forbidden", 403);
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);
  const component = await prisma.component.create({
    data: { name: parsed.data.name, projectId: params.projectId },
  });
  return ok(component, 201);
}
