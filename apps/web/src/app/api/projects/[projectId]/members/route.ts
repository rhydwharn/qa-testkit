import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
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

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return err("User not found — they must register first", 404);

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
