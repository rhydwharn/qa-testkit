/**
 * Report Types and Parameters
 *
 * Comprehensive type definitions for report generation and parameterization.
 * All reports support customization through the ReportParameters interface.
 */

export type ReportType =
  | "overview"
  | "tc-by-status"
  | "tc-by-priority"
  | "tc-by-component"
  | "tc-by-label"
  | "tc-by-assignee"
  | "tc-by-timeframe"
  | "tc-manual-vs-automated"
  | "tc-planned-vs-not"
  | "exec-by-cycle"
  | "exec-by-environment"
  | "exec-by-build"
  | "exec-by-assignee"
  | "exec-by-requirement"
  | "exec-by-timeframe";

export type ExportFormat = "json" | "csv" | "pdf";
export type Granularity = "daily" | "weekly" | "monthly" | "yearly";

/**
 * Report Parameters - All customizable options for report generation
 *
 * Usage:
 * ```typescript
 * const params: ReportParameters = {
 *   projectId: "proj-123",
 *   reportType: "tc-by-status",
 *   statuses: ["DRAFT", "READY"],
 *   isArchived: false,
 *   latestVersionOnly: true
 * };
 * ```
 */
export interface ReportParameters {
  projectId: string;
  reportType: ReportType;

  // ─── Test Case Filters ─────────────────────────────────────────────────
  /** Filter by test case status: DRAFT, READY, DEPRECATED */
  statuses?: string[];

  /** Filter by priority IDs */
  priorityIds?: string[];

  /** Filter by component IDs */
  componentIds?: string[];

  /** Filter by label IDs */
  labelIds?: string[];

  /** Filter by assignee IDs */
  assigneeIds?: string[];

  // ─── Execution Filters ────────────────────────────────────────────────
  /** Filter by environment IDs */
  environmentIds?: string[];

  /** Filter by build IDs */
  buildIds?: string[];

  /** Filter by cycle IDs */
  cycleIds?: string[];

  /** Filter by plan IDs */
  planIds?: string[];

  /** Filter by requirement keys */
  requirementKeys?: string[];

  // ─── Date Range & Granularity ─────────────────────────────────────────
  /** Start date in ISO format (YYYY-MM-DD) */
  fromDate?: string;

  /** End date in ISO format (YYYY-MM-DD) */
  toDate?: string;

  /** Granularity for timeframe-based reports */
  granularity?: Granularity;

  // ─── Advanced Filters ─────────────────────────────────────────────────
  /**
   * Advanced filtering options - only applicable to certain report types
   */
  filterBy?: {
    /** Include execution metrics in test case reports */
    execution?: boolean;

    /** Group by test cycle (when applicable) */
    testCycle?: boolean;

    /** Group by test plan (when applicable) */
    testPlan?: boolean;

    /** Link to requirements (when applicable) */
    requirement?: boolean;

    /** Link to defects (when applicable) */
    defect?: boolean;
  };

  // ─── Options ────────────────────────────────────────────────────────────
  /** Include archived test cases */
  isArchived?: boolean;

  /** Show only latest version of test cases */
  latestVersionOnly?: boolean;

  // ─── Export Options ────────────────────────────────────────────────────
  /** Export format for report data */
  exportFormat?: ExportFormat;

  /** Custom file name for exported report */
  exportFileName?: string;

  /** Include chart images in PDF export (user preference) */
  includeCharts?: boolean;
}

/**
 * Report Data Structure - Used by all report types
 */
export interface ReportData {
  type: ReportType;
  title: string;
  description?: string;
  generatedAt: string;
  parameters: ReportParameters;
  rows: ReportRow[];
  chart?: ChartData;
  summary?: ReportSummary;
  error?: string;
}

/**
 * Generic report row for grouped reports
 */
export interface ReportRow {
  name: string;
  count?: number;
  pass?: number;
  fail?: number;
  blocked?: number;
  skipped?: number;
  notRun?: number;
  total?: number;
  passRate?: number;
  color?: string;
  // Additional dynamic fields
  [key: string]: unknown;
}

/**
 * Chart data structure for Recharts
 */
export interface ChartData {
  type: "bar" | "pie" | "area";
  data: any[];
  dataKey?: string;
  xAxisKey?: string;
  categories?: string[];
}

/**
 * Report summary statistics
 */
export interface ReportSummary {
  totalCount: number;
  passCount?: number;
  failCount?: number;
  blockedCount?: number;
  skippedCount?: number;
  notRunCount?: number;
  passRate?: number;
  averageValue?: number;
}

/**
 * Validation error for report parameters
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Report API response
 */
export interface ReportApiResponse {
  success: boolean;
  data?: ReportData;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}

/**
 * Export options configuration
 */
export interface ReportExportOptions {
  format: ExportFormat;
  fileName: string;
  includeMetadata: boolean;
  includeTimestamp: boolean;
  includeCharts: boolean;
}

/**
 * Report metadata for display and validation
 */
export interface ReportMetadata {
  type: ReportType;
  title: string;
  description: string;
  section: string;
  group?: string;
  supportedFilters: string[];
  supportsDateRange: boolean;
  supportsGranularity: boolean;
  supportsArchiveFilter: boolean;
  supportsVersionFilter: boolean;
  chartType: "bar" | "pie" | "area" | "table";
  apiType: string;
}

/**
 * Available filter options for UI dropdowns
 */
export interface FilterOptions {
  statuses: Array<{ id: string; label: string }>;
  priorities: Array<{ id: string; label: string }>;
  components: Array<{ id: string; label: string }>;
  labels: Array<{ id: string; label: string }>;
  assignees: Array<{ id: string; label: string; email?: string }>;
  environments: Array<{ id: string; label: string }>;
  builds: Array<{ id: string; label: string }>;
  cycles: Array<{ id: string; label: string }>;
  plans: Array<{ id: string; label: string }>;
}
