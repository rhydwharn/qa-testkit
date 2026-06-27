import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return err("slug is required");
  if (!/^[a-z0-9-]{1,48}$/.test(slug)) return ok({ available: false });

  const existing = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  return ok({ available: !existing });
}
