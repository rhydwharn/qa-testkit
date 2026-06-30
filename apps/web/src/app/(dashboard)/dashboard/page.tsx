"use client";

import { useState, useEffect } from "react";
import { useProject } from "@/hooks/use-project";
import { ProgressRing } from "@/components/ui/progress-ring";
import { FlaskConical, TrendingUp, Plus } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { TestIds } from "@/lib/test-ids";

interface GlobalStats {
  totalProjects: number;
  totalCases: number;
  totalCycles: number;
  passRate: number;
  totalExecutions: number;
}

interface ProjectSummary {
  totalCases: number;
  totalCycles: number;
  totalPlans: number;
  executionStats: Record<string, number>;
  passRate: number;
  recentRuns: {
    id: string;
    key?: string;
    summary?: string;
    status?: string;
    passRate?: number;
    submittedAt?: string;
  }[];
}

interface RecentCycle {
  id: string;
  key: string;
  summary: string;
  status: string;
  executionStats: Record<string, number>;
  _count: { executions: number; cases: number };
}

function StatPill({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex flex-col items-center px-6 first:pl-0 last:pr-0">
      <span className="text-2xl font-bold tracking-tight text-foreground">
        {value}
      </span>
      <span className="text-xs text-muted-foreground mt-0.5">{label}</span>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: "bg-emerald-500",
    DRAFT: "bg-slate-400",
    CLOSED: "bg-slate-300",
  };
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full shrink-0",
        colors[status] ?? "bg-slate-400"
      )}
    />
  );
}

