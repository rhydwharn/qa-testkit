import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  jiraProjectKey: z.string().optional(),
  jiraBaseUrl: z.string().optional(),
  jiraUserEmail: z.string().optional(),
  jiraApiToken: z.string().optional(),
});

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.projectId, userId: caller.userId } },
  });
  if (!membership) return err("Forbidden", 403);

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
      environments: { orderBy: { createdAt: "asc" } },
      builds: { orderBy: { createdAt: "asc" } },
      labels: { orderBy: { name: "asc" } },
      priorities: { orderBy: { level: "asc" } },
    },
  });

  if (!project) return err("Not found", 404);
  return ok(project);
}

export async function PUT(req: NextRequest, { params }: { params: { projectId: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.projectId, userId: caller.userId } },
  });
  if (!membership) return err("Forbidden", 403);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const updated = await prisma.project.update({
    where: { id: params.projectId },
    data: parsed.data,
  });

  return ok(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { projectId: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.projectId, userId: caller.userId } },
  });
  if (!membership) return err("Forbidden", 403);
  if (membership.role !== "OWNER") return err("Only the project owner can delete this project", 403);

  await prisma.project.delete({ where: { id: params.projectId } });
  return ok({ deleted: true });
}
