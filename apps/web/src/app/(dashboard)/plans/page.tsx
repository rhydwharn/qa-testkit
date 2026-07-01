"use client";

import { useState, useEffect } from "react";
import { TestIds } from "@/lib/test-ids";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, BookOpen } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { useRouter } from "next/navigation";
interface TestPlan {
  id: string;
  key: string;
  summary: string;
  description?: string | null;
  status: string;
  priority?: { name: string; color: string } | null;
  cycles: Array<{
    testCycle: { id: string; key: string; summary: string; status: string; _count: { executions: number } };
  }>;
}

const ALL_STATUSES = ["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"] as const;

export default function PlansPage() {
  const [plans, setPlans] = useState<TestPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";
  const router = useRouter();

  // Auto-select first project if not already selected
  useEffect(() => {
    if (!projectId) {
      fetch('/api/projects')
        .then(r => r.json())
        .then(data => {
          const projects = Array.isArray(data) ? data : [];
          if (projects.length > 0) {
            router.push(`/plans?projectId=${projects[0].id}`);
          }
        })
        .catch(err => console.error('Failed to fetch projects:', err));
    }
  }, [projectId, router]);

  useEffect(() => {
    if (!projectId) { setLoading(false); return; }
    setLoading(true);
    const url = `/api/testplans?projectId=${projectId}${showArchived ? "&includeArchived=true" : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => { setPlans(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId, showArchived]);

  function toggleStatus(status: string) {
    setActiveStatuses(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  const filtered = plans.filter((p) => {
    const matchesQuery = p.summary.toLowerCase().includes(query.toLowerCase()) || p.key.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = activeStatuses.size === 0 || activeStatuses.has(p.status);
    return matchesQuery && matchesStatus;
  });

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <BookOpen className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Select a project to view test plans.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 overflow-y-auto flex-1" data-testid="plans-page">
      {/* Header */}
      <div className="flex items-center justify-between" data-testid="plans-header">
        <div>
          <h1 className="text-xl font-semibold">Test Plans</h1>
          <p className="text-sm text-muted-foreground">{plans.length} plans</p>
        </div>
        <Link href={`/plans/new?projectId=${projectId}`}>
          <Button size="sm" className="gap-1.5" data-testid="plans-button-new">
            <Plus className="h-3.5 w-3.5" />
            New Plan
          </Button>
        </Link>
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-3 flex-wrap" data-testid="plans-filters">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search plans..."
            className="pl-9 h-8"
            data-testid="plans-filter-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-2 flex-wrap" data-testid="plans-filter-status-group">
          {ALL_STATUSES.map(status => (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              data-testid={`plans-filter-status-${status.toLowerCase()}`}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                activeStatuses.has(status)
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground"
              )}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Show archived toggle */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground">Show Archived</span>
          <button
            role="switch"
            aria-checked={showArchived}
            onClick={() => setShowArchived(v => !v)}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none",
              showArchived ? "bg-foreground" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transform transition-transform",
                showArchived ? "translate-x-4" : "translate-x-0"
              )}
            />
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 border border-dashed border-border rounded-xl">
          <BookOpen className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No test plans found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((plan) => (
            <Link key={plan.id} href={`/plans/${plan.id}?projectId=${projectId}`}>
              <div className="bg-card border border-border rounded-xl p-4 hover:shadow-md hover:border-primary/30 transition-all group cursor-pointer h-full">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-muted-foreground">{plan.key}</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-medium border",
                    plan.status === "ACTIVE"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                      : plan.status === "COMPLETED"
                      ? "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                      : plan.status === "ARCHIVED"
                      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                      : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800"
                  )}>
                    {plan.status}
                  </span>
                </div>
                <h3 className="font-semibold text-sm text-foreground mb-1 line-clamp-2">{plan.summary}</h3>
                {plan.description && (
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{plan.description}</p>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-2">
                  <span>{plan.cycles?.length ?? 0} cycles</span>
                  {plan.priority && (
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full" style={{ background: plan.priority.color }} />
                      {plan.priority.name}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
