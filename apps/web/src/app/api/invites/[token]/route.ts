import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { hash } from "bcryptjs";
import { z } from "zod";

const acceptSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  password: z.string().min(8).max(128).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invite = await prisma.tenantInvite.findUnique({
    where: { token },
    include: { tenant: { select: { name: true } } },
  });

  if (!invite) return err("Invite not found", 404);
  if (invite.usedAt) return err("Invite already used", 410);

  const expired = invite.expiresAt < new Date();
  const existingUser = await prisma.user.findUnique({ where: { email: invite.email }, select: { id: true } });

  return ok({
    tenantName: invite.tenant.name,
    email: invite.email,
    role: invite.role,
    expired,
    hasAccount: !!existingUser,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invite = await prisma.tenantInvite.findUnique({
    where: { token },
    include: { tenant: { select: { id: true, name: true } } },
  });

  if (!invite) return err("Invite not found", 404);
  if (invite.usedAt) return err("Invite already used", 410);
  if (invite.expiresAt < new Date()) return err("Invite has expired", 410);

  const body = await req.json().catch(() => null);
  const parsed = acceptSchema.safeParse(body ?? {});
  if (!parsed.success) return err(parsed.error.errors[0]?.message ?? "Validation failed");

  let user = await prisma.user.findUnique({ where: { email: invite.email } });

  if (!user) {
    // New user — name + password required
    if (!parsed.data.name || !parsed.data.password) {
      return err("name and password are required for new accounts");
    }
    const passwordHash = await hash(parsed.data.password, 12);
    user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: invite.email,
        password: passwordHash,
        role: "TESTER",
      },
    });
  }

  // Add to tenant (upsert — idempotent)
  await prisma.tenantMember.upsert({
    where: { tenantId_userId: { tenantId: invite.tenantId, userId: user.id } },
    create: { tenantId: invite.tenantId, userId: user.id, role: invite.role },
    update: {},
  });

  await prisma.tenantInvite.update({ where: { token }, data: { usedAt: new Date() } });

  return ok({
    userId: user.id,
    email: user.email,
    tenantId: invite.tenantId,
    tenantName: invite.tenant.name,
  });
}
