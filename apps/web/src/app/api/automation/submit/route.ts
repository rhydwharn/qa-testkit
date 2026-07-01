import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { enforcePermission } from "@/lib/permission-middleware";
import { z } from "zod";

const stepResultSchema = z.object({
  stepIndex: z.number().int().min(0),  // 0-based; maps to TestStep ordered by `order` asc
  status: z.enum(["pass", "fail", "skipped", "blocked"]),
  name: z.string().optional(),         // step description from automation framework
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

  // Enforce permission to submit automation results
  const permissionError = await enforcePermission(
    caller.userId,
    d.projectId,
    "PROJECT_AUTOMATION_SUBMIT"
  );
  if (permissionError) return permissionError;

  // DEBUG: Log the full payload for debugging
  console.log("[automation/submit] ===== FULL PAYLOAD RECEIVED =====");
  console.log("[automation/submit] projectId:", d.projectId);
  console.log("[automation/submit] framework:", d.framework);
  console.log("[automation/submit] cycleName:", d.cycleName);
  console.log("[automation/submit] Number of results:", d.results.length);
  d.results.forEach((result, idx) => {
    console.log(`[automation/submit] Result ${idx}:`, {
      testCaseKey: result.testCaseKey,
      title: result.title,
      status: result.status,
      error: result.error?.substring(0, 100),
      failingStepIndex: result.failingStepIndex,
      hasScreenshot: !!result.screenshot,
      stepsCount: result.steps?.length ?? 0,
      steps: result.steps?.map((s) => ({
        stepIndex: s.stepIndex,
        status: s.status,
        actualResult: s.actualResult?.substring(0, 100),
      })) ?? [],
    });
  });
  console.log("[automation/submit] ===== END PAYLOAD =====");

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
    console.log(`[automation/submit] Processing result: title="${result.title}", testCaseKey="${result.testCaseKey}", status="${result.status}"`);

    // Find test case by key or tag-based matching
    let testCase = null;
    let extractedKey: string | null = null;

    // First, try explicit testCaseKey if provided
    if (result.testCaseKey) {
      console.log(`[automation/submit] Trying explicit testCaseKey: ${result.testCaseKey}`);
      testCase = await prisma.testCase.findFirst({
        where: { projectId: d.projectId, key: result.testCaseKey },
        include: { versions: { where: { isLatest: true }, take: 1 } },
      });
      if (testCase) {
        extractedKey = result.testCaseKey;
        console.log(`[automation/submit] Found by testCaseKey: ${result.testCaseKey}, isExternal=${testCase.isExternal}`);
      } else {
        console.log(`[automation/submit] Not found by testCaseKey: ${result.testCaseKey}`);
      }
    }

    // If no match yet, try extracting key from title tags using configurable pattern
    // Pattern can be customized via TEST_CASE_TAG_PATTERN env var
    // Default: matches formats like [XAP-TC-1], [QAR-TC-1], [XP-TC-1], etc.
    let tagWasExtracted = false;
    if (!testCase && result.title) {
      const pattern = process.env.TEST_CASE_TAG_PATTERN || "\\[([A-Z0-9]+-[A-Za-z]+-\\d+)\\]";
      console.log(`[automation/submit] Trying tag extraction with pattern: ${pattern}`);
      const tagMatch = result.title.match(new RegExp(pattern));
      if (tagMatch && tagMatch[1]) {
        tagWasExtracted = true;
        extractedKey = tagMatch[1];
        console.log(`[automation/submit] Extracted tag: ${extractedKey}`);
        testCase = await prisma.testCase.findFirst({
          where: { projectId: d.projectId, key: extractedKey },
          include: { versions: { where: { isLatest: true }, take: 1 } },
        });
        if (testCase) {
          console.log(`[automation/submit] Found by extracted tag: ${extractedKey}, isExternal=${testCase.isExternal}`);
        } else {
          console.log(`[automation/submit] Not found by extracted tag: ${extractedKey}, will create external`);
        }
        // If tag was extracted but no exact match found, DON'T fall back to fuzzy match
        // Mark for external creation with the extracted key
      } else {
        console.log(`[automation/submit] No tag extracted from title: ${result.title}`);
      }
    }

    // Fallback to fuzzy title match ONLY if no tag was extracted
    if (!testCase && result.title && !tagWasExtracted) {
      // Remove tags from title for cleaner fuzzy matching
      const cleanTitle = result.title.replace(/\s*\[[^\]]+\]\s*/g, "").trim();
      console.log(`[automation/submit] Trying fuzzy match with: ${cleanTitle}`);
      testCase = await prisma.testCase.findFirst({
        where: {
          projectId: d.projectId,
          summary: { contains: cleanTitle, mode: "insensitive" },
        },
        include: { versions: { where: { isLatest: true }, take: 1 } },
      });
      if (testCase) {
        console.log(`[automation/submit] Found by fuzzy match: ${testCase.key}, isExternal=${testCase.isExternal}`);
      } else {
        console.log(`[automation/submit] Not found by fuzzy match`);
      }
    }

    if (!testCase) {
      // Test case not found - create execution record but with null testCaseId (external/unmatched)
      const externalKey = extractedKey ?? result.testCaseKey ?? `UNKNOWN-${d.results.indexOf(result) + 1}`;
      console.log(`[automation/submit] Test case NOT found: ${externalKey}, creating external execution (no test case DB record)`);
      unmatched.push(externalKey);

      // Create execution for external/unmatched result
      const execution = await prisma.testCaseExecution.create({
        data: {
          testCycleId: cycleId,
          testCaseId: null,
          testCaseVersionId: null,
          externalTestKey: externalKey,
          status: STATUS_MAP[result.status] ?? "NOT_RUN",
          duration: result.duration,
          actualResult: result.error ?? null,
          executedAt: new Date(),
          executionMethod: frameworkUpper,
        },
      });

      console.log(`[automation/submit] External execution created: ${execution.id} for key ${externalKey}`);

      // ── Handle screenshot attachment for external execution ───────────────────────────
      if (result.screenshot) {
        try {
          let base64Data = result.screenshot;
          if (base64Data.startsWith("data:")) {
            base64Data = base64Data.split(",")[1];
          }
          const fileSizeEstimate = Math.ceil((base64Data.length * 3) / 4);

          await prisma.attachment.create({
            data: {
              fileName: `screenshot-${execution.id}.png`,
              fileSize: fileSizeEstimate,
              mimeType: "image/png",
              storageKey: base64Data,
              executionId: execution.id,
            },
          });
          console.log(`[automation/submit] Screenshot attachment created for external execution ${execution.id}`);
        } catch (e) {
          console.warn(`[automation/submit] Screenshot handling error for external execution:`, e);
        }
      }

      // ── Process steps for external execution ───────────────────────────────────────────────────
      // For external test cases with steps, create temporary test case/version to store step results
      if (result.steps && result.steps.length > 0) {
        console.log(`[automation/submit] External case ${externalKey}: processing ${result.steps.length} steps`);

        // Upsert a temporary external TestCase to hold the step records
        const tempCaseKey = `EXT-${externalKey.replace(/[^A-Z0-9]/g, '')}`;
        const tempCase = await prisma.testCase.upsert({
          where: { projectId_key: { projectId: d.projectId, key: tempCaseKey } },
          create: {
            key: tempCaseKey,
            summary: `External: ${externalKey}`,
            projectId: d.projectId,
            isExternal: true,
          },
          update: {},
        });

        // Upsert a temporary version for this external case
        const tempVersion = await prisma.testCaseVersion.upsert({
          where: { testCaseId_versionNo: { testCaseId: tempCase.id, versionNo: 1 } },
          create: {
            testCaseId: tempCase.id,
            versionNo: 1,
            isLatest: true,
          },
          update: { isLatest: true },
        });

        // Create test steps for each step in the result
        const tempSteps = [];
        for (let i = 0; i < result.steps.length; i++) {
          const step = result.steps[i];
          const tempStep = await prisma.testStep.create({
            data: {
              versionId: tempVersion.id,
              order: i + 1,
              stepDetails: step.name || `Step ${i + 1}`,
              expectedResult: '',
            },
          });
          tempSteps.push(tempStep);
        }

        // Process the step results
        for (const stepResult of result.steps) {
          const tempStep = tempSteps[stepResult.stepIndex];
          if (!tempStep) continue;
          console.log(`[automation/submit] External step ${stepResult.stepIndex}: status=${stepResult.status}`);
          await upsertStepExecution(
            execution.id,
            tempStep.id,
            STATUS_MAP[stepResult.status] ?? "NOT_RUN",
            stepResult.actualResult ?? null,
            stepResult.comment ?? null,
          );
        }
      }

      continue;
    }

    // Test case found - continue with normal execution
    console.log(`[automation/submit] Test case found: ${testCase.key}, processing execution`);
    matched.push(testCase.key);
    const latestVersion = testCase.versions[0];
    if (!latestVersion) {
      console.log(`[automation/submit] No latest version found, skipping this test case`);
      continue;
    }

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

    console.log(`[automation/submit] Processing test case: ${testCase.key}, testSteps.length=${testSteps.length}, result.steps?.length=${result.steps?.length}, failingStepIndex=${result.failingStepIndex}`);

    // Auto-create test steps if they don't exist but step data is provided
    if (testSteps.length === 0 && result.steps?.length) {
      console.log(`[automation/submit] Auto-creating ${result.steps.length} test steps for ${testCase.key}`);
      for (let i = 0; i < result.steps.length; i++) {
        const step = result.steps[i];
        const newStep = await prisma.testStep.create({
          data: {
            versionId: latestVersion.id,
            order: i + 1,
            stepDetails: step.name || `Step ${i + 1}`,
            expectedResult: '',
          },
        });
        testSteps.push(newStep);
      }
      console.log(`[automation/submit] Created ${testSteps.length} test steps`);
    }

    if (testSteps.length > 0) {
      if (result.steps?.length) {
        // BDD reporters send explicit step results
        console.log(`[automation/submit] Using BDD path: processing ${result.steps.length} explicit step results`);
        for (const stepResult of result.steps) {
          const testStep = testSteps[stepResult.stepIndex];
          if (!testStep) continue;
          console.log(`[automation/submit] Step ${stepResult.stepIndex}: status=${stepResult.status}, actualResult=${stepResult.actualResult?.substring(0, 50)}`);
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
        console.log(`[automation/submit] Using Mocha with failingStepIndex=${result.failingStepIndex}: marking steps before as PASS, step ${result.failingStepIndex} as ${execStatus}, steps after as NOT_RUN`);
        for (let i = 0; i < testSteps.length; i++) {
          let stepStatus: "NOT_RUN" | "IN_PROGRESS" | "PASS" | "FAIL" | "BLOCKED" | "SKIPPED" = "NOT_RUN";
          let stepError: string | null = null;

          if (i < result.failingStepIndex) {
            // Steps before failure: PASS
            stepStatus = "PASS";
            console.log(`[automation/submit] Step ${i}: PASS (before failure)`);
          } else if (i === result.failingStepIndex) {
            // Step that failed
            stepStatus = execStatus;
            stepError = result.error ?? null;
            console.log(`[automation/submit] Step ${i}: ${stepStatus} (failing step), error="${stepError?.substring(0, 50)}"`);
          } else {
            // Steps after failure: NOT_RUN with message explaining why
            stepStatus = "NOT_RUN";
            stepError = `Test execution stopped - Step ${result.failingStepIndex + 1} failed`;
            console.log(`[automation/submit] Step ${i}: NOT_RUN (after failure), message="${stepError}"`);
          }

          await upsertStepExecution(execution.id, testSteps[i].id, stepStatus, stepError, null);
        }
      } else {
        // Mocha without explicit step index: assume all pass if test passes, all fail if test fails
        // This is the fallback when failingStepIndex is not provided
        console.log(`[automation/submit] Using fallback path (no failingStepIndex): all steps marked as ${execStatus}`);
        for (let i = 0; i < testSteps.length; i++) {
          const stepStatus = execStatus === "PASS" ? "PASS" : "FAIL";
          const stepError = execStatus !== "PASS" ? (result.error ?? null) : null;
          console.log(`[automation/submit] Step ${i}: ${stepStatus}, error="${stepError?.substring(0, 50)}"`);
          await upsertStepExecution(execution.id, testSteps[i].id, stepStatus, stepError, null);
        }
      }
    }

    // ── Handle screenshot attachment ───────────────────────────────────────────
    if (result.screenshot && execution) {
      try {
        // Store screenshot as base64 attachment
        // Format: "data:image/png;base64,<base64_data>" or direct base64
        let base64Data = result.screenshot;
        if (base64Data.startsWith("data:")) {
          // Extract base64 data from data URI
          base64Data = base64Data.split(",")[1];
        }

        // Estimate file size from base64 (roughly 4/3 of base64 string length)
        const fileSizeEstimate = Math.ceil((base64Data.length * 3) / 4);

        await prisma.attachment.create({
          data: {
            fileName: `screenshot-${execution.id}.png`,
            fileSize: fileSizeEstimate,
            mimeType: "image/png",
            storageKey: base64Data, // Store base64 data directly
            executionId: execution.id,
          },
        });
        console.log(`[automation/submit] Screenshot attachment created for execution ${execution.id}`);
      } catch (e) {
        console.warn(`[automation/submit] Screenshot handling error:`, e);
      }
    }

    // Track as matched or unmatched based on whether it's an external test case
  }

  console.log(`[automation/submit] ===== PROCESSING COMPLETE =====`);
  console.log(`[automation/submit] Matched array final: [${matched.join(", ")}]`);
  console.log(`[automation/submit] Unmatched array final: [${unmatched.join(", ")}]`);
  console.log(`[automation/submit] Total: ${d.results.length}, Passed: ${passed}, Failed: ${failed}, Skipped: ${skipped}`);

  // Record the automation run
  // Store unmatched results in rawReport for later retrieval on cycles page
  const reportData = {
    ...d,
    unmatchedKeys: unmatched,
    matchedKeys: matched,
  };

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
      rawReport: reportData as object,
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
