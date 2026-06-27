import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, err } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const folderId = searchParams.get("folderId");

  if (!projectId) return err("projectId is required");

  const cases = await prisma.testCase.findMany({
    where: {
      projectId,
      ...(folderId ? { folderId } : {}),
      status: { not: "DEPRECATED" },
    },
    include: {
      priority: true,
      folder: true,
      labels: { include: { label: { select: { name: true } } } },
      versions: {
        where: { isLatest: true },
        include: { steps: { orderBy: { order: "asc" } } },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Multi-row format:
  //   Row type "Test Case" — one row per test case with TC metadata
  //   Row type "Test Step"  — one row per step, TC key repeated for reference
  //
  // Columns:
  //   Row Type | Key | Summary | Status | Priority | Folder | Labels | Description |
  //   JIRA Requirement Keys | Step # | Step Summary | Test Data | Expected Result
  const header = [
    "Row Type",
    "Key",
    "Summary",
    "Status",
    "Priority",
    "Folder",
    "Labels",
    "Description",
    "JIRA Requirement Keys",
    "Step #",
    "Step Summary",
    "Test Data",
    "Expected Result",
  ];

  const rows: string[][] = [header];

  for (const tc of cases) {
    const latestVersion = tc.versions[0];
    const steps = latestVersion?.steps ?? [];
    const labels = tc.labels.map((l) => l.label.name).join("; ");
    const jiraKeys = tc.jiraRequirementKeys.join("; ");

    // Test case header row — first step (if any) inline
    rows.push([
      "Test Case",
      tc.key,
      tc.summary,
      tc.status,
      tc.priority?.name ?? "",
      tc.folder?.name ?? "",
      labels,
      tc.description ?? "",
      jiraKeys,
      steps.length > 0 ? String(steps[0].order) : "",
      steps[0]?.stepDetails ?? "",
      steps[0]?.testData ?? "",
      steps[0]?.expectedResult ?? "",
    ]);

    // Additional step rows (2nd step onward)
    for (let i = 1; i < steps.length; i++) {
      const s = steps[i];
      rows.push([
        "Test Step",
        tc.key,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        String(s.order),
        s.stepDetails ?? "",
        s.testData ?? "",
        s.expectedResult ?? "",
      ]);
    }
  }

  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="test-cases-export.csv"`,
    },
  });
}

function csvCell(val: string): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
