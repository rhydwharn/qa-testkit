import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const stepResultSchema = z.object({
  stepIndex: z.number().int().min(0),  // 0-based; maps to TestStep ordered by `order` asc
  status: z.enum(["pass", "fail", "skipped", "blocked"]),
  actualResult: z.string().optional(),
  comment: z.string().optional(),
});

const resultSchema = z.object({
  testCaseKey: z.string().optional(),  // e.g. "TC-42"
  title: z.string().optional(),        // fallback for matching
  status: z.enum(["pass", "fail", "skipped", "blocked"]),
  duration: z.number().int().optional(),
  error: z.string().optional(),
  screenshot: z.string().optional(),   // base64 or URL
  steps: z.array(stepResultSchema).optional(),  // BDD step-level results
  failingStepIndex: z.number().int().min(0).optional(),  // 0-based index of step where failure occurred (for Mocha)
});

const submitSchema = z.object({
  projectId: z.string(),
  testCycleId: z.string().optional(),
  cycleName: z.string().optional(),    // auto-create cycle with this name
  framework: z.string().default("unknown"),
  results: z.array(resultSchema).min(1),
});

const STATUS_MAP: Record<string, "NOT_RUN" | "IN_PROGRESS" | "PASS" | "FAIL" | "BLOCKED" | "SKIPPED"> = {
  pass: "PASS",
  fail: "FAIL",
  skipped: "SKIPPED",
  blocked: "BLOCKED",
};

async function upsertStepExecution(
  executionId: string,
  testStepId: string,
  status: "NOT_RUN" | "IN_PROGRESS" | "PASS" | "FAIL" | "BLOCKED" | "SKIPPED",
  actualResult: string | null,
  comment: string | null,
) {
  const existing = await prisma.testStepExecution.findFirst({
    where: { executionId, testStepId },
  });
  if (existing) {
    await prisma.testStepExecution.update({
      where: { id: existing.id },
      data: { status, actualResult, comment },
    });
  } else {
    await prisma.testStepExecution.create({
      data: { executionId, testStepId, status, actualResult, comment },
    });
  }
}

