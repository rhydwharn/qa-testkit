import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const schema = z.object({
  projectId: z.string(),
  query: z.string().optional(),
  status: z.array(z.enum(["DRAFT", "READY", "DEPRECATED"])).optional(),
  folderId: z.string().optional(),
  priorityId: z.string().optional(),
  labelIds: z.array(z.string()).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  sortField: z.enum(["createdAt", "updatedAt", "summary", "key"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export async function POST(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const { projectId, query, status, folderId, priorityId, labelIds, page, pageSize, sortField, sortOrder } = parsed.data;

  const where: Record<string, unknown> = { projectId };
  if (query) where.summary = { contains: query, mode: "insensitive" };
  if (status?.length) where.status = { in: status };
  if (folderId) where.folderId = folderId;
  if (priorityId) where.priorityId = priorityId;
  if (labelIds?.length) where.labels = { some: { labelId: { in: labelIds } } };

  const [total, items] = await Promise.all([
    prisma.testCase.count({ where }),
    prisma.testCase.findMany({
      where,
      include: {
        priority: true,
        folder: true,
        versions: { where: { isLatest: true }, include: { steps: { orderBy: { order: "asc" } } } },
      },
      orderBy: { [sortField]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return ok({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}
