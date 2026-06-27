import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

const createSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[^<>'"`;\\]+$/, "Name contains disallowed characters"),
  slug: z.string().min(1).max(48).regex(/^[a-z0-9-]+$/).optional(),
});

export async function GET(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const memberships = await prisma.tenantMember.findMany({
    where: { userId: caller.userId },
    include: { tenant: { select: { id: true, name: true, slug: true } } },
    orderBy: { joinedAt: "asc" },
  });

  return ok(memberships.map((m) => ({
    ...m.tenant,
    role: m.role,
  })));
}

export async function POST(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0]?.message ?? "Validation failed");

  const { name } = parsed.data;
  let slug = parsed.data.slug ?? toSlug(name);

  // Ensure slug uniqueness
  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const tenant = await prisma.$transaction(async (tx) => {
    const t = await tx.tenant.create({ data: { name, slug } });
    await tx.tenantMember.create({
      data: { tenantId: t.id, userId: caller.userId, role: "OWNER" },
    });
    return t;
  });

  return ok({ id: tenant.id, name: tenant.name, slug: tenant.slug, role: "OWNER" }, 201);
}
