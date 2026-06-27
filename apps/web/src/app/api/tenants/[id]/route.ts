import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[^<>'"`;\\]+$/, "Name contains disallowed characters").optional(),
  slug: z.string().min(1).max(48).regex(/^[a-z0-9-]+$/).optional(),
  logoDisplay: z.enum(["LOGO_ONLY", "NAME_ONLY", "LOGO_AND_NAME"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const membership = await prisma.tenantMember.findUnique({
    where: { tenantId_userId: { tenantId: id, userId: caller.userId } },
  });
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) return err("Forbidden", 403);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0]?.message ?? "Validation failed");

  if (parsed.data.slug) {
    const existing = await prisma.tenant.findUnique({ where: { slug: parsed.data.slug } });
    if (existing && existing.id !== id) return err("Slug already taken", 409);
  }

  const tenant = await prisma.tenant.update({
    where: { id },
    data: parsed.data,
    select: { id: true, name: true, slug: true, logoUrl: true, logoDisplay: true },
  });

  return ok(tenant);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const membership = await prisma.tenantMember.findUnique({
    where: { tenantId_userId: { tenantId: id, userId: caller.userId } },
  });
  if (!membership || membership.role !== "OWNER") return err("Forbidden — only OWNER can delete workspace", 403);

  await prisma.tenant.delete({ where: { id } });
  return ok({ deleted: true });
}
