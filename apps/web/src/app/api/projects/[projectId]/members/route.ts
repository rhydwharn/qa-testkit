import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { enforcePermission } from "@/lib/permission-middleware";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["OWNER", "LEAD", "TESTER", "VIEWER"]).default("TESTER"),
});

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.projectId, userId: caller.userId } },
  });
  if (!membership) return err("Forbidden", 403);

  const members = await prisma.projectMember.findMany({
    where: { projectId: params.projectId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true, role: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  return ok(members);
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.projectId, userId: caller.userId } },
  });
  if (!membership) return err("Forbidden", 403);

  const permissionError = await enforcePermission(
    caller.userId,
    params.projectId,
    "PROJECT_MEMBERS_MANAGE"
  );
  if (permissionError) return permissionError;

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  // Find user by email
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return err("User not found — they must register first", 404);

  // Get project to find tenant
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: { tenantId: true },
  });
  if (!project) return err("Project not found", 404);

  // Check if user is a member of the workspace
  const workspaceMember = await prisma.tenantMember.findUnique({
    where: {
      tenantId_userId: {
        tenantId: project.tenantId,
        userId: user.id,
      },
    },
  });

  if (!workspaceMember) {
    return err(
      "User must be a workspace member first. Invite them to the workspace and have them activate their account.",
      400
    );
  }

  const member = await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: params.projectId, userId: user.id } },
    create: { projectId: params.projectId, userId: user.id, role: parsed.data.role },
    update: { role: parsed.data.role },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  return ok(member, 201);
}
