"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { TestIds } from "@/lib/test-ids";
import { useResizablePanel } from "@/hooks/use-resize";
import { PanelResizeHandle } from "@/components/ui/resize-handle";
import { useParams, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2, XCircle, AlertCircle, SkipForward, Circle,
  Loader2, Bug, Plus, Play, MoreHorizontal, ChevronDown, ChevronRight,
  X, BarChart2, ClipboardList, Filter, SlidersHorizontal, Search,
  RefreshCw, Paperclip, MessageSquare, Settings2, Upload, FolderOpen,
  Folder as FolderIcon, History,
} from "lucide-react";
import Link from "next/link";
import { cn, statusColor, formatDuration } from "@/lib/utils";
import { CommentThread } from "@/components/CommentThread";
import { ArchiveButton } from "@/components/ArchiveButton";
import { CloneCycleDialog } from "@/components/CloneCycleDialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExecStatus = "NOT_RUN" | "IN_PROGRESS" | "PASS" | "FAIL" | "BLOCKED" | "SKIPPED";
type SortField = "sequence" | "key" | "summary" | "result" | "status" | "priority" | "environment";

const EXECUTION_METHODS = [
  { value: "MANUAL", label: "Manual" },
  { value: "CYPRESS", label: "Cypress [Mocha]" },
  { value: "CYPRESS_BDD", label: "Cypress [BDD]" },
  { value: "PLAYWRIGHT", label: "Playwright [Mocha]" },
  { value: "PLAYWRIGHT_BDD", label: "Playwright [BDD]" },
  { value: "JEST", label: "Jest" },
  { value: "SELENIUM", label: "Selenium" },
  { value: "TESTNG", label: "TestNG" },
] as const;

interface StepExecution {
  id: string;
  status: ExecStatus;
  actualResult?: string;
  comment?: string;
  testStepId: string;
  testStep?: {
    id: string;
    order: number;
    stepDetails: string;
  };
}

interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  createdAt: string;
}

interface TestCaseExecution {
  id: string;
  status: ExecStatus;
  duration?: number;
  actualResult?: string;
  comment?: string;
  executionMethod?: string;
  externalTestKey?: string | null;
  defects: { id: string; jiraIssueKey: string; jiraSummary?: string }[];
  stepExecutions: StepExecution[];
  attachments?: Attachment[];
  testCaseVersion: {
    versionNumber?: number;
    versionNo?: number;
    testCase: {
      key: string;
      summary: string;
      description?: string;
      priority?: { name: string; color: string } | null;
      isExternal?: boolean;
    };
    steps: {
      id: string;
      order: number;
      stepDetails: string;
      expectedResult?: string;
      testData?: string;
    }[];
  };
  assignee?: { id?: string; name?: string; email?: string; image?: string } | null;
  executedBy?: { name?: string; email?: string } | null;
  executedAt?: string | null;
  createdAt?: string;
  _count: { attachments: number };
}

