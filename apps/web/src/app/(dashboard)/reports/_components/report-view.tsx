"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, X, ChevronDown } from "lucide-react";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Legend, AreaChart, Area,
} from "recharts";
import type { ReportType } from "./sidebar";

// ─── Metadata ────────────────────────────────────────────────────────────────

const META: Record<ReportType, { section: string; group?: string; label: string; apiType: string; hasTimeframe?: true }> = {
  overview:                { section: "Test Execution Reports", label: "Overview",                  apiType: "summary" },
  "tc-by-status":          { section: "Test Case Reports",     group: "Test Case Summary",          label: "By Workflow Status",       apiType: "tc-by-status" },
  "tc-by-priority":        { section: "Test Case Reports",     group: "Test Case Summary",          label: "By Priority",              apiType: "tc-by-priority" },
  "tc-by-component":       { section: "Test Case Reports",     group: "Test Case Summary",          label: "By Component",             apiType: "tc-by-component" },
  "tc-by-label":           { section: "Test Case Reports",     group: "Test Case Summary",          label: "By Label",                 apiType: "tc-by-label" },
  "tc-by-assignee":        { section: "Test Case Reports",     group: "Test Case Summary",          label: "By Assignee",              apiType: "executors" },
  "tc-by-timeframe":       { section: "Test Case Reports",     group: "Test Case Summary",          label: "By Time Frame",            apiType: "tc-by-timeframe",  hasTimeframe: true },
  "tc-manual-vs-automated":{ section: "Test Case Reports",     label: "Manual Vs Automated",        apiType: "tc-manual-vs-automated" },
  "tc-planned-vs-not":     { section: "Test Case Reports",     label: "Planned Vs Not-planned",     apiType: "tc-planned-vs-not" },
  "exec-by-cycle":         { section: "Test Execution Reports",group: "Execution Summary",          label: "By Test Cycle",            apiType: "cycles" },
  "exec-by-environment":   { section: "Test Execution Reports",group: "Execution Summary",          label: "By Environment",           apiType: "exec-by-environment" },
  "exec-by-build":         { section: "Test Execution Reports",group: "Execution Summary",          label: "By Build",                 apiType: "exec-by-build" },
  "exec-by-assignee":      { section: "Test Execution Reports",group: "Execution Summary",          label: "By Execution Assignee",    apiType: "executors" },
  "exec-by-requirement":   { section: "Test Execution Reports",group: "Execution Summary",          label: "By Requirement",           apiType: "coverage" },
  "exec-by-timeframe":     { section: "Test Execution Reports",group: "Execution Summary",          label: "By Time Frame",            apiType: "exec-by-timeframe",  hasTimeframe: true },
};

// Reports that show the TC filter form (by-status through tc-planned-vs-not)
const TC_FILTER_REPORTS: ReportType[] = [
  "tc-by-status", "tc-by-priority", "tc-by-component", "tc-by-label",
  "tc-by-assignee", "tc-by-timeframe", "tc-manual-vs-automated", "tc-planned-vs-not",
];

// Reports where the Test Case Versions filter is hidden
const NO_VERSIONS_FILTER: ReportType[] = ["tc-manual-vs-automated"];

// ─── Filter By checkboxes ─────────────────────────────────────────────────────

