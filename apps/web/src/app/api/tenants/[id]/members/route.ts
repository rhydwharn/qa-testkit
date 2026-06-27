import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { z } from "zod";
import crypto from "crypto";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const myMembership = await prisma.tenantMember.findUnique({
    where: { tenantId_userId: { tenantId: id, userId: caller.userId } },
  });
  if (!myMembership) return err("Forbidden", 403);

  const members = await prisma.tenantMember.findMany({
    where: { tenantId: id },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { joinedAt: "asc" },
  });

  return ok(members.map((m) => ({
    id: m.id,
    role: m.role,
    joinedAt: m.joinedAt,
    user: m.user,
  })));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const myMembership = await prisma.tenantMember.findUnique({
    where: { tenantId_userId: { tenantId: id, userId: caller.userId } },
  });
  if (!myMembership || !["OWNER", "ADMIN"].includes(myMembership.role)) return err("Forbidden", 403);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0]?.message ?? "Validation failed");

  const { email, role } = parsed.data;

  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { name: true } });
  if (!tenant) return err("Workspace not found", 404);

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.tenantInvite.create({
    data: { tenantId: id, email, role, token, expiresAt },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const inviteUrl = `${baseUrl}/invite/${token}`;

  return ok({ inviteUrl }, 201);
}
