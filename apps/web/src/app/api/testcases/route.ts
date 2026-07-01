import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { enforcePermission } from "@/lib/permission-middleware";
import { z } from "zod";

const createSchema = z.object({
  projectId: z.string(),
  summary: z.string().min(1).max(500),
  description: z.string().optional(),
  status: z.enum(["DRAFT", "READY", "DEPRECATED"]).optional(),
  priorityId: z.string().optional(),
  folderId: z.string().optional(),
  jiraRequirementKeys: z.array(z.string()).optional(),
  steps: z
    .array(
      z.object({
        stepDetails: z.string().min(1),
        expectedResult: z.string().optional(),
        testData: z.string().optional(),
      })
    )
    .optional(),
});

const searchSchema = z.object({
  projectId: z.string(),
  query: z.string().optional(),
  status: z.array(z.string()).optional(),
  folderId: z.string().optional(),
  priorityId: z.string().optional(),
  labelIds: z.array(z.string()).optional(),
  page: z.number().int().min(0).optional().default(0),
  pageSize: z.number().int().min(1).max(100).optional().default(25),
  sortField: z.enum(["createdAt", "updatedAt", "summary", "key", "status"]).optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export async function GET(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) return err("projectId is required");

  const permissionError = await enforcePermission(
    caller.userId,
    projectId,
    "TEST_CASE_READ"
  );
  if (permissionError) return permissionError;

  // By default hide archived (DEPRECATED) test cases; pass ?includeArchived=true to include them
  const includeArchived = searchParams.get("includeArchived") === "true";

  const cases = await prisma.testCase.findMany({
    where: {
      projectId,
      ...(includeArchived ? {} : { status: { not: "DEPRECATED" } }),
    },
    include: {
      priority: true,
      folder: true,
      labels: { include: { label: true } },
      versions: { where: { isLatest: true }, take: 1, include: { steps: { orderBy: { order: "asc" } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return ok(cases);
}

export async function POST(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  // Support both create and search via ?action=search
  const action = new URL(req.url).searchParams.get("action");
  if (action === "search") {
    const parsed = searchSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.message);
    const d = parsed.data;

    const where: Record<string, unknown> = { projectId: d.projectId };
    if (d.query) where.summary = { contains: d.query, mode: "insensitive" };
    if (d.status?.length) where.status = { in: d.status };
    if (d.folderId) where.folderId = d.folderId;
    if (d.priorityId) where.priorityId = d.priorityId;

    const [items, total] = await Promise.all([
      prisma.testCase.findMany({
        where,
        include: {
          priority: true,
          folder: { select: { id: true, name: true } },
          labels: { include: { label: { select: { id: true, name: true, color: true } } } },
          _count: { select: { versions: true } },
        },
        skip: d.page * d.pageSize,
        take: d.pageSize,
        orderBy: { [d.sortField]: d.sortOrder },
      }),
      prisma.testCase.count({ where }),
    ]);

    return ok({ items, total, page: d.page, pageSize: d.pageSize });
  }

  // Create
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);
  const d = parsed.data;

  const permissionError = await enforcePermission(
    caller.userId,
    d.projectId,
    "TEST_CASE_CREATE"
  );
  if (permissionError) return permissionError;

  const [project, count] = await Promise.all([
    prisma.project.findUnique({ where: { id: d.projectId }, select: { key: true } }),
    prisma.testCase.count({ where: { projectId: d.projectId } }),
  ]);
  const prefix = project?.key ?? "TC";
  const key = `${prefix}-TC-${count + 1}`;

  const testCase = await prisma.testCase.create({
    data: {
      key,
      summary: d.summary,
      description: d.description,
      status: d.status ?? "DRAFT",
      priorityId: d.priorityId,
      folderId: d.folderId,
      projectId: d.projectId,
      jiraRequirementKeys: d.jiraRequirementKeys ?? [],
      versions: {
        create: {
          versionNo: 1,
          isLatest: true,
          steps: d.steps?.length
            ? {
                create: d.steps.map((s, i) => ({
                  order: i + 1,
                  stepDetails: s.stepDetails,
                  expectedResult: s.expectedResult,
                  testData: s.testData,
                })),
              }
            : undefined,
        },
      },
    },
    include: {
      versions: { include: { steps: { orderBy: { order: "asc" } } } },
      priority: true,
      folder: true,
    },
  });

  return ok(testCase, 201);
}
