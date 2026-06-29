"use client";

import { useState, useEffect, useCallback } from "react";
import { useResizableColumns } from "@/hooks/use-resize";
import { ColResizeHandle } from "@/components/ui/resize-handle";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TestIds } from "@/lib/test-ids";
import {
  Plus,
  Search,
  RefreshCw,
  Copy,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CloneCycleDialog } from "@/components/CloneCycleDialog";
import { useProject } from "@/hooks/use-project";

interface CycleStats {
  PASS?: number;
  FAIL?: number;
  BLOCKED?: number;
  SKIPPED?: number;
  NOT_RUN?: number;
  IN_PROGRESS?: number;
}

interface TestCycle {
  id: string;
  key: string;
  summary: string;
  status: "DRAFT" | "ACTIVE" | "CLOSED";
  startDate?: string;
  endDate?: string;
  environment?: { name: string } | null;
  build?: { name: string } | null;
  executionStats: CycleStats;
  _count: { executions: number };
  total?: number;
  isArchived?: boolean;
}

export default function CyclesPage() {
  const router = useRouter();
  const { selectedProject } = useProject();
  const [cycles, setCycles] = useState<TestCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState("1");

  const { colWidths, startColResize } = useResizableColumns(
    { key: 120, progress: 144, pass: 56, fail: 56, total: 56, status: 88 },
    { storageKey: "cycles-table-cols", min: 48 }
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"DRAFT" | "ACTIVE" | "CLOSED" | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cloneDialogCycle, setCloneDialogCycle] = useState<{
    id: string;
    summary: string;
  } | null>(null);
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const loadCycles = useCallback(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const url = `/api/testcycles?projectId=${projectId}${showArchived ? "&includeArchived=true" : ""}`;
    fetch(url)
      .then(async (r) => {
        if (!r.ok) {
          const errorData = await r.json().catch(() => ({}));
          throw new Error(errorData.message || "Failed to load cycles");
        }
        return r.json();
      })
      .then((data) => {
        setCycles(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load cycles");
        setLoading(false);
      });
  }, [projectId, showArchived]);

  useEffect(() => {
    loadCycles();
  }, [loadCycles]);

  const filteredCycles = cycles.filter((c) => {
    const matchesSearch =
      c.summary.toLowerCase().includes(search.toLowerCase()) ||
      c.key.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === null || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    setCurrentPage(1);
    setPageInputValue("1");
  }, [search, statusFilter, showArchived]);

  function toggleSelect(id: string, index: number, shiftKey: boolean) {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const globalIndex = startIndex + index;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastSelectedIndex !== null) {
        const start = Math.min(lastSelectedIndex, globalIndex);
        const end = Math.max(lastSelectedIndex, globalIndex);
        for (let i = start; i <= end; i++) {
          if (i >= 0 && i < filteredCycles.length) {
            next.add(filteredCycles[i].id);
          }
        }
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
    setLastSelectedIndex(globalIndex);
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selectedIds.size} cycle(s)? This cannot be undone.`))
      return;
    setBulkUpdating(true);
    setError(null);
    try {
      const response = await fetch("/api/testcycles/bulk/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testCycleIds: [...selectedIds] }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to delete cycles");
      }
      setSelectedIds(new Set());
      loadCycles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete cycles");
    } finally {
      setBulkUpdating(false);
    }
  }

  async function bulkUpdateStatus(status: string) {
    setBulkUpdating(true);
    setError(null);
    try {
      const response = await fetch("/api/testcycles/bulk/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testCycleIds: [...selectedIds], status }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update status");
      }
      setSelectedIds(new Set());
      loadCycles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setBulkUpdating(false);
    }
  }

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <RefreshCw className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">
          Select a project to view test cycles.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0" data-testid={TestIds.cycles.page}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card" data-testid="cycles-page-header">
        <div>
          <h1 className="text-lg font-semibold text-foreground" data-testid={TestIds.cycles.title}>Test Cycles</h1>
          <p className="text-xs text-muted-foreground mt-0.5" data-testid="cycles-page-subtitle">
            {filteredCycles.length} cycles in {selectedProject?.name ?? "project"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/cycles/new?projectId=${projectId}`}>
            <Button size="sm" className="gap-1.5 h-8">
              <Plus className="h-3.5 w-3.5" /> New Cycle
            </Button>
          </Link>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-200">
          <div className="flex items-start gap-3">
            <div className="text-red-600 font-medium text-sm">{error}</div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-700 text-sm ml-auto"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Toolbar: search + filters */}
      <div className="px-6 py-3 border-b border-border bg-background flex items-center gap-3 flex-wrap" data-testid="cycles-toolbar">
        <div className="relative flex-1 min-w-48 max-w-sm" data-testid="cycles-search-container">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cycles…"
            className="pl-8 h-8 text-sm"
            data-testid={TestIds.cycles.filterSearch}
          />
        </div>
        {/* Status pills */}
        <div className="flex items-center gap-1.5" data-testid="cycles-status-filters">
          {(["DRAFT", "ACTIVE", "CLOSED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter((f) => (f === s ? null : s))}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                statusFilter === s
                  ? s === "ACTIVE"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted-foreground/20 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              data-testid={TestIds.cycles.filterStatus(s.toLowerCase())}
            >
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        {/* Archived toggle */}
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer ml-auto" data-testid="cycles-archived-toggle-label">
          <button
            role="switch"
            aria-checked={showArchived}
            onClick={() => setShowArchived(!showArchived)}
            className={cn(
              "relative inline-flex h-4 w-7 items-center rounded-full transition-colors shrink-0",
              showArchived ? "bg-primary" : "bg-input"
            )}
            data-testid={TestIds.cycles.filterArchived}
          >
            <span
              className={cn(
                "inline-block h-3 w-3 rounded-full bg-white shadow transition-transform",
                showArchived ? "translate-x-3.5" : "translate-x-0.5"
              )}
            />
          </button>
          Archived
        </label>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="px-6 py-2 bg-primary/10 border-b border-primary/20 flex items-center gap-3 text-sm">
          <span className="font-medium text-primary text-sm">
            {selectedIds.size} selected
          </span>
          <button
            onClick={bulkDelete}
            disabled={bulkUpdating}
            className="text-xs px-2.5 py-1 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
          >
            Delete
          </button>
          <select
            onChange={(e) => {
              if (e.target.value) {
                bulkUpdateStatus(e.target.value);
                e.target.value = "";
              }
            }}
            className="text-xs border border-border rounded px-2 py-1 bg-background"
          >
            <option value="">Set status…</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="CLOSED">Closed</option>
          </select>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground ml-auto"
          >
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredCycles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <RefreshCw className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {search || statusFilter
                ? "No cycles match your search."
                : "No test cycles found"}
            </p>
          </div>
        ) : (
          <>
            {(() => {
              const totalPages = Math.ceil(filteredCycles.length / itemsPerPage);
              const startIndex = (currentPage - 1) * itemsPerPage;
              const endIndex = startIndex + itemsPerPage;
              const paginatedCycles = filteredCycles.slice(startIndex, endIndex);
              const goToPage = (page: number) => setCurrentPage(Math.min(Math.max(1, page), totalPages));

              return (
                <>
                  <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 32 }} />
              <col style={{ width: colWidths.key }} />
              <col />{/* summary — takes remaining space */}
              <col style={{ width: colWidths.progress }} className="hidden md:table-column" />
              <col style={{ width: colWidths.pass }} className="hidden sm:table-column" />
              <col style={{ width: colWidths.fail }} className="hidden sm:table-column" />
              <col style={{ width: colWidths.total }} className="hidden sm:table-column" />
              <col style={{ width: colWidths.status }} />
              <col style={{ width: 48 }} />
            </colgroup>
            <thead className="bg-muted/40 border-b border-border sticky top-0" data-testid={TestIds.cycles.tableHeader}>
              <tr>
                <th className="px-4 py-2.5" data-testid="cycles-header-checkbox">
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.size === filteredCycles.length &&
                      filteredCycles.length > 0
                    }
                    onChange={(e) =>
                      setSelectedIds(
                        e.target.checked
                          ? new Set(filteredCycles.map((c) => c.id))
                          : new Set()
                      )
                    }
                    className="h-3.5 w-3.5 rounded accent-primary"
                    data-testid="cycles-select-all-checkbox"
                  />
                </th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground relative overflow-visible" data-testid="cycles-header-key">
                  Key
                  <ColResizeHandle onMouseDown={(e) => startColResize(e, "key")} />
                </th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground" data-testid="cycles-header-summary">
                  Summary
                </th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell relative overflow-visible" data-testid="cycles-header-progress">
                  Progress
                  <ColResizeHandle onMouseDown={(e) => startColResize(e, "progress")} />
                </th>
                <th className="text-center px-3 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell relative overflow-visible" data-testid="cycles-header-pass">
                  Pass
                  <ColResizeHandle onMouseDown={(e) => startColResize(e, "pass")} />
                </th>
                <th className="text-center px-3 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell relative overflow-visible" data-testid="cycles-header-fail">
                  Fail
                  <ColResizeHandle onMouseDown={(e) => startColResize(e, "fail")} />
                </th>
                <th className="text-center px-3 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell relative overflow-visible" data-testid="cycles-header-total">
                  Total
                  <ColResizeHandle onMouseDown={(e) => startColResize(e, "total")} />
                </th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground relative overflow-visible" data-testid="cycles-header-status">
                  Status
                  <ColResizeHandle onMouseDown={(e) => startColResize(e, "status")} />
                </th>
                <th className="px-3 py-2.5" data-testid="cycles-header-actions"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border" data-testid={TestIds.cycles.tableBody}>
              {paginatedCycles.map((cycle, index) => {
                const stats = cycle.executionStats ?? {};
                const total =
                  cycle.total ??
                  ((stats.PASS ?? 0) +
                    (stats.FAIL ?? 0) +
                    (stats.BLOCKED ?? 0) +
                    (stats.NOT_RUN ?? 0));
                const passRate =
                  total > 0
                    ? Math.round(((stats.PASS ?? 0) / total) * 100)
                    : 0;
                const isSelected = selectedIds.has(cycle.id);
                return (
                  <tr
                    key={cycle.id}
                    className={cn(
                      "group hover:bg-muted/30 transition-colors cursor-pointer",
                      isSelected && "bg-primary/5",
                      cycle.isArchived && "opacity-60"
                    )}
                    onClick={() =>
                      router.push(`/cycles/${cycle.id}?projectId=${projectId}`)
                    }
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelect(cycle.id, index, (e.nativeEvent as MouseEvent).shiftKey);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-3.5 w-3.5 rounded accent-primary"
                      />
                    </td>
                    {/* Key */}
                    <td className="px-3 py-3">
                      <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {cycle.key}
                      </span>
                    </td>
                    {/* Summary + tags */}
                    <td className="px-3 py-3">
                      <p className="font-medium text-sm text-foreground truncate">
                        {cycle.summary}
                      </p>
                      {(cycle.environment || cycle.build) && (
                        <div className="flex gap-1 mt-1">
                          {cycle.environment && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-accent text-accent-foreground">
                              {cycle.environment.name}
                            </span>
                          )}
                          {cycle.build && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">
                              {cycle.build.name}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    {/* Progress bar */}
                    <td className="px-3 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-muted flex">
                          {total > 0 && (
                            <>
                              <div
                                style={{
                                  width: `${((stats.PASS ?? 0) / total) * 100}%`,
                                }}
                                className="bg-pass"
                              />
                              <div
                                style={{
                                  width: `${((stats.FAIL ?? 0) / total) * 100}%`,
                                }}
                                className="bg-fail"
                              />
                              <div
                                style={{
                                  width: `${((stats.BLOCKED ?? 0) / total) * 100}%`,
                                }}
                                className="bg-blocked"
                              />
                            </>
                          )}
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
                          {passRate}%
                        </span>
                      </div>
                    </td>
                    {/* Pass count */}
                    <td className="px-3 py-3 text-center hidden sm:table-cell">
                      <span className="text-xs font-medium text-pass tabular-nums">
                        {stats.PASS ?? 0}
                      </span>
                    </td>
                    {/* Fail count */}
                    <td className="px-3 py-3 text-center hidden sm:table-cell">
                      <span className="text-xs font-medium text-fail tabular-nums">
                        {stats.FAIL ?? 0}
                      </span>
                    </td>
                    {/* Total */}
                    <td className="px-3 py-3 text-center hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {total}
                      </span>
                    </td>
                    {/* Status */}
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                          cycle.status === "ACTIVE"
                            ? "bg-primary/15 text-primary"
                            : cycle.status === "CLOSED"
                            ? "bg-muted text-muted-foreground"
                            : "bg-muted/60 text-muted-foreground"
                        )}
                      >
                        {cycle.status.charAt(0) + cycle.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCloneDialogCycle({
                              id: cycle.id,
                              summary: cycle.summary,
                            });
                          }}
                          title="Clone"
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
                  </table>

                  {/* Pagination controls */}
                  <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-card">
                    <div className="text-xs text-muted-foreground">
                      Showing {startIndex + 1}–{Math.min(endIndex, filteredCycles.length)} of {filteredCycles.length} cycles
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 relative z-40">
                        <label className="text-xs text-muted-foreground">Per page:</label>
                        <select
                          value={itemsPerPage}
                          onChange={(e) => {
                            setItemsPerPage(Number(e.target.value));
                            setCurrentPage(1);
                          }}
                          className="text-xs border border-border rounded px-2 py-1 bg-background cursor-pointer relative z-40"
                        >
                          <option value="10">10</option>
                          <option value="20">20</option>
                          <option value="50">50</option>
                          <option value="100">100</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const newPage = currentPage - 1;
                            goToPage(newPage);
                            setPageInputValue(String(newPage));
                          }}
                          disabled={currentPage === 1}
                        >
                          ← Prev
                        </Button>

                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">Page</span>
                          <input
                            type="number"
                            min="1"
                            max={totalPages || 1}
                            value={pageInputValue}
                            onChange={(e) => setPageInputValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const page = Math.max(1, Math.min(totalPages || 1, parseInt(e.currentTarget.value) || 1));
                                goToPage(page);
                                setPageInputValue(String(page));
                              }
                            }}
                            onBlur={(e) => {
                              const page = Math.max(1, Math.min(totalPages || 1, parseInt(e.target.value) || currentPage));
                              goToPage(page);
                              setPageInputValue(String(page));
                            }}
                            className="text-xs border border-border rounded px-2 py-1 w-12 text-center bg-background"
                            data-testid="cycles-page-input"
                          />
                          <span className="text-xs text-muted-foreground">of {totalPages || 1}</span>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const newPage = currentPage + 1;
                            goToPage(newPage);
                            setPageInputValue(String(newPage));
                          }}
                          disabled={currentPage === totalPages}
                        >
                          Next →
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </>
        )}
      </div>

      {/* Clone cycle dialog */}
      {cloneDialogCycle && (
        <CloneCycleDialog
          cycleId={cloneDialogCycle.id}
          cycleSummary={cloneDialogCycle.summary}
          onClone={() => {
            setCloneDialogCycle(null);
            loadCycles();
          }}
        />
      )}
    </div>
  );
}
