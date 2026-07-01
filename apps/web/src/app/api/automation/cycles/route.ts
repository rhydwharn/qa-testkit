import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyProjectAccess, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const resultSchema = z.object({
  testCaseKey: z.string().optional(),  // e.g. "TC-42"
  title: z.string().optional(),        // fallback for matching
  status: z.enum(["pass", "fail", "skipped", "blocked"]),
  duration: z.number().int().optional(),
  error: z.string().optional(),
  screenshot: z.string().optional(),   // base64 or URL
});

const cyclesSchema = z.object({
  projectId: z.string(),
  summary: z.string().min(1),
  framework: z.string().default("unknown"),
  environmentId: z.string().optional(),
  buildId: z.string().optional(),
  results: z.array(resultSchema).min(1),
});

const STATUS_MAP: Record<string, "NOT_RUN" | "IN_PROGRESS" | "PASS" | "FAIL" | "BLOCKED" | "SKIPPED"> = {
  pass: "PASS",
  fail: "FAIL",
  skipped: "SKIPPED",
  blocked: "BLOCKED",
};

export async function POST(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = cyclesSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);
  const d = parsed.data;

  // Verify project access
  const access = await verifyProjectAccess(caller.userId, d.projectId, caller.tenantId);
  if (!access) return err("Forbidden", 403);

  const framework = d.framework.toLowerCase().replace(/-/g, "_");

  // Always create a new TestCycle
  const count = await prisma.testCycle.count({ where: { projectId: d.projectId } });
  const key = `CYC-${count + 1}`;
  const cycle = await prisma.testCycle.create({
    data: {
      key,
      summary: d.summary,
      projectId: d.projectId,
      status: "ACTIVE",
      createdById: caller.userId,
      ...(d.environmentId ? { environmentId: d.environmentId } : {}),
      ...(d.buildId ? { buildId: d.buildId } : {}),
    },
  });

  const cycleId = cycle.id;
  const matched: string[] = [];
  const unmatched: string[] = [];

  const passed = d.results.filter((r) => r.status === "pass").length;
  const failed = d.results.filter((r) => r.status === "fail").length;
  const skipped = d.results.filter((r) => r.status === "skipped").length;

  for (const result of d.results) {
    // Find test case by key or fuzzy title match
    let testCase = null;

    if (result.testCaseKey) {
      testCase = await prisma.testCase.findFirst({
        where: { projectId: d.projectId, key: result.testCaseKey },
        include: { versions: { where: { isLatest: true }, take: 1 } },
      });
    }

    if (!testCase && result.title) {
      testCase = await prisma.testCase.findFirst({
        where: { projectId: d.projectId, summary: { contains: result.title, mode: "insensitive" } },
        include: { versions: { where: { isLatest: true }, take: 1 } },
      });
    }

    if (!testCase) {
      unmatched.push(result.testCaseKey ?? result.title ?? "unknown");
      continue;
    }

    const latestVersion = testCase.versions[0];
    if (!latestVersion) continue;

    // Find or create execution
    let execution = await prisma.testCaseExecution.findFirst({
      where: { testCycleId: cycleId, testCaseId: testCase.id },
    });

    if (!execution) {
      await prisma.testCycleCase.upsert({
        where: { testCycleId_testCaseId: { testCycleId: cycleId, testCaseId: testCase.id } },
        create: { testCycleId: cycleId, testCaseId: testCase.id },
        update: {},
      });
      execution = await prisma.testCaseExecution.create({
        data: {
          testCycleId: cycleId,
          testCaseId: testCase.id,
          testCaseVersionId: latestVersion.id,
          status: "NOT_RUN",
        },
      });
    }

    await prisma.testCaseExecution.update({
      where: { id: execution.id },
      data: {
        status: STATUS_MAP[result.status],
        duration: result.duration,
        actualResult: result.error ?? null,
        executedAt: new Date(),
      },
    });

    matched.push(testCase.key);
  }

  // Record the automation run
  const run = await prisma.automationRun.create({
    data: {
      projectId: d.projectId,
      testCycleId: cycleId,
      framework,
      status: "done",
      totalTests: d.results.length,
      passed,
      failed,
      skipped,
      rawReport: d as object,
    },
  });

  return ok({
    runId: run.id,
    cycleId,
    cycle,
    total: d.results.length,
    matched: matched.length,
    unmatched: unmatched.length,
    unmatchedKeys: unmatched,
    passed,
    failed,
    skipped,
  }, 201);
}