interface Cycle {
  id: string;
  key: string;
  summary: string;
  status: string;
  projectId: string;
  isArchived?: boolean;
  startDate?: string;
  endDate?: string;
  environment?: { name: string } | null;
  build?: { name: string } | null;
  createdBy?: { name?: string; email?: string } | null;
  executions: TestCaseExecution[];
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_DOT_COLOR: Record<ExecStatus, string> = {
  NOT_RUN: "#9ca3af",
  IN_PROGRESS: "#3b82f6",
  PASS: "#22c55e",
  FAIL: "#ef4444",
  BLOCKED: "#f97316",
  SKIPPED: "#9ca3af",
};

const STATUS_LABELS: Record<ExecStatus, string> = {
  NOT_RUN: "Not Executed",
  IN_PROGRESS: "Work In Progress",
  PASS: "Pass",
  FAIL: "Fail",
  BLOCKED: "Blocked",
  SKIPPED: "Skipped",
};

const STATUS_BG: Record<ExecStatus, string> = {
  NOT_RUN: "bg-gray-100 text-gray-600",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  PASS: "bg-green-100 text-green-700",
  FAIL: "bg-red-100 text-red-700",
  BLOCKED: "bg-orange-100 text-orange-700",
  SKIPPED: "bg-gray-100 text-gray-600",
};

function formatDate(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Status Dropdown (for left-panel "..." menu)
// ---------------------------------------------------------------------------

function StatusDropdown({
  current,
  execId,
  onUpdate,
}: {
  current: ExecStatus;
  execId: string;
  onUpdate: (id: string, s: ExecStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const options: ExecStatus[] = ["BLOCKED", "FAIL", "IN_PROGRESS", "NOT_RUN", "PASS"];

  return (
    <div data-testid="cycles-detail-page" ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-background border border-border rounded-lg shadow-lg py-1 w-44">
          {options.map((s) => (
            <button
              key={s}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted transition-colors text-left"
              onClick={() => { onUpdate(execId, s); setOpen(false); }}
            >
              <span
                className="h-3 w-3 rounded-sm shrink-0 border border-gray-300"
                style={{ backgroundColor: STATUS_DOT_COLOR[s] }}
              />
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide-over panel wrapper
// ---------------------------------------------------------------------------

function SlideOver({
  open,
  onClose,
  title,
  children,
  width = "w-[480px]",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />
      {/* Panel */}
      <div className={cn("fixed right-0 top-0 bottom-0 z-50 bg-background border-l border-border flex flex-col shadow-2xl", width)}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="font-semibold text-base">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Summary panel
// ---------------------------------------------------------------------------

function SummaryPanel({ executions, onClose }: { executions: TestCaseExecution[]; onClose: () => void }) {
  const total = executions.length;
  const counts: Partial<Record<ExecStatus, number>> = {};
  for (const e of executions) counts[e.status] = (counts[e.status] ?? 0) + 1;

  const maxCount = Math.max(...Object.values(counts).map((v) => v ?? 0), 1);

  const rows: { status: ExecStatus; label: string; color: string }[] = [
    { status: "NOT_RUN", label: "NOT EXECUTED", color: "#9ca3af" },
    { status: "FAIL", label: "FAIL", color: "#ef4444" },
    { status: "BLOCKED", label: "BLOCKED", color: "#f97316" },
    { status: "PASS", label: "PASS", color: "#22c55e" },
  ];

  return (
    <SlideOver open onClose={onClose} title="Summary" width="w-[520px]">
      <div className="px-5 py-4 space-y-6">
        {/* Bar chart */}
        <div>
          <div className="flex items-end gap-6 h-40 border-b border-border pb-2">
            {rows.map(({ status, label, color }) => {
              const count = counts[status] ?? 0;
              const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
    <div data-testid="cycles-detail-page" key={status} className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-xs font-bold text-foreground">{count > 0 ? count : ""}</span>
                  <div
                    className="w-full rounded-t-sm transition-all"
                    style={{ height: `${Math.max(pct, count > 0 ? 4 : 0)}%`, backgroundColor: color, minHeight: count > 0 ? 4 : 0 }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex gap-6 mt-2">
            {rows.map(({ status, label }) => (
              <div key={status} className="flex-1 text-center text-[10px] text-muted-foreground">{label}</div>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-1">Test Case Result</p>
        </div>

        {/* Summary table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Execution Result</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Coverage(%)</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">#Test Cases</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(({ status, label, color }) => {
                const count = counts[status] ?? 0;
                const pct = total > 0 ? ((count / total) * 100).toFixed(2) : "0.00";
                return (
                  <tr key={status} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold text-white"
                        style={{ backgroundColor: color }}
                      >
                        {label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{pct}%</td>
                    <td className="px-4 py-2.5 text-right font-medium">{count}</td>
                  </tr>
                );
              })}
              <tr className="bg-muted/30 font-semibold">
                <td className="px-4 py-2.5">Total Test Case(s)</td>
                <td className="px-4 py-2.5 text-right">100%</td>
                <td className="px-4 py-2.5 text-right">{total}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </SlideOver>
  );
}

// ---------------------------------------------------------------------------
// Execution Logs panel
// ---------------------------------------------------------------------------

interface ExecLog {
  id: string;
  user: string;
  action: string;
  field: string;
  from: string;
  to: string;
  timestamp: string;
}

function ExecutionLogsPanel({ executions, onClose }: { executions: TestCaseExecution[]; onClose: () => void }) {
  // Build synthetic logs from execution data
  const logs: ExecLog[] = executions
    .filter((e) => e.status !== "NOT_RUN" && e.executedAt)
    .map((e, i) => ({
      id: e.id,
      user: e.executedBy?.name ?? e.assignee?.name ?? "Unknown",
      action: "has updated TESTCASE EXECUTION",
      field: "EXECUTION RESULT",
      from: "Not Executed",
      to: STATUS_LABELS[e.status],
      timestamp: e.executedAt ?? "",
    }));

  return (
    <SlideOver open onClose={onClose} title="Execution Logs" width="w-[520px]">
      <div className="px-5 py-4">
        {logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No execution logs yet. Logs appear when test case executions are updated.
          </div>
        ) : (
          <div className="space-y-5">
            {logs.map((log) => (
              <div key={log.id} className="flex gap-3">
                {/* Avatar */}
                <div className="shrink-0 h-8 w-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">
                  {log.user.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold text-foreground">{log.user}</span>
                    {" "}<span className="text-muted-foreground">{log.action}</span>
                  </p>
                  <div className="mt-1.5 text-xs space-y-1">
                    <div>
                      <span className="underline font-medium text-foreground">{log.field}</span>
                      <span className="text-muted-foreground"> has been updated.</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>{log.from}</span>
                      <span>→</span>
                      <span
                        className="font-medium text-foreground"
                        style={{ color: log.to === "Pass" ? "#22c55e" : log.to === "Fail" ? "#ef4444" : "#f97316" }}
                      >
                        {log.to}
                      </span>
                    </div>
                  </div>
                  {log.timestamp && (
                    <p className="text-[10px] text-muted-foreground mt-1.5">{formatDate(log.timestamp)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SlideOver>
  );
}

// ---------------------------------------------------------------------------
// Sort By panel
// ---------------------------------------------------------------------------

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "sequence", label: "Linked Sequence" },
  { value: "key", label: "Key" },
  { value: "summary", label: "Summary" },
  { value: "result", label: "Execution Result" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "environment", label: "Environment" },
];

function SortByPanel({
  current,
  onSelect,
  onClose,
}: {
  current: SortField;
  onSelect: (s: SortField) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = SORT_OPTIONS.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <SlideOver open onClose={onClose} title="Sort By" width="w-[320px]">
      <div className="px-4 py-3 space-y-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1.5 font-medium">Sort By :</p>
          <div className="relative">
            <Input
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm pr-8"
            />
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>
        <div className="rounded-lg border border-border overflow-hidden">
          {filtered.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onSelect(opt.value); onClose(); }}
              className={cn(
                "w-full text-left px-3 py-2.5 text-sm transition-colors border-b border-border/50 last:border-b-0",
                current === opt.value ? "bg-brand-50 text-brand-700 font-medium" : "hover:bg-muted text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </SlideOver>
  );
}

// ---------------------------------------------------------------------------
// Filter Panel
// ---------------------------------------------------------------------------

function FilterPanel({
  filter,
  onFilter,
  onClose,
}: {
  filter: ExecStatus | "ALL";
  onFilter: (f: ExecStatus | "ALL") => void;
  onClose: () => void;
}) {
  const options: { value: ExecStatus | "ALL"; label: string; color?: string }[] = [
    { value: "ALL", label: "All" },
    { value: "PASS", label: "Pass", color: "#22c55e" },
    { value: "FAIL", label: "Fail", color: "#ef4444" },
    { value: "BLOCKED", label: "Blocked", color: "#f97316" },
    { value: "NOT_RUN", label: "Not Executed", color: "#9ca3af" },
    { value: "IN_PROGRESS", label: "In Progress", color: "#3b82f6" },
  ];

  return (
    <SlideOver open onClose={onClose} title="Filter" width="w-[320px]">
      <div className="px-4 py-3">
        <p className="text-xs text-muted-foreground mb-2 font-medium">Execution Result</p>
        <div className="space-y-1">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onFilter(opt.value); onClose(); }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                filter === opt.value ? "bg-brand-50 text-brand-700 font-medium" : "hover:bg-muted text-foreground"
              )}
            >
              {opt.color && (
                <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: opt.color }} />
              )}
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </SlideOver>
  );
}

// ---------------------------------------------------------------------------
// Left panel row item
// ---------------------------------------------------------------------------

function ExecListItem({
  exec,
  index,
  selected,
  onClick,
  onUpdateStatus,
}: {
  exec: TestCaseExecution;
  index: number;
  selected: boolean;
  onClick: () => void;
  onUpdateStatus: (id: string, s: ExecStatus) => void;
}) {
  const tc = exec.testCaseVersion?.testCase;
  const isExternal = !tc || tc.isExternal || exec.externalTestKey;
  return (
    <div data-testid="cycles-detail-page"
      onClick={onClick}
      className={cn(
        "group w-full text-left flex items-start gap-2 px-3 py-2.5 transition-colors border-b border-border/50 last:border-b-0 cursor-pointer",
        selected ? "bg-muted/60" : "hover:bg-muted/30"
      )}
    >
      <input type="checkbox" className="mt-0.5 shrink-0" onClick={(e) => e.stopPropagation()} readOnly />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[11px] font-mono text-blue-600 font-semibold leading-none">{tc?.key || exec.externalTestKey || "External"}</span>
          {isExternal && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">External</span>
          )}
          {exec.testCaseVersion?.versionNumber != null && (
            <span className="text-[9px] text-muted-foreground bg-muted px-1 rounded">v{exec.testCaseVersion.versionNumber}</span>
          )}
        </div>
        <p className="text-xs leading-snug line-clamp-2 text-foreground">{tc?.summary || "External automation result"}</p>
      </div>

      {/* Status badge + menu */}
      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        {exec.status !== "NOT_RUN" && (
          <span
            className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", STATUS_BG[exec.status])}
          >
            {exec.status === "IN_PROGRESS" ? "WIP" : exec.status.charAt(0) + exec.status.slice(1).toLowerCase()}
          </span>
        )}
        <StatusDropdown current={exec.status} execId={exec.id} onUpdate={onUpdateStatus} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cycle Progress Bar
// ---------------------------------------------------------------------------

function CycleProgressBar({ executions }: { executions: TestCaseExecution[] }) {
  const total = executions.length;
  if (total === 0) return null;
  const counts: Partial<Record<ExecStatus, number>> = {};
  for (const e of executions) counts[e.status] = (counts[e.status] ?? 0) + 1;
  const segments: { status: ExecStatus; pct: number }[] = (
    ["PASS", "FAIL", "BLOCKED", "SKIPPED", "IN_PROGRESS", "NOT_RUN"] as ExecStatus[]
  ).filter((s) => (counts[s] ?? 0) > 0)
   .map((s) => ({ status: s, pct: ((counts[s] ?? 0) / total) * 100 }));

  return (
    <div data-testid="cycles-detail-page" className="mt-2">
      <div className="flex h-1.5 rounded-full overflow-hidden w-full gap-px">
        {segments.map(({ status, pct }) => (
          <div key={status} style={{ width: `${pct}%`, backgroundColor: STATUS_DOT_COLOR[status] }} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CycleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get("projectId") ?? "";
  const [projectId, setProjectId] = useState(projectIdParam);
  const { data: session } = useSession();

  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"executions" | "details">("executions");

  const { width: leftPanelWidth, onMouseDown: onLeftPanelResize } = useResizablePanel(300, {
    min: 180, max: 520, storageKey: "cycle-detail-left-panel",
  });

  // Panels
  const [showSummary, setShowSummary] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showAddCases, setShowAddCases] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);

  // Start execution modal
  const [startExecId, setStartExecId] = useState<string | null>(null);
  const [startExecLoading, setStartExecLoading] = useState(false);

  // List controls
  const [sortBy, setSortBy] = useState<SortField>("sequence");
  const [filterStatus, setFilterStatus] = useState<ExecStatus | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [updating, setUpdating] = useState<string | null>(null);
  const [updatingMethod, setUpdatingMethod] = useState<string | null>(null);
  const [updatingStep, setUpdatingStep] = useState<string | null>(null);
  const [creatingBug, setCreatingBug] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/testcycles/${id}`)
      .then((r) => r.json())
      .then((data: Cycle) => {
        setCycle(data);
        if (data.executions.length > 0) setSelectedId(data.executions[0].id);
        setLoading(false);
        if (!projectIdParam && data.projectId) setProjectId(data.projectId);
      })
      .catch(() => setLoading(false));
  }, [id]);

  async function syncVersions() {
    const res = await fetch(`/api/testcycles/${id}/sync-latest-version`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (res.ok) {
      window.location.reload();
    }
  }

  async function updateStatus(execId: string, status: ExecStatus) {
    setUpdating(execId);
    const res = await fetch(`/api/testcycles/${id}/executions/${execId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const updated: Partial<TestCaseExecution> = await res.json();
    setCycle((prev) => prev ? {
      ...prev,
      executions: prev.executions.map((e) => e.id === execId ? { ...e, ...updated } : e),
    } : prev);
    setUpdating(null);
  }

  async function startExecution(execId: string) {
    setStartExecLoading(true);
    await updateStatus(execId, "IN_PROGRESS");
    setStartExecLoading(false);
    setStartExecId(null);
  }

  async function updateExecutionMethod(execId: string, method: string) {
    setUpdatingMethod(execId);
    const res = await fetch(`/api/testcycles/${id}/executions/${execId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ executionMethod: method }),
    });
    const updated: Partial<TestCaseExecution> = await res.json();
    setCycle((prev) => prev ? {
      ...prev,
      executions: prev.executions.map((e) =>
        e.id === execId ? { ...e, executionMethod: (updated.executionMethod as string | undefined) ?? method } : e
      ),
    } : prev);
    setUpdatingMethod(null);
  }

  async function updateStepStatus(execId: string, stepId: string, status: ExecStatus) {
    const key = `${execId}-${stepId}`;
    setUpdatingStep(key);
    const res = await fetch(`/api/testcycles/${id}/executions/${execId}/steps/${stepId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const updated: { id: string; status: ExecStatus; testStepId?: string } = await res.json();
    setCycle((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        executions: prev.executions.map((e) => {
          if (e.id !== execId) return e;
          const existing = e.stepExecutions.find((se) => se.testStepId === stepId);
          const newStepExecs = existing
            ? e.stepExecutions.map((se) => se.testStepId === stepId ? { ...se, status: updated.status } : se)
            : [...e.stepExecutions, { id: updated.id, status: updated.status, testStepId: stepId, comment: undefined }];
          return { ...e, stepExecutions: newStepExecs };
        }),
      };
    });
    setUpdatingStep(null);
  }

  async function createJiraBug(execId: string, summary: string) {
    if (!projectId) { alert("No project selected."); return; }
    setCreatingBug(execId);
    try {
      const res = await fetch("/api/jira/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, summary: `Test failure: ${summary}` }),
      });
      if (res.ok) {
        const data: { key: string } = await res.json();
        alert(`JIRA issue created: ${data.key}`);
      } else {
        const e: { error?: string } = await res.json().catch(() => ({}));
        alert(e.error ?? "Failed to create JIRA issue. Check JIRA settings.");
      }
    } catch { alert("Failed to reach JIRA API."); }
    setCreatingBug(null);
  }

  if (loading) {
    return (
    <div data-testid="cycles-detail-page" className="flex justify-center h-64 items-center">
        <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
      </div>
    );
  }
  if (!cycle) return <div className="text-muted-foreground">Cycle not found.</div>;

  // Filter + sort executions
  let displayed = [...cycle.executions];
  if (filterStatus !== "ALL") displayed = displayed.filter((e) => e.status === filterStatus);
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    displayed = displayed.filter((e) =>
      e.testCaseVersion.testCase.key.toLowerCase().includes(q) ||
      e.testCaseVersion.testCase.summary.toLowerCase().includes(q)
    );
  }
  if (sortBy === "key") displayed.sort((a, b) => a.testCaseVersion.testCase.key.localeCompare(b.testCaseVersion.testCase.key));
  else if (sortBy === "summary") displayed.sort((a, b) => a.testCaseVersion.testCase.summary.localeCompare(b.testCaseVersion.testCase.summary));
  else if (sortBy === "result") displayed.sort((a, b) => a.status.localeCompare(b.status));

  const selectedExec = cycle.executions.find((e) => e.id === selectedId) ?? null;

  const statusCounts = cycle.executions.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div data-testid="cycles-detail-page" className="flex flex-col flex-1 min-h-0 overflow-hidden">

      {/* ======================================================================
          FULL-WIDTH CYCLE HEADER
      ====================================================================== */}
      <div className="shrink-0 bg-background border-b border-border px-4 py-2.5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
          <Link href={`/cycles?projectId=${projectId}`} className="hover:text-foreground transition-colors">
            Test Cycles
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="font-mono text-foreground">{cycle.key}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-sm font-bold text-blue-600 shrink-0">{cycle.key}</span>
            <span className="text-sm font-semibold text-foreground truncate">{cycle.summary}</span>
            <Badge
              variant="outline"
              className="shrink-0 text-[10px] px-2 py-0 h-5 font-mono whitespace-nowrap"
              style={{ borderColor: "#3b82f6", color: "#3b82f6" }}
            >
              {EXECUTION_METHODS.find((m) => m.value === (cycle.executions[0]?.executionMethod ?? "MANUAL"))?.label ?? "Manual"}
            </Badge>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground" onClick={() => setShowSummary(true)}>
              <BarChart2 className="h-3.5 w-3.5" />
              Summary
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground" onClick={() => setShowLogs(true)}>
              <ClipboardList className="h-3.5 w-3.5" />
              Execution Logs
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={syncVersions}>
              <RefreshCw className="h-3.5 w-3.5" />
              Sync Versions
            </Button>
            <ArchiveButton entityType="TEST_CYCLE" entityId={id} isArchived={cycle.isArchived ?? false} />
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setShowCloneDialog(true)}>
              <Plus className="h-3.5 w-3.5" />
              Clone Cycle
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setShowAddCases(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add Test Cases
            </Button>
          </div>
        </div>
        {/* Cycle metadata row */}
        <div className="flex items-center gap-4 mt-1 text-[11px] text-muted-foreground">
          <span>From: {cycle.startDate ? formatDate(cycle.startDate) : "N/A"}</span>
          <span>To: {cycle.endDate ? formatDate(cycle.endDate) : "N/A"}</span>
          {cycle.environment && <span>Env: {cycle.environment.name}</span>}
          {cycle.build && <span>Build: {cycle.build.name}</span>}
          {cycle.createdBy && <span>Created by: {cycle.createdBy.name ?? cycle.createdBy.email}</span>}
        </div>
      </div>

      {/* ======================================================================
          FILTER TOOLBAR
      ====================================================================== */}
      <div className="shrink-0 bg-background border-b border-border px-4 py-1.5 flex items-center gap-2">
        {/* Left side: filter chips */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">View:</span>
          <span className="font-medium">All</span>
        </div>
        <div className="h-4 w-px bg-border mx-1" />
        <button
          onClick={() => setShowSort(true)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <SlidersHorizontal className="h-3 w-3" />
          Sort By: <span className="font-medium ml-0.5">{SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Linked Sequence"}</span>
        </button>
        <div className="h-4 w-px bg-border mx-1" />
        <span className="text-xs text-muted-foreground">Group By: None</span>
        <div className="h-4 w-px bg-border mx-1" />
        <button
          onClick={() => setShowFilter(true)}
          className={cn(
            "flex items-center gap-1 text-xs transition-colors",
            filterStatus !== "ALL" ? "text-brand-600 font-medium" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Filter className="h-3 w-3" />
          Filter {filterStatus !== "ALL" && `(${STATUS_LABELS[filterStatus as ExecStatus]})`}
          <Plus className="h-2.5 w-2.5" />
        </button>

        {/* Search */}
        <div className="ml-auto relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-6 pl-6 pr-2 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring w-36"
          />
        </div>

        {/* Refresh */}
        <button className="text-muted-foreground hover:text-foreground" title="Refresh">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ======================================================================
          SPLIT PANEL
      ====================================================================== */}
      <div className="flex flex-1 overflow-hidden">

        {/* ---- LEFT PANEL ---- */}
        <aside style={{ width: leftPanelWidth }} className="shrink-0 flex flex-col bg-background overflow-hidden">
          {/* Panel header */}
          <div className="px-3 py-2 border-b border-border shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" className="h-3 w-3" readOnly />
              <span>1 - {displayed.length} Of {displayed.length}</span>
              <RefreshCw className="h-3 w-3 cursor-pointer hover:text-foreground" />
            </div>
            <CycleProgressBar executions={cycle.executions} />
          </div>

          {/* Stats row */}
          <div className="px-3 py-1.5 border-b border-border/50 flex items-center gap-3 text-[10px] shrink-0">
            {(["PASS", "FAIL", "BLOCKED", "NOT_RUN"] as ExecStatus[]).map((s) => (
              <span key={s} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_DOT_COLOR[s] }} />
                <span className="text-muted-foreground">{statusCounts[s] ?? 0}</span>
              </span>
            ))}
          </div>

          {/* Execution list */}
          <div className="flex-1 overflow-y-auto">
            {displayed.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
                No test cases match the filter.
              </div>
            ) : (
              displayed.map((exec, idx) => (
                <ExecListItem
                  key={exec.id}
                  exec={exec}
                  index={idx}
                  selected={exec.id === selectedId}
                  onClick={() => { setSelectedId(exec.id); setActiveTab("executions"); }}
                  onUpdateStatus={updateStatus}
                />
              ))
            )}
          </div>
        </aside>

        <PanelResizeHandle onMouseDown={onLeftPanelResize} />

        {/* ---- RIGHT PANEL ---- */}
        <main className="flex-1 flex flex-col overflow-hidden bg-background">
          {selectedExec ? (
            <ExecutionRightPanel
              exec={selectedExec}
              cycleId={id}
              cycleEnv={cycle.environment?.name}
              cycleBuild={cycle.build?.name}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              updating={updating}
              updatingMethod={updatingMethod}
              updatingStep={updatingStep}
              creatingBug={creatingBug}
              onUpdateStatus={updateStatus}
              onUpdateMethod={updateExecutionMethod}
              onUpdateStepStatus={updateStepStatus}
              onCreateJiraBug={createJiraBug}
              onStartExecution={(execId) => setStartExecId(execId)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a test case from the list to view its execution.
            </div>
          )}
        </main>
      </div>

      {/* ======================================================================
          SLIDE-OVER PANELS
      ====================================================================== */}
      {showSummary && <SummaryPanel executions={cycle.executions} onClose={() => setShowSummary(false)} />}
      {showLogs && <ExecutionLogsPanel executions={cycle.executions} onClose={() => setShowLogs(false)} />}
      {showSort && <SortByPanel current={sortBy} onSelect={setSortBy} onClose={() => setShowSort(false)} />}
      {showFilter && <FilterPanel filter={filterStatus} onFilter={setFilterStatus} onClose={() => setShowFilter(false)} />}

      {/* Clone Cycle Dialog */}
      {cycle && (
        <CloneCycleDialog
          cycleId={id}
          cycleSummary={cycle.summary}
          open={showCloneDialog}
          onOpenChange={setShowCloneDialog}
          onClone={(newCycle) => {
            setShowCloneDialog(false);
            // Navigate to the new cloned cycle
            window.location.href = `/cycles/${newCycle.id}?projectId=${projectId}`;
          }}
        />
      )}

      {/* Add Test Cases slide-over */}
      {showAddCases && (
        <AddTestCasesPanel
          cycleId={id}
          projectId={projectId}
          onClose={() => setShowAddCases(false)}
          onAdded={() => {
            setShowAddCases(false);
            // Reload cycle
            fetch(`/api/testcycles/${id}`).then((r) => r.json()).then((data: Cycle) => setCycle(data));
          }}
        />
      )}

      {/* Start Execution confirmation modal */}
      {startExecId && (() => {
        const exec = cycle.executions.find((e) => e.id === startExecId);
        const tc = exec?.testCaseVersion.testCase;
        const userName = (session?.user?.name as string | undefined) ?? (session?.user?.email as string | undefined) ?? "Current User";
        const now = new Date();
        return (
          <Dialog open onOpenChange={() => setStartExecId(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Play className="h-4 w-4 text-green-600" />
                  Start New Test Execution
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="rounded-lg bg-muted/50 border p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Test Case</span>
                    <span className="font-mono font-bold text-blue-600">{tc?.key}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Summary</span>
                    <span className="font-medium text-right max-w-[60%] line-clamp-2">{tc?.summary}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Assignee</span>
                    <span className="font-medium text-blue-600">{userName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Start Date</span>
                    <span className="font-medium">{now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Start Time</span>
                    <span className="font-medium">{now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
                <p className="text-muted-foreground text-xs">This will set the execution status to <strong>In Progress</strong> and record the start time and assignee.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStartExecId(null)}>Cancel</Button>
                <Button
                  className="bg-[#22c55e] hover:bg-[#16a34a] text-white gap-1.5"
                  onClick={() => startExecution(startExecId)}
                  disabled={startExecLoading}
                >
                  {startExecLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                  Confirm &amp; Start
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right Panel
// ---------------------------------------------------------------------------

type RightTab = "executions" | "details";
type ExecSubTab = "steps" | "bug" | "attachments" | "comments" | "fields" | "history";

function ExecutionRightPanel({
  exec,
  cycleId,
  cycleEnv,
  cycleBuild,
  activeTab,
  onTabChange,
  updating,
  updatingMethod,
  updatingStep,
  creatingBug,
  onUpdateStatus,
  onUpdateMethod,
  onUpdateStepStatus,
  onCreateJiraBug,
  onStartExecution,
}: {
  exec: TestCaseExecution;
  cycleId: string;
  cycleEnv?: string;
  cycleBuild?: string;
  activeTab: RightTab;
  onTabChange: (t: RightTab) => void;
  updating: string | null;
  updatingMethod: string | null;
  updatingStep: string | null;
  creatingBug: string | null;
  onUpdateStatus: (execId: string, status: ExecStatus) => Promise<void>;
  onUpdateMethod: (execId: string, method: string) => Promise<void>;
  onUpdateStepStatus: (execId: string, stepId: string, status: ExecStatus) => Promise<void>;
  onCreateJiraBug: (execId: string, summary: string) => Promise<void>;
  onStartExecution: (execId: string) => void;
}) {
  const tc = exec.testCaseVersion?.testCase;
  const version = exec.testCaseVersion?.versionNumber;
  // For regular cases, get steps from testCaseVersion.steps
  // For external cases, construct steps from stepExecutions with their testStep data
  const steps = exec.testCaseVersion?.steps ??
    exec.stepExecutions
      .filter(se => se.testStep)
      .map(se => ({
        id: se.testStep!.id,
        order: se.testStep!.order,
        stepDetails: se.testStep!.stepDetails,
        expectedResult: null as any,
        testData: null,
        version: null as any,
        stepExecutions: null as any,
      }))
      .sort((a, b) => a.order - b.order) ?? [];
  const executedByName = exec.executedBy?.name ?? exec.assignee?.name ?? exec.assignee?.email;
  const executedAt = formatDate(exec.executedAt ?? undefined);

  return (
    <>
      {/* Header */}
      <div className="px-5 pt-3 pb-2.5 border-b border-border shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-mono font-bold text-blue-600 shrink-0">{tc?.key || exec.externalTestKey || "External"}</span>
            {version != null && (
              <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono shrink-0">v{version}</span>
            )}
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground cursor-pointer shrink-0" />
          </div>
          <Button
            size="sm"
            className="shrink-0 bg-[#22c55e] hover:bg-[#16a34a] text-white gap-1.5 text-xs h-7"
            onClick={() => onStartExecution(exec.id)}
          >
            <Play className="h-3 w-3 fill-current" />
            START A NEW TEST EXECUTION
          </Button>
        </div>
        <p className="text-sm font-semibold mt-1 line-clamp-2">{tc?.summary || "External automation result"}</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center px-5 border-b border-border shrink-0">
        {([
          { key: "executions" as const, label: "Executions" },
          { key: "details" as const, label: "Test Case Details" },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === key ? "border-brand-500 text-brand-600" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "executions" ? (
          <ExecTab
            exec={exec}
            cycleId={cycleId}
            cycleEnv={cycleEnv}
            cycleBuild={cycleBuild}
            steps={steps}
            executedByName={executedByName}
            executedAt={executedAt}
            updating={updating}
            updatingMethod={updatingMethod}
            updatingStep={updatingStep}
            creatingBug={creatingBug}
            onUpdateStatus={onUpdateStatus}
            onUpdateMethod={onUpdateMethod}
            onUpdateStepStatus={onUpdateStepStatus}
            onCreateJiraBug={onCreateJiraBug}
          />
        ) : (
          <DetailsTab exec={exec} steps={steps} />
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Executions tab
// ---------------------------------------------------------------------------

function ExecTab({
  exec,
  cycleId,
  cycleEnv,
  cycleBuild,
  steps,
  executedByName,
  executedAt,
  updating,
  updatingMethod,
  updatingStep,
  creatingBug,
  onUpdateStatus,
  onUpdateMethod,
  onUpdateStepStatus,
  onCreateJiraBug,
}: {
  exec: TestCaseExecution;
  cycleId: string;
  cycleEnv?: string;
  cycleBuild?: string;
  steps: TestCaseExecution["testCaseVersion"]["steps"];
  executedByName?: string;
  executedAt?: string | null;
  updating: string | null;
  updatingMethod: string | null;
  updatingStep: string | null;
  creatingBug: string | null;
  onUpdateStatus: (execId: string, status: ExecStatus) => Promise<void>;
  onUpdateMethod: (execId: string, method: string) => Promise<void>;
  onUpdateStepStatus: (execId: string, stepId: string, status: ExecStatus) => Promise<void>;
  onCreateJiraBug: (execId: string, summary: string) => Promise<void>;
}) {
  const tc = exec.testCaseVersion?.testCase;
  const [subTab, setSubTab] = useState<ExecSubTab>("steps");

  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [localAttachments, setLocalAttachments] = useState<Attachment[]>(exec.attachments ?? []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset attachment list when switching to a different execution
  useEffect(() => {
    setLocalAttachments(exec.attachments ?? []);
  }, [exec.id]);

  const screenshotCount = localAttachments.filter(a => a.mimeType?.startsWith("image/")).length;

  const subTabs: { key: ExecSubTab; label: string; count?: number }[] = [
    { key: "steps", label: "Steps", count: steps.length },
    { key: "bug", label: "Bug", count: exec.defects.length },
    { key: "attachments", label: `Attachments${screenshotCount > 0 ? ` (📸 ${screenshotCount})` : ""}`, count: localAttachments.length },
    { key: "comments", label: "Comments" },
    { key: "fields", label: "Execution Custom Fields" },
    { key: "history", label: "Execution History" },
  ];

  async function uploadAttachment(file: File) {
    setUploadingAttachment(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("executionId", exec.id);
    const res = await fetch("/api/attachments", { method: "POST", body: formData });
    if (res.ok) {
      const att: Attachment = await res.json();
      setLocalAttachments((prev) => [...prev, att]);
    }
    setUploadingAttachment(false);
  }

  return (
    <div data-testid="cycles-detail-page">
      {/* Metadata grid — 2 rows × 4 cols */}
      <div className="px-5 py-4 border-b border-border">
        <div className="grid grid-cols-4 gap-x-6 gap-y-3 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">Environment</p>
            <p className="text-sm">{cycleEnv ?? <span className="text-muted-foreground">—</span>}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">Build</p>
            <Select
              value={cycleBuild ?? ""}
              onValueChange={() => {}}
            >
              <SelectTrigger className="h-7 text-xs w-full border-0 px-0 shadow-none focus:ring-0">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={cycleBuild ?? "none"}>{cycleBuild ?? "None"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">Execution Assignee</p>
            <p className="text-sm">{executedByName ?? <span className="text-muted-foreground">—</span>}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">Planned On</p>
            <p className="text-sm text-muted-foreground">DD/MMM/YYYY</p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">Actual Time</p>
            <p className="text-sm text-muted-foreground">{exec.duration ? formatDuration(exec.duration) : "HH:MM:SS"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Execution Result</p>
            <div className="flex items-center gap-1.5">
              {(["PASS", "FAIL", "BLOCKED", "NOT_RUN"] as ExecStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => onUpdateStatus(exec.id, s)}
                  disabled={updating === exec.id}
                  title={STATUS_LABELS[s]}
                  className={cn(
                    "h-5 w-5 rounded-sm border transition-colors",
                    exec.status === s ? "border-transparent" : "border-gray-300 bg-white hover:opacity-80"
                  )}
                  style={exec.status === s ? { backgroundColor: STATUS_DOT_COLOR[s] } : {}}
                />
              ))}
              {exec.status !== "NOT_RUN" && (
                <span
                  className="text-xs font-semibold ml-1"
                  style={{ color: STATUS_DOT_COLOR[exec.status] }}
                >
                  {STATUS_LABELS[exec.status]}
                </span>
              )}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">Executed By</p>
            <p className="text-sm">{executedByName ?? <span className="text-muted-foreground">—</span>}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">Executed On</p>
            <p className="text-sm">{executedAt ?? <span className="text-muted-foreground">—</span>}</p>
          </div>
        </div>

        {/* Type row */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Type:</span>
          <Select
            value={exec.executionMethod ?? "MANUAL"}
            onValueChange={(val) => onUpdateMethod(exec.id, val)}
            disabled={updatingMethod === exec.id}
          >
            <SelectTrigger className="h-6 text-xs w-[180px] border-brand-300 text-brand-600 font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXECUTION_METHODS.map(({ value, label }) => (
                <SelectItem key={value} value={value} className="text-xs">{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="px-5 border-b border-border flex items-center">
        {subTabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors",
              subTab === key ? "border-brand-500 text-brand-600" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {key === "steps" && <Settings2 className="h-3 w-3" />}
            {key === "bug" && <Bug className="h-3 w-3" />}
            {key === "attachments" && <Paperclip className="h-3 w-3" />}
            {key === "comments" && <MessageSquare className="h-3 w-3" />}
            {key === "history" && <History className="h-3 w-3" />}
            {label}
            {count != null && (
              <span className={cn("text-[10px] font-bold", subTab === key ? "text-brand-600" : "text-muted-foreground")}>
                {count}
              </span>
            )}
          </button>
        ))}
        {/* LATEST badge */}
        <span className="ml-auto text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded">LATEST</span>
      </div>

      {/* Sub-tab content */}
      {subTab === "steps" && (
        <StepsContent
          exec={exec}
          steps={steps}
          updatingStep={updatingStep}
          onUpdateStepStatus={onUpdateStepStatus}
        />
      )}
      {subTab === "bug" && (
        <div className="px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {exec.defects.map((d) => (
              <span key={d.id} className="inline-flex items-center gap-1.5 text-xs text-red-600 border border-red-200 rounded px-2.5 py-1">
                <Bug className="h-3 w-3" />
                <span className="font-mono font-semibold">{d.jiraIssueKey}</span>
                {d.jiraSummary && <span className="text-muted-foreground">— {d.jiraSummary}</span>}
              </span>
            ))}
            {(exec.status === "FAIL" || exec.status === "BLOCKED") && tc && (
              <button
                onClick={() => onCreateJiraBug(exec.id, tc.summary)}
                disabled={creatingBug === exec.id}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground border border-dashed border-muted-foreground/40 rounded px-2.5 py-1 hover:text-red-500 hover:border-red-300 transition-colors disabled:opacity-50"
              >
                {creatingBug === exec.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Create JIRA Bug
              </button>
            )}
            {exec.defects.length === 0 && exec.status !== "FAIL" && exec.status !== "BLOCKED" && (
              <span className="text-xs text-muted-foreground">No bugs linked.</span>
            )}
          </div>
        </div>
      )}
      {subTab === "attachments" && (
        <div className="px-5 py-4 space-y-4">
          {/* Upload area */}
          <div
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-muted/20 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) uploadAttachment(f); }}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.png,.jpg,.jpeg,.gif,.webp,.pdf"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAttachment(f); }}
            />
            {uploadingAttachment ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm">Uploading…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="h-8 w-8" />
                <p className="text-sm font-medium">Drop screenshot or click to upload</p>
                <p className="text-xs">PNG, JPG, GIF, PDF supported</p>
              </div>
            )}
          </div>
          {/* Attachment list */}
          {localAttachments.length > 0 ? (
            <div className="space-y-3">
              {localAttachments.map((att) => {
                const isScreenshot = att.mimeType?.startsWith("image/");
                // Check if storageKey is base64 (automation screenshot) or file path (manual upload)
                const isBase64 = att.storageKey && (att.storageKey.match(/^[A-Za-z0-9+/=]{100,}$/) || att.storageKey.startsWith("data:"));
                // For base64, create data URL; for file paths, use direct path
                const displayUrl = isBase64
                  ? att.storageKey.startsWith("data:")
                    ? att.storageKey
                    : `data:${att.mimeType};base64,${att.storageKey}`
                  : `/api/attachments/${att.id}`;

                return (
                  <div key={att.id} className="space-y-2 rounded-lg border border-border p-3">
                    {/* Header with file info */}
                    <div className="flex items-center gap-3">
                      <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{att.fileName}</p>
                        <p className="text-xs text-muted-foreground">{(att.fileSize / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    {/* Display screenshot preview if it's an image */}
                    {isScreenshot && displayUrl && (
                      <div className="rounded-md overflow-hidden border border-border bg-gray-50">
                        <img
                          src={displayUrl}
                          alt={att.fileName}
                          className="w-full h-auto max-h-[500px] object-contain"
                          onError={() => console.error(`Failed to load image: ${att.fileName}`)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center">No attachments yet. Upload a screenshot above.</p>
          )}
        </div>
      )}
      {subTab === "comments" && (
        <div className="px-5 py-4">
          <CommentThread entityType="TEST_CYCLE" entityId={cycleId} />
        </div>
      )}
      {subTab === "fields" && (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
          No custom fields configured.
        </div>
      )}
      {subTab === "history" && (
        <div className="px-5 py-4 space-y-3">
          {exec.status !== "NOT_RUN" ? (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Execution Record</p>
              <div className="border border-border rounded-lg divide-y">
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span
                    className="font-semibold text-xs px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: STATUS_DOT_COLOR[exec.status] + "22",
                      color: STATUS_DOT_COLOR[exec.status],
                    }}
                  >
                    {STATUS_LABELS[exec.status]}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">Executed By</span>
                  <span className="font-medium">{exec.assignee?.name ?? exec.assignee?.email ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">Executed On</span>
                  <span className="font-medium">{exec.executedAt ? formatDate(exec.executedAt) : "—"}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">{exec.duration ? formatDuration(exec.duration) : "—"}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">Method</span>
                  <span className="font-medium">{EXECUTION_METHODS.find((m) => m.value === exec.executionMethod)?.label ?? exec.executionMethod ?? "Manual"}</span>
                </div>
                {exec.actualResult && (
                  <div className="px-4 py-2.5 text-sm">
                    <p className="text-muted-foreground mb-1">Actual Result</p>
                    <pre className="text-xs text-red-700 whitespace-pre-wrap font-mono bg-red-50/50 rounded p-2">{exec.actualResult}</pre>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No execution history yet. Click &quot;Start a New Test Execution&quot; to begin.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Steps content
// ---------------------------------------------------------------------------

function StepsContent({
  exec,
  steps,
  updatingStep,
  onUpdateStepStatus,
}: {
  exec: TestCaseExecution;
  steps: TestCaseExecution["testCaseVersion"]["steps"];
  updatingStep: string | null;
  onUpdateStepStatus: (execId: string, stepId: string, status: ExecStatus) => Promise<void>;
}) {
  const [preconditionOpen, setPreconditionOpen] = useState(true);
  const tc = exec.testCaseVersion?.testCase;

  if (steps.length === 0) {
    return (
    <div data-testid="cycles-detail-page" className="px-5 py-12 text-center text-sm text-muted-foreground">
        No steps defined for this test case.
      </div>
    );
  }

  return (
    <div data-testid="cycles-detail-page" className="px-5 py-4 space-y-3">
      {/* Precondition */}
      {tc?.description && (
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-muted/30 hover:bg-muted/50 transition-colors"
            onClick={() => setPreconditionOpen((p) => !p)}
          >
            {preconditionOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Precondition
          </button>
          {preconditionOpen && (
            <div className="px-4 py-3 text-sm text-muted-foreground">{tc.description}</div>
          )}
        </div>
      )}

      {/* Step count */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">1 - {steps.length} Of {steps.length}</span>
        <RefreshCw className="h-3.5 w-3.5 text-muted-foreground cursor-pointer hover:text-foreground" />
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, idx) => {
          const stepExec = exec.stepExecutions.find((se) => se.testStepId === step.id);
          const stepStatus: ExecStatus = stepExec?.status ?? "NOT_RUN";
          const isNotExecuted = stepStatus === "NOT_RUN" && stepExec?.actualResult?.includes("Test execution stopped");
          const stepKey = `${exec.id}-${step.id}`;
          const executedByName = exec.executedBy?.name ?? exec.assignee?.name;
          const executedAt = formatDate(exec.executedAt ?? undefined);

          return (
    <div data-testid="cycles-detail-page" key={step.id} className="border border-border rounded-lg overflow-hidden">
              {/* Step header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20 border-b border-border">
                <span className="text-sm font-semibold">Step {idx + 1}</span>
                <div className="flex items-center gap-1.5">
                  {/* Status color squares */}
                  {(["PASS", "FAIL", "BLOCKED", "NOT_RUN"] as ExecStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => onUpdateStepStatus(exec.id, step.id, s)}
                      disabled={updatingStep === stepKey}
                      title={STATUS_LABELS[s]}
                      className={cn(
                        "h-5 w-5 rounded-sm border transition-colors",
                        stepStatus === s ? "border-transparent" : "border-gray-300 bg-white hover:opacity-80"
                      )}
                      style={stepStatus === s ? { backgroundColor: STATUS_DOT_COLOR[s] } : {}}
                    />
                  ))}
                  {isNotExecuted ? (
                    <span className="text-xs font-semibold text-amber-600">NOT_EXECUTED</span>
                  ) : stepStatus !== "NOT_RUN" && (
                    <span
                      className="text-xs font-semibold"
                      style={{ color: STATUS_DOT_COLOR[stepStatus] }}
                    >
                      {STATUS_LABELS[stepStatus]}
                    </span>
                  )}
                  {updatingStep === stepKey && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>
              </div>

              {/* Executed by / on */}
              {(executedByName || executedAt) && (
                <div className="px-4 py-1.5 text-[11px] text-muted-foreground border-b border-border/50 bg-muted/10">
                  {executedByName && <span>Executed By: <span className="text-blue-600 font-medium">{executedByName}</span></span>}
                  {executedByName && executedAt && <span className="mx-2">•</span>}
                  {executedAt && <span>Executed On: {executedAt}</span>}
                </div>
              )}

              {/* 3-column step content */}
              <div className="grid grid-cols-3 divide-x divide-border">
                <div className="px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">Step Summary</p>
                  <p className="text-sm">{step.stepDetails}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">Test Data</p>
                  <p className="text-sm text-muted-foreground">{step.testData || "—"}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">Expected Result</p>
                  <p className="text-sm text-muted-foreground">{step.expectedResult || "—"}</p>
                </div>
              </div>

              {/* Actual Result */}
              {stepExec?.actualResult && (
                <div className="px-4 py-3 border-t border-border bg-red-50/50">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">Actual Result</p>
                  <pre className="text-xs text-red-700 whitespace-pre-wrap font-mono">{stepExec.actualResult}</pre>
                </div>
              )}

              {/* Comments */}
              {stepExec?.comment && (
                <div className="px-4 py-3 border-t border-border">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">Comments</p>
                  <p className="text-xs text-muted-foreground">{stepExec.comment}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Details tab (read-only test case view)
// ---------------------------------------------------------------------------

function DetailsTab({
  exec,
  steps,
}: {
  exec: TestCaseExecution;
  steps: TestCaseExecution["testCaseVersion"]["steps"];
}) {
  const tc = exec.testCaseVersion?.testCase;

  return (
    <div data-testid="cycles-detail-page" className="px-5 py-5 space-y-5">
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Summary</p>
        <p className="text-sm">{tc?.summary || "External automation result"}</p>
      </div>
      {tc?.description && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Description / Precondition</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tc.description}</p>
        </div>
      )}
      {tc?.priority && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Priority</p>
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ color: tc.priority.color, backgroundColor: `${tc.priority.color}20` }}
          >
            {tc.priority.name}
          </span>
        </div>
      )}
      {steps.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">Steps ({steps.length})</p>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-10">#</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Step Summary</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-40 hidden md:table-cell">Test Data</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-40 hidden md:table-cell">Expected Result</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {steps.map((step) => (
                  <tr key={step.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{step.order}</td>
                    <td className="px-4 py-3">{step.stepDetails}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs font-mono">{step.testData || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{step.expectedResult || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Test Cases Panel (folder navigation + shift-click selection)
// ---------------------------------------------------------------------------

interface TCBasic { id: string; key: string; summary: string; folderId?: string | null; status: string; }
interface FolderBasic { id: string; name: string; parentId: string | null; children: FolderBasic[]; }

function AddTestCasesPanel({
  cycleId,
  projectId,
  onClose,
  onAdded,
}: {
  cycleId: string;
  projectId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [folders, setFolders] = useState<FolderBasic[]>([]);
  const [testCases, setTestCases] = useState<TCBasic[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastIdx, setLastIdx] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/folders?projectId=${projectId}&type=CASE`).then((r) => r.json()).then((d) => setFolders(Array.isArray(d) ? d : []));
    fetch(`/api/testcases?projectId=${projectId}`).then((r) => r.json()).then((d) => setTestCases(Array.isArray(d) ? d : []));
  }, [projectId]);

  const filtered = testCases.filter((tc) => {
    const matchFolder = selectedFolderId ? tc.folderId === selectedFolderId : true;
    const matchQuery = !query || (tc?.summary || "").toLowerCase().includes(query.toLowerCase()) || (tc?.key || "").toLowerCase().includes(query.toLowerCase());
    return matchFolder && matchQuery && tc.status !== "DEPRECATED";
  });

  function toggleSelect(id: string, idx: number, shiftKey: boolean) {
    if (shiftKey && lastIdx !== null) {
      const lo = Math.min(lastIdx, idx);
      const hi = Math.max(lastIdx, idx);
      const rangeIds = filtered.slice(lo, hi + 1).map((tc) => tc.id);
      setSelectedIds((prev) => { const next = new Set(prev); rangeIds.forEach((rid) => next.add(rid)); return next; });
    } else {
      setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
      setLastIdx(idx);
    }
  }

  async function addSelected() {
    if (!selectedIds.size) return;
    setAdding(true);
    for (const tcId of selectedIds) {
      await fetch(`/api/testcycles/${cycleId}/testcases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testCaseId: tcId }),
      });
    }
    setAdding(false);
    onAdded();
  }

  function FolderNode({ node, depth }: { node: FolderBasic; depth: number }) {
    const [open, setOpen] = useState(true);
    return (
    <div data-testid="cycles-detail-page">
        <div
          className={cn(
            "flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors select-none",
            selectedFolderId === node.id ? "bg-brand-50 text-brand-700 font-medium" : "hover:bg-muted/50"
          )}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onClick={() => setSelectedFolderId(node.id)}
        >
          {node.children.length > 0 ? (
            <button className="shrink-0 text-muted-foreground" onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); }}>
              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          ) : <span className="w-3 shrink-0" />}
          {open && node.children.length > 0
            ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            : <FolderIcon className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
          <span className="flex-1 truncate text-xs">{node.name}</span>
        </div>
        {open && node.children.map((child) => <FolderNode key={child.id} node={child} depth={depth + 1} />)}
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 bg-background border-l border-border flex flex-col shadow-2xl w-[640px]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="font-semibold text-base">Add Test Cases to Cycle</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          {/* Folder tree */}
          <aside className="w-[180px] shrink-0 border-r border-border overflow-y-auto p-2">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide px-2 py-1.5">Folders</p>
            <div
              className={cn("flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer text-xs transition-colors", !selectedFolderId ? "bg-brand-50 text-brand-700 font-medium" : "hover:bg-muted/50")}
              onClick={() => setSelectedFolderId(null)}
            >
              All Test Cases
            </div>
            {folders.map((node) => <FolderNode key={node.id} node={node} depth={0} />)}
          </aside>
          {/* Test case list */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border shrink-0 relative">
              <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search test cases..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                  No test cases found.
                </div>
              ) : (
                filtered.map((tc, idx) => (
                  <label
                    key={tc.id}
                    className={cn("flex items-center gap-3 px-4 py-2.5 border-b border-border/50 cursor-pointer transition-colors", selectedIds.has(tc.id) ? "bg-brand-50" : "hover:bg-muted/20")}
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-border cursor-pointer"
                      checked={selectedIds.has(tc.id)}
                      onChange={(e) => toggleSelect(tc.id, idx, e.nativeEvent instanceof MouseEvent && (e.nativeEvent as MouseEvent).shiftKey)}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-mono font-bold text-blue-600 mr-2">{tc?.key || "External"}</span>
                      <span className="text-xs truncate">{tc?.summary || "External automation result"}</span>
                    </div>
                  </label>
                ))
              )}
            </div>
            <div className="px-4 py-3 border-t border-border shrink-0 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {selectedIds.size > 0 ? `${selectedIds.size} selected — Shift+click to select a range` : "Click checkboxes to select. Shift+click for ranges."}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
                <Button size="sm" onClick={addSelected} disabled={!selectedIds.size || adding}>
                  {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  Add {selectedIds.size > 0 ? `${selectedIds.size} ` : ""}Test Case{selectedIds.size !== 1 ? "s" : ""}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
