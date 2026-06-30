"use client";

import { useState, useEffect } from "react";
import { TestIds } from "@/lib/test-ids";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, CheckCircle2 } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { ReportSidebar, type ReportType } from "./_components/sidebar";
import { ReportView } from "./_components/report-view";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Summary {
  totalCases: number;
  totalCycles: number;
  totalPlans: number;
  executionStats: Record<string, number>;
  passRate: number;
  recentRuns: {
    id: string; framework: string; passed: number; failed: number;
    skipped: number; totalTests: number; submittedAt: string;
  }[];
}

interface TrendPoint {
  date: string; passRate: number; pass: number; fail: number; total: number;
}

// ─── Overview panel ───────────────────────────────────────────────────────────

function OverviewPanel({ projectId }: { projectId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trend, setTrend]     = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/reports/${projectId}?type=summary`).then((r) => r.json()),
      fetch(`/api/reports/${projectId}?type=trends`).then((r) => r.json()),
    ])
      .then(([s, t]) => { setSummary(s); setTrend(t); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  const barData = [
    { name: "Pass",    count: summary?.executionStats.PASS    ?? 0, fill: "hsl(142, 71%, 45%)" },
    { name: "Fail",    count: summary?.executionStats.FAIL    ?? 0, fill: "hsl(0, 72%, 51%)"   },
    { name: "Blocked", count: summary?.executionStats.BLOCKED ?? 0, fill: "hsl(38, 92%, 50%)"  },
    { name: "Skipped", count: summary?.executionStats.SKIPPED ?? 0, fill: "hsl(215, 16%, 47%)" },
    { name: "Not Run", count: summary?.executionStats.NOT_RUN ?? 0, fill: "hsl(215, 16%, 75%)" },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-muted-foreground">
        <span>Reports</span>
        <span className="mx-1.5">›</span>
        <span className="text-foreground font-medium">Overview</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[
          { label: "Test Cases",       value: summary?.totalCases ?? 0,                                                                icon: CheckCircle2 },
          { label: "Cycles",           value: summary?.totalCycles ?? 0,                                                               icon: TrendingUp   },
          { label: "Pass Rate",        value: `${summary?.passRate ?? 0}%`,                                                            icon: CheckCircle2, color: "text-pass" },
          { label: "Total Executions", value: Object.values(summary?.executionStats ?? {}).reduce((a, b) => a + b, 0),                 icon: BarChart3    },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{label}</span>
                <Icon className={`h-4 w-4 ${color ?? "text-muted-foreground"}`} />
              </div>
              <p className={`text-3xl font-bold ${color ?? ""}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pass rate trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pass Rate Trend (Last 30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {trend.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              No execution data yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="passGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date"   tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Area type="monotone" dataKey="passRate" stroke="hsl(142, 71%, 45%)" fill="url(#passGrad)" strokeWidth={2} name="Pass Rate" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Execution breakdown & automation runs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Execution Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(summary?.executionStats ?? {}).length === 0 ? (
              <p className="text-sm text-muted-foreground">No executions yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={barData}>
                  <XAxis dataKey="name"     tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Automation Runs</CardTitle>
          </CardHeader>
          <CardContent>
            {!summary?.recentRuns.length ? (
              <p className="text-sm text-muted-foreground">
                No automation runs yet. Configure a reporter to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {summary.recentRuns.map((run) => (
                  <div key={run.id} className="flex items-center justify-between text-sm border rounded-md px-3 py-2">
                    <div>
                      <span className="font-medium capitalize">{run.framework}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {new Date(run.submittedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <span className="text-pass">{run.passed}P</span>
                      <span className="text-fail">{run.failed}F</span>
                      <span className="text-muted-foreground">{run.skipped}S</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("overview");

  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center" data-testid="reports-no-project">
        <BarChart3 className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Select a project to view reports.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0" data-testid="reports-page">
      <ReportSidebar selected={reportType} onSelect={setReportType} />
      {reportType === "overview" ? (
        <OverviewPanel projectId={projectId} />
      ) : (
        <ReportView reportType={reportType} projectId={projectId} />
      )}
    </div>
  );
}