export async function POST(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);
  const d = parsed.data;

  // Normalize framework: lowercase, hyphens → underscores (e.g. "cypress-bdd" → "cypress_bdd")
  const framework = d.framework.toLowerCase().replace(/-/g, "_");
  const frameworkUpper = framework.toUpperCase();

  let cycleId = d.testCycleId;

  // Auto-create cycle if name provided
  if (!cycleId && d.cycleName) {
    const [automProject, count] = await Promise.all([
      prisma.project.findUnique({ where: { id: d.projectId }, select: { key: true } }),
      prisma.testCycle.count({ where: { projectId: d.projectId } }),
    ]);
    const cyclePrefix = automProject?.key ?? "CYC";
    const cycle = await prisma.testCycle.create({
      data: {
        key: `${cyclePrefix}-CY-${count + 1}`,
        summary: d.cycleName,
        status: "ACTIVE",
        projectId: d.projectId,
      },
    });
    cycleId = cycle.id;
  }

  if (!cycleId) return err("Provide testCycleId or cycleName");

  const matched: string[] = [];
  const unmatched: string[] = [];

  const passed = d.results.filter((r) => r.status === "pass").length;
  const failed = d.results.filter((r) => r.status === "fail").length;
  const skipped = d.results.filter((r) => r.status === "skipped").length;

  for (const result of d.results) {
    // Find test case by key or tag-based matching
    let testCase = null;
    let extractedKey: string | null = null;

    // First, try explicit testCaseKey if provided
    if (result.testCaseKey) {
      testCase = await prisma.testCase.findFirst({
        where: { projectId: d.projectId, key: result.testCaseKey },
        include: { versions: { where: { isLatest: true }, take: 1 } },
      });
      if (testCase) {
        extractedKey = result.testCaseKey;
      }
    }

    // If no match yet, try extracting key from title tags using configurable pattern
    // Pattern can be customized via TEST_CASE_TAG_PATTERN env var (e.g., "\\[([A-Z0-9]+-\\d+)\\]")
    // Default: [TC-123], [PROJ-456], etc. (brackets required)
    if (!testCase && result.title) {
      const pattern = process.env.TEST_CASE_TAG_PATTERN || "\\[([A-Z0-9]+-\\d+)\\]";
      const tagMatch = result.title.match(new RegExp(pattern));
      if (tagMatch && tagMatch[1]) {
        extractedKey = tagMatch[1];
        testCase = await prisma.testCase.findFirst({
          where: { projectId: d.projectId, key: extractedKey },
          include: { versions: { where: { isLatest: true }, take: 1 } },
        });
      }
    }

    // Fallback to fuzzy title match if tag extraction didn't work
    if (!testCase && result.title) {
      // Remove tags from title for cleaner fuzzy matching
      const cleanTitle = result.title.replace(/\s*\[[^\]]+\]\s*/g, "").trim();
      testCase = await prisma.testCase.findFirst({
        where: {
          projectId: d.projectId,
          summary: { contains: cleanTitle, mode: "insensitive" },
        },
        include: { versions: { where: { isLatest: true }, take: 1 } },
      });
    }

    if (!testCase) {
      // Test case not found, but still record the result
      // Create a placeholder test case to track unmatched tests
      const unmatchedKey = extractedKey ?? result.testCaseKey ?? `EXTERNAL-${d.results.indexOf(result) + 1}`;
      const unmatchedSummary = result.title ?? `External test: ${unmatchedKey}`;

      const newTestCase = await prisma.testCase.create({
        data: {
          projectId: d.projectId,
          key: unmatchedKey,
          summary: unmatchedSummary,
          description: "Automatically created for unmatched automation result",
          status: "READY",
        },
      });

      // Create initial version
      const version = await prisma.testCaseVersion.create({
        data: {
          testCaseId: newTestCase.id,
          versionNo: 1,
          isLatest: true,
        },
      });

      testCase = {
        ...newTestCase,
        versions: [version],
      } as any;

      unmatched.push(unmatchedKey);
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
          executionMethod: frameworkUpper,
        },
      });
    }

    const execStatus = STATUS_MAP[result.status];
    await prisma.testCaseExecution.update({
      where: { id: execution.id },
      data: {
        status: execStatus,
        duration: result.duration,
        actualResult: result.error ?? null,
        executedAt: new Date(),
        executionMethod: frameworkUpper,
      },
    });

    // ── Step-level results ───────────────────────────────────────────────────
    const testSteps = await prisma.testStep.findMany({
      where: { versionId: latestVersion.id },
      orderBy: { order: "asc" },
    });

    if (testSteps.length > 0) {
      if (result.steps?.length) {
        // BDD reporters send explicit step results
        for (const stepResult of result.steps) {
          const testStep = testSteps[stepResult.stepIndex];
          if (!testStep) continue;
          await upsertStepExecution(
            execution.id,
            testStep.id,
            STATUS_MAP[stepResult.status] ?? "NOT_RUN",
            stepResult.actualResult ?? null,
            stepResult.comment ?? null,
          );
        }
      } else if (result.failingStepIndex !== undefined) {
        // Mocha with explicit failing step index: mark steps correctly based on where it failed
        for (let i = 0; i < testSteps.length; i++) {
          let stepStatus: "NOT_RUN" | "IN_PROGRESS" | "PASS" | "FAIL" | "BLOCKED" | "SKIPPED" = "NOT_RUN";
          let stepError: string | null = null;

          if (i < result.failingStepIndex) {
            // Steps before failure: PASS
            stepStatus = "PASS";
          } else if (i === result.failingStepIndex) {
            // Step that failed
            stepStatus = execStatus;
            stepError = result.error ?? null;
          } else {
            // Steps after failure: NOT_RUN (never executed)
            stepStatus = "NOT_RUN";
          }

          await upsertStepExecution(execution.id, testSteps[i].id, stepStatus, stepError, null);
        }
      } else {
        // Mocha without explicit step index: assume all pass if test passes, all fail if test fails
        // This is the fallback when failingStepIndex is not provided
        for (let i = 0; i < testSteps.length; i++) {
          const stepStatus = execStatus === "PASS" ? "PASS" : "FAIL";
          const stepError = execStatus !== "PASS" ? (result.error ?? null) : null;
          await upsertStepExecution(execution.id, testSteps[i].id, stepStatus, stepError, null);
        }
      }
    }

    matched.push(testCase.key);
  }

  // Record the automation run
  const run = await prisma.automationRun.create({
    data: {
      projectId: d.projectId,
      testCycleId: cycleId,
      framework: framework,
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
    total: d.results.length,
    matched: matched.length,
    unmatched: unmatched.length,
    unmatchedKeys: unmatched,
    passed,
    failed,
    skipped,
  }, 201);
}
