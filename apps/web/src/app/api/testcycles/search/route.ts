import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { enforcePermission } from "@/lib/permission-middleware";
import { z } from "zod";

const schema = z.object({
  projectId: z.string(),
  query: z.string().optional(),
  status: z.array(z.enum(["DRAFT", "ACTIVE", "CLOSED"])).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

// GET handler for simple search (used by cycle linking)
export async function GET(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const query = searchParams.get("q")?.toLowerCase() ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);

  if (!projectId) return err("projectId is required");

  const permissionError = await enforcePermission(
    caller.userId,
    projectId,
    "TEST_CYCLE_READ"
  );
  if (permissionError) return permissionError;

  if (!query.trim()) return ok([]);

  try {
    // Search for cycles by ID, key, or summary
    const cycles = await prisma.testCycle.findMany({
      where: {
        projectId,
        OR: [
          { id: { contains: query } },
          { key: { contains: query, mode: "insensitive" } },
          { summary: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        key: true,
        summary: true,
        status: true,
      },
      take: limit,
      orderBy: [
        { key: "asc" },
      ],
    });

    return ok(cycles);
  } catch (error) {
    console.error("Search cycles error:", error);
    return err("Failed to search cycles", 500);
  }
}

export async function POST(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const { projectId, query, status, startDate, endDate, page, pageSize } = parsed.data;

  const permissionError = await enforcePermission(
    caller.userId,
    projectId,
    "TEST_CYCLE_READ"
  );
  if (permissionError) return permissionError;

  const where: Record<string, unknown> = { projectId };
  if (query) where.summary = { contains: query, mode: "insensitive" };
  if (status?.length) where.status = { in: status };
  if (startDate) where.startDate = { gte: new Date(startDate) };
  if (endDate) where.endDate = { lte: new Date(endDate) };

  const [total, items] = await Promise.all([
    prisma.testCycle.count({ where }),
    prisma.testCycle.findMany({
      where,
      include: {
        priority: true,
        environment: true,
        build: true,
        _count: { select: { executions: true, cases: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return ok({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}