export default function DashboardPage() {
  const { selectedProjectId, selectedProject } = useProject();
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [projectSummary, setProjectSummary] = useState<ProjectSummary | null>(
    null
  );
  const [recentCycles, setRecentCycles] = useState<RecentCycle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/global")
      .then((r) => r.json())
      .then((d) => {
        setGlobalStats(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setProjectSummary(null);
      setRecentCycles([]);
      return;
    }
    Promise.all([
      fetch(`/api/reports/${selectedProjectId}?type=summary`).then((r) =>
        r.json()
      ),
      fetch(`/api/testcycles?projectId=${selectedProjectId}`).then((r) =>
        r.json()
      ),
    ])
      .then(([summary, cycles]) => {
        setProjectSummary(summary);
        setRecentCycles(Array.isArray(cycles) ? cycles.slice(0, 8) : []);
      })
      .catch((err) => {
        console.error("Failed to fetch dashboard data:", err);
      });
  }, [selectedProjectId]);

  const pq = selectedProjectId ? `?projectId=${selectedProjectId}` : "";
  const execStats = projectSummary?.executionStats ?? {};
  const total = Object.values(execStats).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col md:flex-row flex-1 min-h-0" data-testid="dashboard-page">
      {/* Left column */}
      <div className="flex-1 min-w-0 p-6 overflow-y-auto">
        {/* Global stat pills */}
        <div className="flex items-center border border-border rounded-xl p-4 bg-card mb-6 divide-x divide-border" data-testid="dashboard-stats-container">
          <StatPill label="Projects" value={globalStats?.totalProjects ?? "—"} />
          <StatPill label="Test Cases" value={globalStats?.totalCases ?? "—"} />
          <StatPill
            label="Test Cycles"
            value={globalStats?.totalCycles ?? "—"}
          />
          <StatPill
            label="Overall Pass Rate"
            value={globalStats ? `${globalStats.passRate}%` : "—"}
          />
          <StatPill
            label="Executions"
            value={globalStats?.totalExecutions ?? "—"}
          />
        </div>

        {/* Project section */}
        {!selectedProjectId ? (
          <div className="border-2 border-dashed border-border rounded-xl p-12 text-center" data-testid="dashboard-no-project">
            <FlaskConical className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">
              No project selected
            </p>
            <p className="text-xs text-muted-foreground">
              Select a project from the sidebar to see detailed metrics.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Project stats + ring */}
            <div className="flex items-center gap-6 bg-card border border-border rounded-xl p-5" data-testid="dashboard-project-stats">
              <ProgressRing
                size={80}
                strokeWidth={10}
                pass={execStats.PASS ?? 0}
                fail={execStats.FAIL ?? 0}
                blocked={execStats.BLOCKED ?? 0}
                notRun={(execStats.NOT_RUN ?? 0) + (execStats.SKIPPED ?? 0)}
                total={total || undefined}
                showLabel
              />
              <div className="flex-1 space-y-2">
                <h2 className="font-semibold text-foreground">
                  {selectedProject?.name}
                </h2>
                <div className="flex gap-4 text-xs">
                  <span>
                    <span className="font-semibold text-emerald-600">
                      {execStats.PASS ?? 0}
                    </span>{" "}
                    <span className="text-muted-foreground">Pass</span>
                  </span>
                  <span>
                    <span className="font-semibold text-red-600">
                      {execStats.FAIL ?? 0}
                    </span>{" "}
                    <span className="text-muted-foreground">Fail</span>
                  </span>
                  <span>
                    <span className="font-semibold text-amber-600">
                      {execStats.BLOCKED ?? 0}
                    </span>{" "}
                    <span className="text-muted-foreground">Blocked</span>
                  </span>
                  <span>
                    <span className="font-semibold text-slate-500">
                      {execStats.NOT_RUN ?? 0}
                    </span>{" "}
                    <span className="text-muted-foreground">Not Run</span>
                  </span>
                </div>
                {/* Stacked bar */}
                {total > 0 && (
                  <div className="h-2 rounded-full overflow-hidden bg-muted flex">
                    <div
                      style={{
                        width: `${((execStats.PASS ?? 0) / total) * 100}%`,
                      }}
                      className="bg-emerald-500 transition-all"
                    />
                    <div
                      style={{
                        width: `${((execStats.FAIL ?? 0) / total) * 100}%`,
                      }}
                      className="bg-red-500 transition-all"
                    />
                    <div
                      style={{
                        width: `${((execStats.BLOCKED ?? 0) / total) * 100}%`,
                      }}
                      className="bg-amber-500 transition-all"
                    />
                    <div
                      style={{
                        width: `${((execStats.NOT_RUN ?? 0) / total) * 100}%`,
                      }}
                      className="bg-slate-300 dark:bg-slate-600 transition-all"
                    />
                  </div>
                )}
              </div>
              {/* Quick links */}
              <div className="flex flex-col gap-2 shrink-0">
                <Link
                  href={`/cases/new${pq}`}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                >
                  <Plus className="h-3 w-3" /> New Test Case
                </Link>
                <Link
                  href={`/cycles/new${pq}`}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                >
                  <Plus className="h-3 w-3" /> New Cycle
                </Link>
                <Link
                  href={`/reports${pq}`}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                >
                  <TrendingUp className="h-3 w-3" /> View Reports
                </Link>
              </div>
            </div>

            {/* Recent cycles */}
            <div data-testid="dashboard-recent-cycles">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              </h3>
              {recentCycles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No cycles yet.
                </p>
              ) : (
                <div className="space-y-1">
                  {recentCycles.map((c) => {
                    const cs = c.executionStats ?? {};
                    const ct = Object.values(cs).reduce((a, b) => a + b, 0);
                    const pr =
                      ct > 0 ? Math.round(((cs.PASS ?? 0) / ct) * 100) : 0;
                    return (
                      <Link
                        key={c.id}
                        href={`/cycles/${c.id}${pq}`}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-card hover:shadow-sm border border-transparent hover:border-border transition-all group"
                        data-testid={`dashboard-cycle-row-${c.id}`}
                      >
                        <StatusDot status={c.status} />
                        <span className="font-mono text-xs text-muted-foreground w-16 shrink-0">
                          {c.key}
                        </span>
                        <span className="flex-1 text-sm truncate group-hover:text-primary transition-colors">
                          {c.summary}
                        </span>
                        <ProgressRing
                          size={28}
                          strokeWidth={4}
                          pass={cs.PASS ?? 0}
                          fail={cs.FAIL ?? 0}
                          blocked={cs.BLOCKED ?? 0}
                          notRun={cs.NOT_RUN ?? 0}
                          showLabel={false}
                        />
                        <span className="text-xs font-medium w-10 text-right tabular-nums">
                          {pr}%
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right column — Activity */}
      <div className="w-full md:w-72 shrink-0 border-t md:border-t-0 md:border-l border-border p-5 overflow-y-auto bg-card/50" data-testid="dashboard-activity-sidebar">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Activity
        </h3>
        {recentCycles.length === 0 ? (
          <p className="text-xs text-muted-foreground">No recent activity.</p>
        ) : (
          <div className="space-y-3">
            {recentCycles.slice(0, 10).map((c, i) => (
              <div key={c.id} className="flex gap-3" data-testid={`dashboard-activity-item-${c.id}`}>
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full mt-1 shrink-0",
                      c.status === "ACTIVE"
                        ? "bg-emerald-500"
                        : "bg-slate-300 dark:bg-slate-600"
                    )}
                  />
                  {i < recentCycles.length - 1 && (
                    <div className="w-px flex-1 bg-border mt-1" />
                  )}
                </div>
                <div className="pb-3 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {c.summary}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {c.key} · {c.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
