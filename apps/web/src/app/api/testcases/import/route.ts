import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyProjectAccess, ok, err } from "@/lib/api-helpers";

interface ImportCase {
  summary: string;
  description?: string;
  precondition?: string;
  status?: string;
  priority?: string;
  labels?: string[];
  jiraRequirementKeys?: string[];
  folder?: string;
  key?: string;
  steps?: Array<{ stepDetails: string; expectedResult?: string; testData?: string }>;
}

interface ImportResult {
  id: string;
  key: string;
  summary: string;
  versionNo?: number;
}

export async function POST(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const {
    projectId,
    cases,
    folderId,
    duplicateHandling = "skip",
    missingFieldsHandling = "ignore",
  } = body as {
    projectId: string;
    cases: ImportCase[];
    folderId?: string;
    duplicateHandling?: "skip" | "new_version";
    missingFieldsHandling?: "ignore" | "create";
  };

  if (!projectId) return err("projectId is required");
  if (!Array.isArray(cases) || cases.length === 0) return err("cases array is required");
  if (cases.length > 500) return err("Max 500 test cases per import");

  try {
  // Verify access to the project
  const access = await verifyProjectAccess(caller.userId, projectId, caller.tenantId);
  if (!access) return err("Not found", 404);

  // Validate folderId
  if (folderId) {
    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder) return err("Destination folder not found", 404);
  }

  // Resolve project key prefix
  const importProject = await prisma.project.findUnique({ where: { id: projectId }, select: { key: true } });
  const tcPrefix = importProject?.key ?? "TC";
  const tcKeyPattern = `${tcPrefix}-TC-`;

  // Use the highest existing key number so re-imports never collide with existing keys
  const existingKeys = await prisma.testCase.findMany({
    where: { projectId },
    select: { key: true },
  });
  const maxKey = existingKeys.reduce((max, tc) => {
    const n = parseInt(tc.key.replace(tcKeyPattern, ""), 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 0);

  // Cache existing labels and priorities
  const existingLabels = await prisma.label.findMany({ where: { projectId } });
  const labelMap = new Map(existingLabels.map((l) => [l.name.toLowerCase(), l.id]));

  const existingPriorities = await prisma.priority.findMany({ where: { projectId } });
  const priorityMap = new Map(existingPriorities.map((p) => [p.name.toLowerCase(), p.id]));

  // Folder resolution cache: key = `${parentId ?? "root"}::${name.toLowerCase()}`
  const existingFolders = await prisma.folder.findMany({
    where: { projectId, type: "CASE" },
    select: { id: true, name: true, parentId: true },
  });
  const folderCache = new Map<string, string>(
    existingFolders.map((f) => [`${f.parentId ?? "root"}::${f.name.toLowerCase()}`, f.id])
  );

  // Walks/creates a slash-separated folder path rooted at rootFolderId.
  // Returns rootFolderId unchanged when folderPath is empty.
  const resolveFolder = async (folderPath: string | undefined, rootFolderId: string | undefined): Promise<string | undefined> => {
    const trimmed = folderPath?.trim();
    if (!trimmed) return rootFolderId;
    const segments = trimmed.split("/").map((s) => s.trim()).filter(Boolean);
    if (segments.length === 0) return rootFolderId;
    let currentParentId: string | undefined = rootFolderId;
    for (const segment of segments) {
      const cacheKey = `${currentParentId ?? "root"}::${segment.toLowerCase()}`;
      const cached = folderCache.get(cacheKey);
      if (cached !== undefined) {
        currentParentId = cached;
      } else {
        const created = await prisma.folder.create({
          data: { projectId, name: segment, parentId: currentParentId ?? null, type: "CASE" },
        });
        folderCache.set(cacheKey, created.id);
        currentParentId = created.id;
      }
    }
    return currentParentId;
  };

  const results = { imported: 0, skipped: 0, cases: [] as ImportResult[] };
  let counter = maxKey;

  for (const c of cases) {
    if (!c.summary?.trim()) { results.skipped++; continue; }

    // Duplicate check: use key if provided, otherwise use summary
    let existingTestCase = null;
    if (c.key?.trim()) {
      existingTestCase = await prisma.testCase.findFirst({
        where: { projectId, key: c.key.trim() },
        include: { versions: { orderBy: { versionNo: "desc" }, take: 1 } },
      });
    } else {
      existingTestCase = await prisma.testCase.findFirst({
        where: { projectId, summary: { equals: c.summary.trim(), mode: "insensitive" } },
        include: { versions: { orderBy: { versionNo: "desc" }, take: 1 } },
      });
    }

    if (existingTestCase && duplicateHandling === "skip") {
      results.skipped++;
      continue;
    }

    if (existingTestCase && duplicateHandling === "new_version") {
      // Update the test case's summary and description with new values
      const descParts = [c.description?.trim(), c.precondition?.trim() ? `Precondition:\n${c.precondition.trim()}` : ""].filter(Boolean);

      await prisma.testCase.update({
        where: { id: existingTestCase.id },
        data: {
          summary: c.summary.trim(),
          description: descParts.length > 0 ? descParts.join("\n\n") : undefined,
          jiraRequirementKeys: c.jiraRequirementKeys ?? [],
        },
      });

      // Create a new version for the existing test case
      const latestVersion = existingTestCase.versions[0];
      const nextVersionNo = (latestVersion?.versionNo ?? 0) + 1;

      // Mark previous latest as not latest
      if (latestVersion) {
        await prisma.testCaseVersion.update({
          where: { id: latestVersion.id },
          data: { isLatest: false },
        });
      }

      // Create new version with updated steps
      const newVersion = await prisma.testCaseVersion.create({
        data: {
          testCaseId: existingTestCase.id,
          versionNo: nextVersionNo,
          isLatest: true,
          steps: {
            create: (c.steps ?? []).map((s, i) => ({
              order: i + 1,
              stepDetails: s.stepDetails,
              expectedResult: s.expectedResult ?? "",
              testData: s.testData ?? "",
            })),
          },
        },
        include: { steps: { orderBy: { order: "asc" } } },
      });

      results.imported++;
      results.cases.push({
        id: existingTestCase.id,
        key: existingTestCase.key,
        summary: c.summary.trim(),
        versionNo: newVersion.versionNo,
      });
      continue;
    }

    // Resolve labels
    const labelIds: string[] = [];
    for (const labelName of c.labels ?? []) {
      const key = labelName.trim().toLowerCase();
      if (labelMap.has(key)) {
        labelIds.push(labelMap.get(key)!);
      } else if (missingFieldsHandling === "create" && key) {
        const created = await prisma.label.create({
          data: { projectId, name: labelName.trim(), color: "#6b7280" },
        });
        labelMap.set(key, created.id);
        labelIds.push(created.id);
      }
    }

    // Resolve priority
    let priorityId: string | undefined;
    if (c.priority?.trim()) {
      const pKey = c.priority.trim().toLowerCase();
      if (priorityMap.has(pKey)) {
        priorityId = priorityMap.get(pKey);
      } else if (missingFieldsHandling === "create") {
        const created = await prisma.priority.create({
          data: {
            projectId,
            name: c.priority.trim(),
            color: "#6b7280",
            level: existingPriorities.length + 1,
          },
        });
        priorityMap.set(pKey, created.id);
        priorityId = created.id;
      }
    }

    const validStatuses = ["DRAFT", "READY", "DEPRECATED"];
    const status = c.status && validStatuses.includes(c.status.toUpperCase())
      ? (c.status.toUpperCase() as "DRAFT" | "READY" | "DEPRECATED")
      : "DRAFT";

    const descParts = [c.description?.trim(), c.precondition?.trim() ? `Precondition:\n${c.precondition.trim()}` : ""].filter(Boolean);

    // Pass folderId explicitly — avoids any closure/scoping ambiguity
    const resolvedFolderId = await resolveFolder(c.folder, folderId);

    counter++;
    const created = await prisma.testCase.create({
      data: {
        key: `${tcKeyPattern}${counter}`,
        summary: c.summary.trim(),
        description: descParts.length > 0 ? descParts.join("\n\n") : undefined,
        projectId,
        folderId: resolvedFolderId || undefined,
        status,
        priorityId,
        jiraRequirementKeys: c.jiraRequirementKeys ?? [],
        versions: {
          create: {
            versionNo: 1,
            isLatest: true,
            steps: {
              create: (c.steps ?? []).map((s, i) => ({
                order: i + 1,
                stepDetails: s.stepDetails,
                expectedResult: s.expectedResult ?? "",
                testData: s.testData ?? "",
              })),
            },
          },
        },
        labels: labelIds.length > 0
          ? { create: labelIds.map((id) => ({ labelId: id })) }
          : undefined,
      },
      select: { id: true, key: true, summary: true },
    });

    results.imported++;
    results.cases.push({
      id: created.id,
      key: created.key,
      summary: created.summary,
      versionNo: 1,
    });
  }

  return ok(results, 201);
  } catch (e) {
    console.error("[import] error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error during import";
    return err(`Import failed: ${msg}`, 500);
  }
}
