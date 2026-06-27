import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const jiraSchema = z.object({
  jiraProjectKey: z.string().max(20).optional(),
  jiraBaseUrl: z.string().url().optional().or(z.literal("")),
  jiraUserEmail: z.string().email().optional().or(z.literal("")),
  jiraApiToken: z.string().max(500).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { jiraProjectKey: true, jiraBaseUrl: true, jiraUserEmail: true, jiraApiToken: true },
  });
  if (!project) return err("Project not found", 404);
  return ok({
    jiraProjectKey: project.jiraProjectKey ?? "",
    jiraBaseUrl: project.jiraBaseUrl ?? "",
    jiraUserEmail: project.jiraUserEmail ?? "",
    hasToken: !!project.jiraApiToken,
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: caller.userId } },
  });
  if (!membership || !["OWNER", "LEAD"].includes(membership.role)) return err("Forbidden", 403);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = jiraSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0]?.message ?? "Validation failed");

  const { jiraProjectKey, jiraBaseUrl, jiraUserEmail, jiraApiToken } = parsed.data;
  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      jiraProjectKey: jiraProjectKey || null,
      jiraBaseUrl: jiraBaseUrl || null,
      jiraUserEmail: jiraUserEmail || null,
      ...(jiraApiToken && jiraApiToken !== "••••••••" ? { jiraApiToken } : {}),
    },
    select: { id: true, jiraProjectKey: true, jiraBaseUrl: true, jiraUserEmail: true },
  });
  return ok(updated);
}
