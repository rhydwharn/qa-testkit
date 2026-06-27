import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyProjectAccess, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const createSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1).max(200),
  type: z.enum(["CASE", "CYCLE", "PLAN"]),
  parentId: z.string().optional(),
});

const updateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200).optional(),
  parentId: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const type = searchParams.get("type");
  if (!projectId) return err("projectId is required");

  const folders = await prisma.folder.findMany({
    where: {
      projectId,
      ...(type ? { type: type as "CASE" | "CYCLE" | "PLAN" } : {}),
    },
    orderBy: { name: "asc" },
  });

  // Build tree
  const map = new Map(folders.map((f) => [f.id, { ...f, children: [] as typeof folders }]));
  const roots: typeof folders = [];
  for (const f of map.values()) {
    if (f.parentId) {
      map.get(f.parentId)?.children.push(f);
    } else {
      roots.push(f);
    }
  }

  return ok(roots);
}

export async function PUT(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const { id, name, parentId } = parsed.data;
  const folder = await prisma.folder.findUnique({ where: { id }, select: { projectId: true } });
  if (!folder) return err("Not found", 404);
  const access = await verifyProjectAccess(caller.userId, folder.projectId, caller.tenantId);
  if (!access) return err("Not found", 404);

  const updated = await prisma.folder.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(parentId !== undefined ? { parentId } : {}),
    },
  });
  return ok(updated);
}

export async function POST(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const folder = await prisma.folder.create({ data: parsed.data });
  return ok(folder, 201);
}

export async function DELETE(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return err("id is required");

  const folder = await prisma.folder.findUnique({ where: { id }, select: { projectId: true } });
  if (!folder) return err("Not found", 404);
  const access = await verifyProjectAccess(caller.userId, folder.projectId, caller.tenantId);
  if (!access) return err("Not found", 404);

  await prisma.folder.delete({ where: { id } });
  return ok({ deleted: true });
}
