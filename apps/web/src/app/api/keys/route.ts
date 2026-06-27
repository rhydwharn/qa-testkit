import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { generateApiKey } from "@/lib/api-key";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  projectId: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

export async function GET(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const keys = await prisma.apiKey.findMany({
    where: {
      userId: caller.userId,
      ...(caller.tenantId ? { tenantId: caller.tenantId } : {}),
    },
    select: {
      id: true,
      name: true,
      prefix: true,
      projectId: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
      project: { select: { name: true, key: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return ok(keys);
}

export async function POST(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const { name, projectId, expiresAt } = parsed.data;

  // Verify project membership + tenant if projectId given
  if (projectId) {
    const member = await prisma.projectMember.findFirst({
      where: { userId: caller.userId, projectId },
    });
    if (!member) return err("Project not found or access denied", 403);

    if (caller.tenantId) {
      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { tenantId: true } });
      if (!project || project.tenantId !== caller.tenantId) return err("Project not found", 404);
    }
  }

  const { key, prefix, hash } = generateApiKey();

  await prisma.apiKey.create({
    data: {
      name,
      keyHash: hash,
      prefix,
      userId: caller.userId,
      tenantId: caller.tenantId ?? null,
      projectId: projectId ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  // Return the raw key ONCE — it is never stored
  return ok({ key, prefix, name }, 201);
}