const FILTER_BY_OPTIONS = [
  { id: "execution",   label: "Execution" },
  { id: "testCycle",   label: "Test Cycle" },
  { id: "testPlan",    label: "Test Plan" },
  { id: "requirement", label: "Requirement" },
  { id: "defect",      label: "Defect" },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface FilterOptions {
  statuses:   { value: string; label: string }[];
  priorities: { id: string; name: string; color: string | null }[];
  components: { id: string; name: string }[];
  labels:     { id: string; name: string; color: string | null }[];
}

type CriterionField = "status" | "priority" | "component" | "label";

interface Criterion {
  field:  CriterionField;
  values: string[];
}

interface GroupedRow   { name: string; count: number; color?: string | null }
interface ExecRow      { name: string; pass: number; fail: number; blocked: number; notRun: number; total: number; passRate: number; key?: string; status?: string; createdBy?: string }
interface TimeframeRow { date: string; count?: number; pass?: number; fail?: number; total?: number; passRate?: number }
interface ExecutorRow  { name: string; email: string; pass: number; fail: number; blocked: number; skipped: number; total: number }
interface CoverageReq  { key: string; totalCases: number; pass: number; fail: number; blocked: number; notRun: number; coveragePct: number }

// ─── Colour palette ───────────────────────────────────────────────────────────

const PALETTE = [
  "hsl(215, 70%, 55%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",   "hsl(270, 60%, 55%)", "hsl(185, 65%, 45%)",
  "hsl(25, 85%, 55%)",  "hsl(340, 70%, 55%)",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── CriterionRow ─────────────────────────────────────────────────────────────

interface CriterionRowProps {
  criterion:     Criterion;
  filterOptions: FilterOptions;
  onChange:      (c: Criterion) => void;
  onRemove:      () => void;
}

function CriterionRow({ criterion, filterOptions, onChange, onRemove }: CriterionRowProps) {
  const [valuesOpen, setValuesOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setValuesOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const fieldOptions: { value: CriterionField; label: string }[] = [
    { value: "status",    label: "Status" },
    { value: "priority",  label: "Priority" },
    { value: "component", label: "Component" },
    { value: "label",     label: "Label" },
  ];

  function getValueOptions(): { id: string; label: string }[] {
    switch (criterion.field) {
      case "status":    return filterOptions.statuses.map(s => ({ id: s.value, label: s.label }));
      case "priority":  return filterOptions.priorities.map(p => ({ id: p.id, label: p.name }));
      case "component": return filterOptions.components.map(c => ({ id: c.id, label: c.name }));
      case "label":     return filterOptions.labels.map(l => ({ id: l.id, label: l.name }));
    }
  }

  function toggleValue(id: string) {
    const next = criterion.values.includes(id)
      ? criterion.values.filter(v => v !== id)
      : [...criterion.values, id];
    onChange({ ...criterion, values: next });
  }

  const valueOptions = getValueOptions();

  function displayLabel() {
    if (criterion.values.length === 0) return "All";
    if (criterion.values.length === 1) {
      const found = valueOptions.find(o => o.id === criterion.values[0]);
      return found?.label ?? criterion.values[0];
    }
    return `${criterion.values.length} selected`;
  }

  return (
    <div className="flex items-center gap-2 mb-2">
      {/* Field selector */}
      <select
        value={criterion.field}
        onChange={e => onChange({ field: e.target.value as CriterionField, values: [] })}
        className="text-sm border rounded px-2 py-1.5 bg-background min-w-[120px]"
      >
        {fieldOptions.map(f => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>

      {/* Value multiselect */}
      <div className="relative" ref={dropRef}>
        <button
          type="button"
          onClick={() => setValuesOpen(o => !o)}
          className="flex items-center gap-1.5 text-sm border rounded px-2 py-1.5 bg-background min-w-[160px] text-left"
        >
          <span className="flex-1 truncate">{displayLabel()}</span>
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        </button>
        {valuesOpen && (
          <div className="absolute z-50 top-full mt-1 left-0 w-56 border rounded-lg shadow-lg bg-popover py-1 max-h-52 overflow-y-auto">
            {valueOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-2">No options available</p>
            ) : (
              valueOptions.map(opt => (
                <label
                  key={opt.id}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={criterion.values.includes(opt.id)}
                    onChange={() => toggleValue(opt.id)}
                    className="rounded"
                  />
                  {opt.label}
                </label>
              ))
            )}
          </div>
        )}
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive p-0.5"
        aria-label="Remove criterion"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── TimeframeSection ─────────────────────────────────────────────────────────

interface TimeframeSectionProps {
  granularity: "daily" | "weekly" | "monthly" | "yearly";
  from:        string;
  to:          string;
  onGranularity: (g: "daily" | "weekly" | "monthly" | "yearly") => void;
  onFrom:      (v: string) => void;
  onTo:        (v: string) => void;
}

function TimeframeSection({ granularity, from, to, onGranularity, onFrom, onTo }: TimeframeSectionProps) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <p className="text-sm font-semibold">By Timeframe</p>
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Test Case</p>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">View By</p>
          <div className="flex flex-wrap gap-4">
            {(["daily", "weekly", "monthly", "yearly"] as const).map(g => (
              <label key={g} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="granularity"
                  checked={granularity === g}
                  onChange={() => onGranularity(g)}
                />
                {capitalize(g)}
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-3 items-end">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Created On</p>
            <div className="text-sm border rounded px-3 py-1.5 bg-muted/30 text-muted-foreground select-none">
              Created On
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">From</p>
            <input
              type="date"
              value={from}
              onChange={e => onFrom(e.target.value)}
              className="text-sm border rounded px-2 py-1.5 bg-background"
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">To</p>
            <input
              type="date"
              value={to}
              onChange={e => onTo(e.target.value)}
              className="text-sm border rounded px-2 py-1.5 bg-background"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ReportViewProps {
  reportType: ReportType;
  projectId:  string;
}

export function ReportView({ reportType, projectId }: ReportViewProps) {
  const meta          = META[reportType];
  const isTcReport    = TC_FILTER_REPORTS.includes(reportType);
  const isTimeframe   = meta.hasTimeframe === true && reportType === "tc-by-timeframe";
  const showVersions  = isTcReport && !NO_VERSIONS_FILTER.includes(reportType);

  // ── Filter options loaded from API ────────────────────────────────────────
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);

  useEffect(() => {
    if (!isTcReport) return;
    fetch(`/api/reports/${projectId}?type=filter-options`)
      .then(r => r.json())
      .then(setFilterOptions)
      .catch(console.error);
  }, [projectId, isTcReport]);

  // ── Filter By checkboxes (UI only for now) ────────────────────────────────
  const [filterBy, setFilterBy] = useState<Record<string, boolean>>({
    execution: false, testCycle: false, testPlan: false, requirement: false, defect: false,
  });

  // ── Criteria rows ─────────────────────────────────────────────────────────
  const [criteria, setCriteria] = useState<Criterion[]>([]);

  function addCriterion() {
    setCriteria(prev => [...prev, { field: "status", values: [] }]);
  }

  function updateCriterion(i: number, c: Criterion) {
    setCriteria(prev => prev.map((x, idx) => idx === i ? c : x));
  }

  function removeCriterion(i: number) {
    setCriteria(prev => prev.filter((_, idx) => idx !== i));
  }

  // ── Versions & Timeframe ──────────────────────────────────────────────────
  const [latestVersionOnly, setLatestVersionOnly] = useState(true);
  const [isArchived, setIsArchived] = useState(false);
  const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly" | "yearly">("daily");
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  const [from, setFrom] = useState(defaultFrom.toISOString().slice(0, 10));
  const [to, setTo]     = useState(new Date().toISOString().slice(0, 10));
  // ── Data / loading state ──────────────────────────────────────────────────
  const [data, setData]             = useState<unknown>(null);
  const [loading, setLoading]       = useState(false);
  const [generated, setGenerated]   = useState(false);

  const searchParams = useSearchParams();

  // Load parameters from URL on page mount
  useEffect(() => {
    if (!searchParams) return;

    const isArchivedParam = searchParams.get("isArchived");
    if (isArchivedParam !== null) {
      setIsArchived(isArchivedParam === "true");
    }

    const latestVersionOnlyParam = searchParams.get("latestVersionOnly");
    if (latestVersionOnlyParam !== null) {
      setLatestVersionOnly(latestVersionOnlyParam === "true");
    }

    const fromParam = searchParams.get("fromDate");
    const toParam = searchParams.get("toDate");
    if (fromParam) setFrom(fromParam);
    if (toParam) setTo(toParam);

    const granularityParam = searchParams.get("granularity");
    if (granularityParam && ["daily", "weekly", "monthly", "yearly"].includes(granularityParam)) {
      setGranularity(granularityParam as "daily" | "weekly" | "monthly" | "yearly");
    }
  }, [searchParams]);

  // Update URL when parameters change
  useEffect(() => {
    // Preserve existing query parameters (like projectId)
    const params = new URLSearchParams(window.location.search);

    // Update report-specific parameters
    if (isArchived) {
      params.set("isArchived", "true");
    } else {
      params.delete("isArchived");
    }

    if (latestVersionOnly) {
      params.set("latestVersionOnly", "true");
    } else {
      params.delete("latestVersionOnly");
    }

    if (from) params.set("fromDate", from);
    else params.delete("fromDate");

    if (to) params.set("toDate", to);
    else params.delete("toDate");

    if (granularity) params.set("granularity", granularity);
    else params.delete("granularity");

    const queryString = params.toString();
    const url = queryString ? `?${queryString}` : window.location.pathname;
    window.history.replaceState({}, "", url);
  }, [isArchived, latestVersionOnly, from, to, granularity]);

  // Reset results when report type changes
  useEffect(() => {
    setData(null);
    setGenerated(false);
    setCriteria([]);
  }, [reportType]);

  // ── Generate ──────────────────────────────────────────────────────────────
  async function generate() {
    setLoading(true);
    setGenerated(false);

    const params = new URLSearchParams({ type: meta.apiType });

    if (isTcReport) {
      // statuses
      const statusCrit = criteria.filter(c => c.field === "status").flatMap(c => c.values);
      if (statusCrit.length > 0) params.set("statuses", statusCrit.join(","));

      // priorityIds
      const priorityCrit = criteria.filter(c => c.field === "priority").flatMap(c => c.values);
      if (priorityCrit.length > 0) params.set("priorityIds", priorityCrit.join(","));

      // componentIds
      const componentCrit = criteria.filter(c => c.field === "component").flatMap(c => c.values);
      if (componentCrit.length > 0) params.set("componentIds", componentCrit.join(","));

      // labelIds
      const labelCrit = criteria.filter(c => c.field === "label").flatMap(c => c.values);
      if (labelCrit.length > 0) params.set("labelIds", labelCrit.join(","));

      // latestVersionOnly (pass through for future server use)
      params.set("latestVersionOnly", String(latestVersionOnly));

      // isArchived
      params.set("isArchived", String(isArchived));

      // filterBy (advanced options)
      const filterByEntries = Object.entries(filterBy).filter(([_, v]) => v === true);
      if (filterByEntries.length > 0) {
        filterByEntries.forEach(([key, _]) => {
          params.set(`filterBy[${key}]`, 'true');
        });
      }
    }

    if (meta.hasTimeframe) {
      params.set("fromDate", from);
      params.set("toDate", to);
      params.set("granularity", granularity);
    }

    const res  = await fetch(`/api/reports/${projectId}?${params.toString()}`);
    if (!res.ok) {
      const error = await res.json();
      setData({ error: error.message || "Failed to generate report" });
      setLoading(false);
      setGenerated(true);
      return;
    }
    const json = await res.json();
    setData(json);
    setLoading(false);
    setGenerated(true);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Breadcrumb */}
      <div className="text-sm text-muted-foreground">
        <span>Reports</span>
        <span className="mx-1.5">›</span>
        <span>{meta.section}</span>
        {meta.group && (
          <>
            <span className="mx-1.5">›</span>
            <span>{meta.group}</span>
          </>
        )}
        <span className="mx-1.5">›</span>
        <span className="text-foreground font-medium">{meta.label}</span>
      </div>

      {/* ── TC Summary filter form ── */}
      {isTcReport ? (
        <div className="space-y-5 p-4 bg-muted/30 border rounded-lg">
          {/* Filter By */}
          <div>
            <p className="text-sm font-medium mb-2">Filter By</p>
            <div className="flex flex-wrap gap-4">
              {FILTER_BY_OPTIONS.map(opt => (
                <label key={opt.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterBy[opt.id] ?? false}
                    onChange={e => {
                      setFilterBy(prev => ({ ...prev, [opt.id]: e.target.checked }));
                    }}
                    className="rounded"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* By Timeframe — only for tc-by-timeframe */}
          {isTimeframe && (
            <TimeframeSection
              granularity={granularity}
              from={from}
              to={to}
              onGranularity={setGranularity}
              onFrom={setFrom}
              onTo={setTo}
            />
          )}

          {/* Test Case criteria */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Test Case</p>
              <button
                type="button"
                onClick={() => setCriteria([])}
                className="text-xs text-blue-600 hover:underline"
              >
                Clear All
              </button>
            </div>

            {filterOptions ? (
              <>
                {criteria.map((c, i) => (
                  <CriterionRow
                    key={i}
                    criterion={c}
                    filterOptions={filterOptions}
                    onChange={updated => updateCriterion(i, updated)}
                    onRemove={() => removeCriterion(i)}
                  />
                ))}
                <button
                  type="button"
                  onClick={addCriterion}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:underline mt-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Criteria
                </button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Loading filter options…</p>
            )}
          </div>

          {/* Test Case Versions */}
          {showVersions && (
            <div>
              <p className="text-sm font-medium mb-2">Test Case Versions</p>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name={`version-${reportType}`}
                    checked={latestVersionOnly}
                    onChange={() => setLatestVersionOnly(true)}
                  />
                  Show Latest Version
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name={`version-${reportType}`}
                    checked={!latestVersionOnly}
                    onChange={() => setLatestVersionOnly(false)}
                  />
                  Show All Version(s)
                </label>
              </div>
            </div>
          )}

          {/* Archived */}
          <div>
            <p className="text-sm font-medium mb-2">Archived Test Case(s)</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isArchived} onChange={e => setIsArchived(e.target.checked)} className="rounded" />
              <span>Include Archived Test Case(s)</span>
            </label>
          </div>

          <Button onClick={generate} disabled={loading}>
            {loading ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Generating…</> : "Generate"}
          </Button>
        </div>
      ) : (
        /* ── Simple filter panel for non-TC reports ── */
        <div className="flex flex-wrap items-end gap-4 p-4 bg-muted/30 border rounded-lg">
          {meta.hasTimeframe && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">From</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="block text-sm border rounded-md px-2 py-1.5 bg-background"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">To</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="block text-sm border rounded-md px-2 py-1.5 bg-background"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">View By</label>
                <div className="flex gap-1">
                  {(["daily", "weekly", "monthly"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGranularity(g)}
                      className={`px-2 py-1 text-xs rounded border capitalize ${
                        granularity === g ? "bg-brand-500 text-white border-brand-500" : "bg-background border-border"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          <Button onClick={generate} disabled={loading} size="sm">
            {loading ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Generating…</> : "Generate"}
          </Button>
        </div>
      )}

      {/* Results */}
      {generated && !loading && <Results reportType={reportType} projectId={projectId} data={data} />}
    </div>
  );
}

// ─── Results dispatcher ───────────────────────────────────────────────────────

function Results({ reportType, projectId, data }: { reportType: ReportType; projectId: string; data: unknown }) {
  const [exporting, setExporting] = useState(false);

  async function handleExport(format: 'csv' | 'pdf' | 'json') {
    setExporting(true);
    try {
      const { exportReport, generateFilename } = await import('@/lib/export-utils');
      const filename = generateFilename(`report-${reportType}`, true);

      let rows: any[] = [];
      if (Array.isArray(data)) {
        rows = data;
      } else if (data && typeof data === 'object' && !('error' in data)) {
        rows = Object.values(data).flat();
      }

      await exportReport(
        {
          type: reportType,
          title: reportType.replace(/-/g, ' '),
          generatedAt: new Date().toISOString(),
          parameters: { projectId, reportType },
          rows,
        },
        format,
        filename,
        format === 'pdf'
      );
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  // Error handling
  if (data && typeof data === 'object' && 'error' in data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-start gap-3">
          <div className="text-red-600 font-semibold">Error</div>
          <div className="flex-1">
            <p className="text-sm text-red-700">{(data as any).error}</p>
            <p className="text-xs text-red-600 mt-2">Please check your filters and try again.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return <Empty />;

  const showExportButtons = data && typeof data === 'object' && !('error' in data);
  const exportUI = showExportButtons ? (
    <div className="flex gap-2 mb-4">
      <button
        onClick={() => handleExport('csv')}
        disabled={exporting}
        className="px-3 py-1.5 text-sm border rounded hover:bg-muted disabled:opacity-50"
      >
        {exporting ? 'Exporting...' : 'CSV'}
      </button>
      <button
        onClick={() => handleExport('json')}
        disabled={exporting}
        className="px-3 py-1.5 text-sm border rounded hover:bg-muted disabled:opacity-50"
      >
        {exporting ? 'Exporting...' : 'JSON'}
      </button>
    </div>
  ) : null;

  // Grouped bar: simple {name, count}[] reports
  if (["tc-by-status", "tc-by-priority", "tc-by-component", "tc-by-label"].includes(reportType)) {
    const rows = data as GroupedRow[];
    if (!rows.length) return <Empty />;
    return <div>{exportUI}<GroupedBarResult rows={rows} /></div>;
  }

  // Donut: two-slice reports
  if (["tc-manual-vs-automated", "tc-planned-vs-not"].includes(reportType)) {
    const rows = data as GroupedRow[];
    if (!rows.length) return <Empty />;
    return <div>{exportUI}<DonutResult rows={rows} /></div>;
  }

  // Timeframe: tc creation over time
  if (reportType === "tc-by-timeframe") {
    const rows = data as TimeframeRow[];
    if (!rows.length) return <Empty message="No test cases found in this date range." />;
    return <div>{exportUI}<TimeframeCountResult rows={rows} label="Test Cases Created" /></div>;
  }

  // Timeframe: execution over time
  if (reportType === "exec-by-timeframe") {
    const rows = data as TimeframeRow[];
    if (!rows.length) return <Empty message="No executions found in this date range." />;
    return <div>{exportUI}<TimeframeExecResult rows={rows} /></div>;
  }

  // By Assignee (TC Summary) → same as executors
  if (reportType === "tc-by-assignee" || reportType === "exec-by-assignee") {
    const d = data as { executors: ExecutorRow[] };
    const rows = d?.executors ?? [];
    if (!rows.length) return <Empty />;
    return <div>{exportUI}<ExecutorTableResult rows={rows} /></div>;
  }

  // Exec by cycle
  if (reportType === "exec-by-cycle") {
    const rows = data as ExecRow[];
    if (!rows.length) return <Empty />;
    return <div>{exportUI}<ExecutionTableResult rows={rows} showKey /></div>;
  }

  // Exec by environment / build
  if (reportType === "exec-by-environment" || reportType === "exec-by-build") {
    const rows = data as ExecRow[];
    if (!rows.length) return <Empty message="No data. Assign environments/builds to test cycles first." />;
    return <div>{exportUI}<ExecutionTableResult rows={rows} /></div>;
  }

  // Coverage / requirement
  if (reportType === "exec-by-requirement") {
    const d = data as { requirements: CoverageReq[] };
    const rows = d?.requirements ?? [];
    if (!rows.length) return <Empty message="No test cases linked to JIRA requirements." />;
    return <div>{exportUI}<CoverageTableResult rows={rows} /></div>;
  }

  return <Empty />;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Empty({ message = "No data available." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center h-40 text-sm text-muted-foreground border rounded-lg bg-muted/20">
      {message}
    </div>
  );
}

function GroupedBarResult({ rows }: { rows: GroupedRow[] }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  const chartData = rows.map((r, i) => ({
    name: r.name,
    count: r.count,
    fill: r.color ?? PALETTE[i % PALETTE.length],
  }));

  return (
    <div className="space-y-5">
      <div className="border rounded-lg p-4">
        <ResponsiveContainer width="100%" height={Math.max(180, rows.length * 36)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Count</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">%</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-muted/20">
                <td className="px-4 py-2.5 flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ background: r.color ?? PALETTE[i % PALETTE.length] }}
                  />
                  {r.name}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.count}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {total > 0 ? Math.round((r.count / total) * 100) : 0}%
                </td>
              </tr>
            ))}
            <tr className="bg-muted/30 font-medium">
              <td className="px-4 py-2.5">Total</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{total}</td>
              <td className="px-4 py-2.5 text-right text-muted-foreground">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const DONUT_COLORS = ["hsl(215, 70%, 55%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)"];

function DonutResult({ rows }: { rows: GroupedRow[] }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  const chartData = rows.map((r, i) => ({ name: r.name, value: r.count, fill: DONUT_COLORS[i % DONUT_COLORS.length] }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="border rounded-lg p-4 flex items-center justify-center">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={3}
              label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
              labelLine={false}
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => [v, "Count"]} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-lg border overflow-hidden self-start">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Category</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Count</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r, i) => {
              const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
              return (
                <tr key={i} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5 flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                    {r.name}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.count}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                      </div>
                      <span className="text-xs w-8 text-right text-muted-foreground">{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TimeframeCountResult({ rows, label }: { rows: TimeframeRow[]; label: string }) {
  return (
    <div className="space-y-5">
      <div className="border rounded-lg p-4">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={rows}>
            <defs>
              <linearGradient id="tcGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="hsl(215, 70%, 55%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(215, 70%, 55%)" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip />
            <Area type="monotone" dataKey="count" name={label} stroke="hsl(215, 70%, 55%)" fill="url(#tcGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Period</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">{label}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-muted/20">
                <td className="px-4 py-2.5 font-mono text-xs">{r.date}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TimeframeExecResult({ rows }: { rows: TimeframeRow[] }) {
  return (
    <div className="space-y-5">
      <div className="border rounded-lg p-4">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={rows}>
            <defs>
              <linearGradient id="passGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0}   />
              </linearGradient>
              <linearGradient id="failGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="hsl(0, 72%, 51%)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip />
            <Area type="monotone" dataKey="pass" name="Pass" stroke="hsl(142, 71%, 45%)" fill="url(#passGrad2)" strokeWidth={2} />
            <Area type="monotone" dataKey="fail" name="Fail" stroke="hsl(0, 72%, 51%)"   fill="url(#failGrad2)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Period</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Total</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-pass">Pass</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-fail">Fail</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-32">Pass Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-muted/20">
                <td className="px-4 py-2.5 font-mono text-xs">{r.date}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.total}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-pass">{r.pass}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-fail">{r.fail}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Progress value={r.passRate} className="h-1.5 flex-1" />
                    <span className="text-xs w-8 text-right">{r.passRate}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExecutionTableResult({ rows, showKey }: { rows: ExecRow[]; showKey?: boolean }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b">
          <tr>
            {showKey && <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-24">Key</th>}
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
            {showKey && <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>}
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Total</th>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-pass">Pass</th>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-fail">Fail</th>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Blocked</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-36">Pass Rate</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-muted/20">
              {showKey && <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{r.key}</td>}
              <td className="px-4 py-2.5 font-medium">{r.name}</td>
              {showKey && (
                <td className="px-4 py-2.5">
                  <Badge variant={r.status === "ACTIVE" ? "default" : "secondary"} className="text-xs">
                    {r.status}
                  </Badge>
                </td>
              )}
              <td className="px-4 py-2.5 text-right tabular-nums">{r.total}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-pass">{r.pass}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-fail">{r.fail}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{r.blocked}</td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Progress value={r.passRate} className="h-1.5 flex-1" />
                  <span className="text-xs w-8 text-right">{r.passRate}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExecutorTableResult({ rows }: { rows: ExecutorRow[] }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Email</th>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Total</th>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-pass">Pass</th>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-fail">Fail</th>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Blocked</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-36">Pass Rate</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((ex) => {
            const passRate = ex.total > 0 ? Math.round((ex.pass / ex.total) * 100) : 0;
            return (
              <tr key={ex.email} className="hover:bg-muted/20">
                <td className="px-4 py-2.5 font-medium">{ex.name}</td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">{ex.email}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{ex.total}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-pass">{ex.pass}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-fail">{ex.fail}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{ex.blocked}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Progress value={passRate} className="h-1.5 flex-1" />
                    <span className="text-xs w-8 text-right">{passRate}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CoverageTableResult({ rows }: { rows: CoverageReq[] }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">JIRA Key</th>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Cases</th>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-pass">Pass</th>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-fail">Fail</th>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Not Run</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-40">Coverage</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((req) => (
            <tr key={req.key} className="hover:bg-muted/20">
              <td className="px-4 py-2.5 font-mono text-xs font-medium text-blue-600">{req.key}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{req.totalCases}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-pass">{req.pass}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-fail">{req.fail}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{req.notRun}</td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Progress value={req.coveragePct} className="h-1.5 flex-1" />
                  <span className="text-xs w-8 text-right">{req.coveragePct}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
