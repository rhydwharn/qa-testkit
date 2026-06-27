import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { subDays, startOfDay } from "date-fns";
import { CaseStatus, Prisma } from "@prisma/client";

// ─── Validation ───────────────────────────────────────────────────────────

/**
 * Validate report parameters from query string
 * Throws error with message if validation fails
 */
function validateReportParameters(searchParams: URLSearchParams): void {
  // Validate date range if provided
  const fromDateParam = searchParams.get("fromDate");
  const toDateParam = searchParams.get("toDate");

  if (fromDateParam || toDateParam) {
    if (fromDateParam) {
      const from = new Date(fromDateParam);
      if (isNaN(from.getTime())) {
        throw new Error("Invalid fromDate format. Use YYYY-MM-DD");
      }
    }

    if (toDateParam) {
      const to = new Date(toDateParam);
      if (isNaN(to.getTime())) {
        throw new Error("Invalid toDate format. Use YYYY-MM-DD");
      }
    }

    if (fromDateParam && toDateParam) {
      const from = new Date(fromDateParam);
      const to = new Date(toDateParam);
      if (from > to) {
        throw new Error("fromDate must be before toDate");
      }
    }
  }

  // Validate granularity
  const granularity = searchParams.get("granularity");
  if (granularity && !["daily", "weekly", "monthly", "yearly"].includes(granularity)) {
    throw new Error("Invalid granularity. Must be: daily, weekly, monthly, or yearly");
  }

  // Validate isArchived
  const isArchivedParam = searchParams.get("isArchived");
  if (isArchivedParam && !["true", "false"].includes(isArchivedParam)) {
    throw new Error("Invalid isArchived value. Must be true or false");
  }

  // Validate latestVersionOnly
  const latestVersionOnlyParam = searchParams.get("latestVersionOnly");
  if (latestVersionOnlyParam && !["true", "false"].includes(latestVersionOnlyParam)) {
    throw new Error("Invalid latestVersionOnly value. Must be true or false");
  }
}

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "summary";

  // ─── Parameter Validation ─────────────────────────────────────────────
  try {
    validateReportParameters(searchParams);
  } catch (error: any) {
    return err(error.message, 400);
  }

  // ── filter-options ────────────────────────────────────────────────────────
  if (type === "filter-options") {
    const [priorities, components, labels] = await Promise.all([
      prisma.priority.findMany({
        where: { projectId: params.projectId },
        select: { id: true, name: true, color: true },
        orderBy: { level: "asc" },
      }),
      prisma.component.findMany({
        where: { projectId: params.projectId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.label.findMany({
        where: { projectId: params.projectId },
        select: { id: true, name: true, color: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const statuses: { value: string; label: string }[] = [
      { value: "DRAFT", label: "Draft" },
      { value: "READY", label: "Ready" },
      { value: "DEPRECATED", label: "Deprecated" },
    ];

    return ok({ statuses, priorities, components, labels });
  }

  if (type === "summary") {
    const [totalCases, totalCycles, totalPlans, execStats, recentRuns] = await Promise.all([
      prisma.testCase.count({ where: { projectId: params.projectId } }),
      prisma.testCycle.count({ where: { projectId: params.projectId } }),
      prisma.testPlan.count({ where: { projectId: params.projectId } }),
      prisma.testCaseExecution.groupBy({
        by: ["status"],
        where: {
          testCycle: { projectId: params.projectId },
        },
        _count: true,
      }),
      prisma.automationRun.findMany({
        where: { projectId: params.projectId },
        orderBy: { submittedAt: "desc" },
        take: 10,
      }),
    ]);

    const statusMap: Record<string, number> = {};
    execStats.forEach((s) => { statusMap[s.status] = s._count; });
    const total = Object.values(statusMap).reduce((a, b) => a + b, 0);
    const passRate = total > 0 ? Math.round(((statusMap.PASS ?? 0) / total) * 100) : 0;

    return ok({ totalCases, totalCycles, totalPlans, executionStats: statusMap, passRate, recentRuns });
  }

  if (type === "trends") {
    // Last 30 days pass rate per day
    const days = 30;
    const since = startOfDay(subDays(new Date(), days));

    const executions = await prisma.testCaseExecution.findMany({
      where: {
        testCycle: { projectId: params.projectId },
        executedAt: { gte: since },
      },
      select: { status: true, executedAt: true },
    });

    const byDay: Record<string, { pass: number; fail: number; total: number }> = {};
    for (const exec of executions) {
      if (!exec.executedAt) continue;
      const day = exec.executedAt.toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { pass: 0, fail: 0, total: 0 };
      byDay[day].total++;
      if (exec.status === "PASS") byDay[day].pass++;
      if (exec.status === "FAIL") byDay[day].fail++;
    }

    const trend = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({
        date,
        passRate: stats.total > 0 ? Math.round((stats.pass / stats.total) * 100) : 0,
        pass: stats.pass,
        fail: stats.fail,
        total: stats.total,
      }));

    return ok(trend);
  }

  if (type === "cycles") {
    const cycles = await prisma.testCycle.findMany({
      where: { projectId: params.projectId },
      include: {
        createdBy: { select: { name: true } },
        executions: {
          include: { assignee: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const cycleData = cycles.map((c) => {
      const execMap: Record<string, number> = {};
      c.executions.forEach((e) => { execMap[e.status] = (execMap[e.status] ?? 0) + 1; });
      const total = c.executions.length;
      const pass = execMap.PASS ?? 0;
      const passRate = total > 0 ? Math.round((pass / total) * 100) : 0;
      return {
        id: c.id, key: c.key, summary: c.summary, status: c.status,
        createdBy: c.createdBy?.name ?? "Unknown",
        total, pass, fail: execMap.FAIL ?? 0, blocked: execMap.BLOCKED ?? 0,
        notRun: execMap.NOT_RUN ?? 0, passRate, createdAt: c.createdAt,
      };
    });
    return ok(cycleData);
  }

  if (type === "executors") {
    const executions = await prisma.testCaseExecution.findMany({
      where: { testCycle: { projectId: params.projectId }, assigneeId: { not: null } },
      include: { assignee: { select: { id: true, name: true, email: true } } },
    });

    const byExecutor: Record<string, { name: string; email: string; pass: number; fail: number; blocked: number; skipped: number; total: number }> = {};
    for (const e of executions) {
      if (!e.assigneeId || !e.assignee) continue;
      if (!byExecutor[e.assigneeId]) {
        byExecutor[e.assigneeId] = { name: e.assignee.name ?? "Unknown", email: e.assignee.email ?? "", pass: 0, fail: 0, blocked: 0, skipped: 0, total: 0 };
      }
      byExecutor[e.assigneeId].total++;
      if (e.status === "PASS") byExecutor[e.assigneeId].pass++;
      else if (e.status === "FAIL") byExecutor[e.assigneeId].fail++;
      else if (e.status === "BLOCKED") byExecutor[e.assigneeId].blocked++;
      else if (e.status === "SKIPPED") byExecutor[e.assigneeId].skipped++;
    }

    const methodCount: Record<string, number> = {};
    for (const e of executions) {
      const m = e.executionMethod ?? "MANUAL";
      methodCount[m] = (methodCount[m] ?? 0) + 1;
    }

    return ok({ executors: Object.values(byExecutor), methodBreakdown: methodCount });
  }

  if (type === "coverage") {
    // 1. Fetch all test cases with JIRA requirement keys
    const testCases = await prisma.testCase.findMany({
      where: { projectId: params.projectId, jiraRequirementKeys: { isEmpty: false } },
      select: { id: true, key: true, summary: true, jiraRequirementKeys: true },
    });

    if (testCases.length === 0) return ok({ requirements: [] });

    // 2. Build requirement → testCase mapping
    const reqMap = new Map<string, { key: string; summary: string }[]>();
    for (const tc of testCases) {
      for (const reqKey of tc.jiraRequirementKeys) {
        if (!reqMap.has(reqKey)) reqMap.set(reqKey, []);
        reqMap.get(reqKey)!.push({ key: tc.key, summary: tc.summary });
      }
    }

    // 3. Get latest execution per test case
    const allTcIds = testCases.map(tc => tc.id);
    const latestExecs = await prisma.testCaseExecution.findMany({
      where: { testCycle: { projectId: params.projectId }, testCaseId: { in: allTcIds } },
      distinct: ["testCaseId"],
      orderBy: { executedAt: "desc" },
      select: { testCaseId: true, status: true },
    });

    const latestByTc = new Map<string, string>();
    latestExecs.forEach(e => latestByTc.set(e.testCaseId, e.status));

    // 4. Build coverage result
    const requirements = Array.from(reqMap.entries()).map(([reqKey, cases]) => {
      let pass = 0, fail = 0, notRun = 0, blocked = 0;
      for (const tc of testCases.filter(t => t.jiraRequirementKeys.includes(reqKey))) {
        const status = latestByTc.get(tc.id);
        if (status === "PASS") pass++;
        else if (status === "FAIL") fail++;
        else if (status === "BLOCKED") blocked++;
        else notRun++;
      }
      const total = cases.length;
      const coveragePct = total > 0 ? Math.round((pass / total) * 100) : 0;
      return { key: reqKey, totalCases: total, pass, fail, blocked, notRun, coveragePct };
    });

    return ok({ requirements });
  }

  // ── tc-by-status ──────────────────────────────────────────────────────────
  if (type === "tc-by-status") {
    const where = buildTcWhere(params.projectId, searchParams);
    const tcs = await prisma.testCase.findMany({ where, select: { status: true } });
    const map = new Map<string, number>();
    for (const tc of tcs) {
      map.set(tc.status, (map.get(tc.status) ?? 0) + 1);
    }
    const LABELS: Record<string, string> = { DRAFT: "Draft", READY: "Ready", DEPRECATED: "Deprecated" };
    return ok([...map.entries()].map(([status, count]) => ({ name: LABELS[status] ?? status, count })));
  }

  // ── tc-by-priority ────────────────────────────────────────────────────────
  if (type === "tc-by-priority") {
    const where = buildTcWhere(params.projectId, searchParams);
    const tcs = await prisma.testCase.findMany({
      where,
      select: { priorityId: true, priority: { select: { name: true, color: true } } },
    });
    const map = new Map<string, { name: string; color?: string | null; count: number }>();
    for (const tc of tcs) {
      const key = tc.priorityId ?? "__none__";
      const name = tc.priority?.name ?? "(No Priority)";
      const color = tc.priority?.color;
      if (!map.has(key)) map.set(key, { name, color, count: 0 });
      map.get(key)!.count++;
    }
    return ok([...map.values()].sort((a, b) => b.count - a.count));
  }

  // ── tc-by-component ───────────────────────────────────────────────────────
  if (type === "tc-by-component") {
    const where = buildTcWhere(params.projectId, searchParams);
    const tcs = await prisma.testCase.findMany({
      where,
      select: { components: { select: { componentId: true, component: { select: { name: true } } } } },
    });
    const map = new Map<string, { name: string; count: number }>();
    let noneCount = 0;
    for (const tc of tcs) {
      if (tc.components.length === 0) {
        noneCount++;
      } else {
        for (const c of tc.components) {
          const key = c.componentId;
          const name = c.component?.name ?? "(Unknown)";
          if (!map.has(key)) map.set(key, { name, count: 0 });
          map.get(key)!.count++;
        }
      }
    }
    const data = [...map.values()].sort((a, b) => b.count - a.count);
    if (noneCount > 0) data.push({ name: "(No Component)", count: noneCount });
    return ok(data);
  }

  // ── tc-by-label ───────────────────────────────────────────────────────────
  if (type === "tc-by-label") {
    const where = buildTcWhere(params.projectId, searchParams);
    const tcs = await prisma.testCase.findMany({
      where,
      select: { labels: { select: { labelId: true, label: { select: { name: true, color: true } } } } },
    });
    const map = new Map<string, { name: string; color: string | null; count: number }>();
    let noneCount = 0;
    for (const tc of tcs) {
      if (tc.labels.length === 0) {
        noneCount++;
      } else {
        for (const l of tc.labels) {
          const key = l.labelId;
          const name = l.label?.name ?? "(Unknown)";
          const color = l.label?.color ?? null;
          if (!map.has(key)) map.set(key, { name, color, count: 0 });
          map.get(key)!.count++;
        }
      }
    }
    const data = [...map.values()].sort((a, b) => b.count - a.count);
    if (noneCount > 0) data.push({ name: "(No Label)", color: null, count: noneCount });
    return ok(data);
  }

  // ── tc-by-timeframe ───────────────────────────────────────────────────────
  if (type === "tc-by-timeframe") {
    const granularity = (searchParams.get("granularity") ?? "daily") as "daily" | "weekly" | "monthly" | "yearly";
    const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : subDays(new Date(), 30);
    const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : new Date();
    const baseWhere = buildTcWhere(params.projectId, searchParams);
    const tcs = await prisma.testCase.findMany({
      where: { ...baseWhere, createdAt: { gte: from, lte: to } },
      select: { createdAt: true },
    });
    return ok(bucketByDate(tcs.map((t) => t.createdAt), granularity));
  }

  // ── tc-manual-vs-automated ────────────────────────────────────────────────
  if (type === "tc-manual-vs-automated") {
    const where = buildTcWhere(params.projectId, searchParams);
    const allTcs = await prisma.testCase.findMany({ where, select: { id: true } });
    const automatedIds = await prisma.testCaseExecution.findMany({
      where: {
        testCycle: { projectId: params.projectId },
        testCaseId: { in: allTcs.map((t) => t.id) },
        executionMethod: { not: "MANUAL" },
      },
      distinct: ["testCaseId"],
      select: { testCaseId: true },
    });
    const automated = automatedIds.length;
    const manual = allTcs.length - automated;
    return ok([
      { name: "Manual", count: manual },
      { name: "Automated", count: automated },
    ]);
  }

  // ── tc-planned-vs-not ─────────────────────────────────────────────────────
  if (type === "tc-planned-vs-not") {
    const where = buildTcWhere(params.projectId, searchParams);
    const allTcs = await prisma.testCase.findMany({ where, select: { id: true, cycleLinks: { select: { testCaseId: true } } } });
    const total = allTcs.length;
    const planned = allTcs.filter(tc => tc.cycleLinks.length > 0).length;
    return ok([
      { name: "Planned", count: planned },
      { name: "Not Planned", count: total - planned },
    ]);
  }

  // ── exec-by-environment ───────────────────────────────────────────────────
  if (type === "exec-by-environment") {
    const cycles = await prisma.testCycle.findMany({
      where: { projectId: params.projectId },
      select: {
        environmentId: true,
        environment: { select: { name: true } },
        executions: { select: { status: true } },
      },
    });
    return ok(aggregateCyclesByDimension(cycles, (c) => c.environment?.name ?? "(No Environment)"));
  }

  // ── exec-by-build ─────────────────────────────────────────────────────────
  if (type === "exec-by-build") {
    const cycles = await prisma.testCycle.findMany({
      where: { projectId: params.projectId },
      select: {
        buildId: true,
        build: { select: { name: true } },
        executions: { select: { status: true } },
      },
    });
    return ok(aggregateCyclesByDimension(cycles, (c) => c.build?.name ?? "(No Build)"));
  }

  // ── exec-by-timeframe ─────────────────────────────────────────────────────
  if (type === "exec-by-timeframe") {
    const granularity = (searchParams.get("granularity") ?? "daily") as "daily" | "weekly" | "monthly" | "yearly";
    const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : subDays(new Date(), 30);
    const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : new Date();
    const execs = await prisma.testCaseExecution.findMany({
      where: {
        testCycle: { projectId: params.projectId },
        executedAt: { gte: from, lte: to },
      },
      select: { status: true, executedAt: true },
    });
    const buckets = new Map<string, { pass: number; fail: number; total: number }>();
    for (const e of execs) {
      if (!e.executedAt) continue;
      const key = dateKey(e.executedAt, granularity);
      if (!buckets.has(key)) buckets.set(key, { pass: 0, fail: 0, total: 0 });
      const b = buckets.get(key)!;
      b.total++;
      if (e.status === "PASS") b.pass++;
      else if (e.status === "FAIL") b.fail++;
    }
    return ok(
      [...buckets.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, s]) => ({
          date,
          pass: s.pass,
          fail: s.fail,
          total: s.total,
          passRate: s.total > 0 ? Math.round((s.pass / s.total) * 100) : 0,
        }))
    );
  }

  return err("Invalid report type");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a Prisma TestCase where clause from filter query params.
 * Supports: statuses, priorityIds, componentIds, labelIds (all comma-separated).
 */
function buildTcWhere(
  projectId: string,
  searchParams: URLSearchParams
): Prisma.TestCaseWhereInput {
  const where: Prisma.TestCaseWhereInput = { projectId };

  const statusesParam = searchParams.get("statuses");
  if (statusesParam) {
    const values = statusesParam.split(",").filter(Boolean) as CaseStatus[];
    if (values.length > 0) where.status = { in: values };
  }

  const priorityIdsParam = searchParams.get("priorityIds");
  if (priorityIdsParam) {
    const ids = priorityIdsParam.split(",").filter(Boolean);
    if (ids.length > 0) where.priorityId = { in: ids };
  }

  const componentIdsParam = searchParams.get("componentIds");
  if (componentIdsParam) {
    const ids = componentIdsParam.split(",").filter(Boolean);
    if (ids.length > 0) where.components = { some: { componentId: { in: ids } } };
  }

  const labelIdsParam = searchParams.get("labelIds");
  if (labelIdsParam) {
    const ids = labelIdsParam.split(",").filter(Boolean);
    if (ids.length > 0) where.labels = { some: { labelId: { in: ids } } };
  }

  // ─── Archive filtering ────────────────────────────────────────────────
  const isArchivedParam = searchParams.get("isArchived");
  if (isArchivedParam !== null) {
    where.isArchived = isArchivedParam === "true";

  // ─── Version filtering ───────────────────────────────────────────────
  // Note: latestVersionOnly parameter is validated but version filtering
  // requires complex Prisma queries. Currently returns all versions.
  // TODO: Implement version filtering based on TestCaseVersion relationships
  // const latestVersionOnlyParam = searchParams.get("latestVersionOnly");
  }

  return where;
}

function dateKey(d: Date, granularity: "daily" | "weekly" | "monthly" | "yearly"): string {
  const iso = d.toISOString();
  if (granularity === "yearly") return iso.slice(0, 4);           // YYYY
  if (granularity === "monthly") return iso.slice(0, 7);          // YYYY-MM
  if (granularity === "weekly") {
    const day = startOfDay(d);
    const dow = day.getDay(); // 0=Sun
    const monday = new Date(day);
    monday.setDate(day.getDate() - ((dow + 6) % 7));
    return monday.toISOString().slice(0, 10);
  }
  return iso.slice(0, 10); // YYYY-MM-DD
}

function bucketByDate(dates: Date[], granularity: "daily" | "weekly" | "monthly" | "yearly") {
  const map = new Map<string, number>();
  for (const d of dates) {
    const key = dateKey(d, granularity);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

type CycleWithExecs = {
  executions: { status: string }[];
};

function aggregateCyclesByDimension<T extends CycleWithExecs>(
  cycles: T[],
  getKey: (c: T) => string
) {
  const map = new Map<string, { pass: number; fail: number; blocked: number; notRun: number; total: number }>();
  for (const c of cycles) {
    const key = getKey(c);
    if (!map.has(key)) map.set(key, { pass: 0, fail: 0, blocked: 0, notRun: 0, total: 0 });
    const s = map.get(key)!;
    for (const e of c.executions) {
      s.total++;
      if (e.status === "PASS") s.pass++;
      else if (e.status === "FAIL") s.fail++;
      else if (e.status === "BLOCKED") s.blocked++;
      else s.notRun++;
    }
  }
  return [...map.entries()]
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([name, s]) => ({
      name,
      pass: s.pass,
      fail: s.fail,
      blocked: s.blocked,
      notRun: s.notRun,
      total: s.total,
      passRate: s.total > 0 ? Math.round((s.pass / s.total) * 100) : 0,
    }));
}
