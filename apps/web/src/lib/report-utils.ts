/**
 * Report Utilities
 *
 * Helper functions for report generation, validation, and transformation.
 */

import type {
  ReportParameters,
  ReportType,
  ValidationResult,
  ValidationError,
  ReportData,
  ReportMetadata,
} from "@/types/reports";

/**
 * Validate report parameters before API call
 *
 * @param params - Report parameters to validate
 * @returns Validation result with errors if any
 *
 * @example
 * ```typescript
 * const result = validateReportParameters(params);
 * if (!result.isValid) {
 *   console.error(result.errors);
 * }
 * ```
 */
export function validateReportParameters(params: ReportParameters): ValidationResult {
  const errors: ValidationError[] = [];

  // Required fields
  if (!params.projectId?.trim()) {
    errors.push({ field: "projectId", message: "Project ID is required" });
  }

  if (!params.reportType) {
    errors.push({ field: "reportType", message: "Report type is required" });
  }

  // Date validation (only for reports with timeframe)
  const timeframeReports: ReportType[] = ["tc-by-timeframe", "exec-by-timeframe"];
  if (timeframeReports.includes(params.reportType)) {
    if (params.fromDate && params.toDate) {
      const from = new Date(params.fromDate);
      const to = new Date(params.toDate);

      if (isNaN(from.getTime())) {
        errors.push({
          field: "fromDate",
          message: "Invalid date format (use YYYY-MM-DD)",
          value: params.fromDate,
        });
      }

      if (isNaN(to.getTime())) {
        errors.push({
          field: "toDate",
          message: "Invalid date format (use YYYY-MM-DD)",
          value: params.toDate,
        });
      }

      if (!isNaN(from.getTime()) && !isNaN(to.getTime()) && from > to) {
        errors.push({
          field: "dateRange",
          message: "Start date (fromDate) must be before end date (toDate)",
        });
      }
    }

    if (params.granularity && !["daily", "weekly", "monthly", "yearly"].includes(params.granularity)) {
      errors.push({
        field: "granularity",
        message: "Invalid granularity. Must be one of: daily, weekly, monthly, yearly",
        value: params.granularity,
      });
    }
  }

  // Array parameters validation (should not be empty if provided)
  const arrayFields = [
    "statuses",
    "priorityIds",
    "componentIds",
    "labelIds",
    "assigneeIds",
    "environmentIds",
    "buildIds",
  ] as const;

  arrayFields.forEach((field) => {
    const value = params[field];
    if (Array.isArray(value) && value.length === 0) {
      errors.push({
        field,
        message: `${field} should not be empty if provided`,
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Build URL query string from parameters
 *
 * @param params - Report parameters
 * @returns URL query string
 *
 * @example
 * ```typescript
 * const query = buildQueryString(params);
 * const url = `/api/reports/${projectId}?${query}`;
 * ```
 */
export function buildQueryString(params: ReportParameters): string {
  const searchParams = new URLSearchParams();

  searchParams.set("type", params.reportType);

  // Array parameters - comma-separated
  if (params.statuses?.length) {
    searchParams.set("statuses", params.statuses.join(","));
  }
  if (params.priorityIds?.length) {
    searchParams.set("priorityIds", params.priorityIds.join(","));
  }
  if (params.componentIds?.length) {
    searchParams.set("componentIds", params.componentIds.join(","));
  }
  if (params.labelIds?.length) {
    searchParams.set("labelIds", params.labelIds.join(","));
  }
  if (params.assigneeIds?.length) {
    searchParams.set("assigneeIds", params.assigneeIds.join(","));
  }
  if (params.environmentIds?.length) {
    searchParams.set("environmentIds", params.environmentIds.join(","));
  }
  if (params.buildIds?.length) {
    searchParams.set("buildIds", params.buildIds.join(","));
  }

  // Date and granularity
  if (params.fromDate) {
    searchParams.set("fromDate", params.fromDate);
  }
  if (params.toDate) {
    searchParams.set("toDate", params.toDate);
  }
  if (params.granularity) {
    searchParams.set("granularity", params.granularity);
  }

  // Boolean flags
  if (params.isArchived !== undefined) {
    searchParams.set("isArchived", String(params.isArchived));
  }
  if (params.latestVersionOnly !== undefined) {
    searchParams.set("latestVersionOnly", String(params.latestVersionOnly));
  }

  // Advanced filters
  if (params.filterBy) {
    Object.entries(params.filterBy).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(`filterBy[${key}]`, String(value));
      }
    });
  }

  // Export options
  if (params.exportFormat) {
    searchParams.set("exportFormat", params.exportFormat);
  }
  if (params.exportFileName) {
    searchParams.set("exportFileName", params.exportFileName);
  }

  return searchParams.toString();
}

/**
 * Normalize and transform raw API response to consistent ReportData format
 *
 * @param rawData - Raw API response
 * @param reportType - Type of report
 * @param projectId - Project ID
 * @returns Normalized ReportData
 *
 * @example
 * ```typescript
 * const normalized = normalizeReportData(apiResponse, "tc-by-status", "proj-123");
 * ```
 */
export function normalizeReportData(rawData: any, reportType: ReportType, projectId: string): ReportData {
  if (!rawData) {
    return {
      type: reportType,
      title: "",
      generatedAt: new Date().toISOString(),
      parameters: { projectId, reportType },
      rows: [],
      error: "No data returned from server",
    };
  }

  // Calculate derived metrics
  const rows = Array.isArray(rawData) ? rawData : [];
  const summary = calculateSummary(rows);

  return {
    type: reportType,
    title: getReportMetadata(reportType)?.title || "",
    generatedAt: new Date().toISOString(),
    parameters: { projectId, reportType },
    rows,
    summary,
  };
}

/**
 * Calculate summary statistics from report rows
 *
 * @param rows - Report rows
 * @returns Summary statistics
 */
function calculateSummary(rows: any[]) {
  let totalCount = 0;
  let passCount = 0;
  let failCount = 0;
  let blockedCount = 0;
  let notRunCount = 0;

  rows.forEach((row) => {
    totalCount += row.count || row.total || 0;
    passCount += row.pass || 0;
    failCount += row.fail || 0;
    blockedCount += row.blocked || 0;
    notRunCount += row.notRun || 0;
  });

  const passRate = totalCount > 0 ? (passCount / totalCount) * 100 : 0;

  return {
    totalCount,
    passCount: passCount > 0 ? passCount : undefined,
    failCount: failCount > 0 ? failCount : undefined,
    blockedCount: blockedCount > 0 ? blockedCount : undefined,
    notRunCount: notRunCount > 0 ? notRunCount : undefined,
    passRate: passRate > 0 ? parseFloat(passRate.toFixed(1)) : undefined,
  };
}

/**
 * Get metadata for a report type
 *
 * @param reportType - Type of report
 * @returns Report metadata
 *
 * @example
 * ```typescript
 * const meta = getReportMetadata("tc-by-status");
 * console.log(meta.supportsDateRange); // false
 * console.log(meta.chartType); // "bar"
 * ```
 */
export function getReportMetadata(reportType: ReportType): ReportMetadata | null {
  const metadata: Record<ReportType, ReportMetadata> = {
    overview: {
      type: "overview",
      title: "Overview",
      description: "Dashboard overview with KPIs and trends",
      section: "Test Execution Reports",
      supportedFilters: [],
      supportsDateRange: false,
      supportsGranularity: false,
      supportsArchiveFilter: false,
      supportsVersionFilter: false,
      chartType: "table",
      apiType: "summary",
    },
    "tc-by-status": {
      type: "tc-by-status",
      title: "Test Cases by Workflow Status",
      description: "Test case count grouped by status (Draft, Ready, Deprecated)",
      section: "Test Case Reports",
      group: "Test Case Summary",
      supportedFilters: ["priorityIds", "componentIds", "labelIds"],
      supportsDateRange: false,
      supportsGranularity: false,
      supportsArchiveFilter: true,
      supportsVersionFilter: true,
      chartType: "bar",
      apiType: "tc-by-status",
    },
    "tc-by-priority": {
      type: "tc-by-priority",
      title: "Test Cases by Priority",
      description: "Test case count grouped by priority level",
      section: "Test Case Reports",
      group: "Test Case Summary",
      supportedFilters: ["componentIds", "labelIds"],
      supportsDateRange: false,
      supportsGranularity: false,
      supportsArchiveFilter: true,
      supportsVersionFilter: true,
      chartType: "bar",
      apiType: "tc-by-priority",
    },
    "tc-by-component": {
      type: "tc-by-component",
      title: "Test Cases by Component",
      description: "Test case count grouped by component",
      section: "Test Case Reports",
      group: "Test Case Summary",
      supportedFilters: ["statusIds", "priorityIds", "labelIds"],
      supportsDateRange: false,
      supportsGranularity: false,
      supportsArchiveFilter: true,
      supportsVersionFilter: true,
      chartType: "bar",
      apiType: "tc-by-component",
    },
    "tc-by-label": {
      type: "tc-by-label",
      title: "Test Cases by Label",
      description: "Test case count grouped by label",
      section: "Test Case Reports",
      group: "Test Case Summary",
      supportedFilters: ["statusIds", "priorityIds", "componentIds"],
      supportsDateRange: false,
      supportsGranularity: false,
      supportsArchiveFilter: true,
      supportsVersionFilter: true,
      chartType: "bar",
      apiType: "tc-by-label",
    },
    "tc-by-assignee": {
      type: "tc-by-assignee",
      title: "Test Cases by Assignee",
      description: "Test case count grouped by assigned executor",
      section: "Test Case Reports",
      group: "Test Case Summary",
      supportedFilters: ["statusIds", "componentIds", "labelIds"],
      supportsDateRange: false,
      supportsGranularity: false,
      supportsArchiveFilter: true,
      supportsVersionFilter: true,
      chartType: "bar",
      apiType: "executors",
    },
    "tc-by-timeframe": {
      type: "tc-by-timeframe",
      title: "Test Cases by Time Frame",
      description: "Test case creation trends over time",
      section: "Test Case Reports",
      group: "Test Case Summary",
      supportedFilters: ["componentIds", "labelIds"],
      supportsDateRange: true,
      supportsGranularity: true,
      supportsArchiveFilter: true,
      supportsVersionFilter: true,
      chartType: "area",
      apiType: "tc-by-timeframe",
    },
    "tc-manual-vs-automated": {
      type: "tc-manual-vs-automated",
      title: "Manual vs Automated",
      description: "Comparison of manual and automated test cases",
      section: "Test Case Reports",
      supportedFilters: [],
      supportsDateRange: false,
      supportsGranularity: false,
      supportsArchiveFilter: false,
      supportsVersionFilter: false,
      chartType: "pie",
      apiType: "tc-manual-vs-automated",
    },
    "tc-planned-vs-not": {
      type: "tc-planned-vs-not",
      title: "Planned vs Not-planned",
      description: "Comparison of planned and unplanned test cases",
      section: "Test Case Reports",
      supportedFilters: [],
      supportsDateRange: false,
      supportsGranularity: false,
      supportsArchiveFilter: false,
      supportsVersionFilter: false,
      chartType: "pie",
      apiType: "tc-planned-vs-not",
    },
    "exec-by-cycle": {
      type: "exec-by-cycle",
      title: "Executions by Test Cycle",
      description: "Execution metrics grouped by test cycle",
      section: "Test Execution Reports",
      group: "Execution Summary",
      supportedFilters: ["environmentIds", "buildIds"],
      supportsDateRange: false,
      supportsGranularity: false,
      supportsArchiveFilter: false,
      supportsVersionFilter: false,
      chartType: "bar",
      apiType: "cycles",
    },
    "exec-by-environment": {
      type: "exec-by-environment",
      title: "Executions by Environment",
      description: "Execution metrics grouped by environment",
      section: "Test Execution Reports",
      group: "Execution Summary",
      supportedFilters: ["buildIds"],
      supportsDateRange: false,
      supportsGranularity: false,
      supportsArchiveFilter: false,
      supportsVersionFilter: false,
      chartType: "bar",
      apiType: "exec-by-environment",
    },
    "exec-by-build": {
      type: "exec-by-build",
      title: "Executions by Build",
      description: "Execution metrics grouped by build",
      section: "Test Execution Reports",
      group: "Execution Summary",
      supportedFilters: ["environmentIds"],
      supportsDateRange: false,
      supportsGranularity: false,
      supportsArchiveFilter: false,
      supportsVersionFilter: false,
      chartType: "bar",
      apiType: "exec-by-build",
    },
    "exec-by-assignee": {
      type: "exec-by-assignee",
      title: "Executions by Assignee",
      description: "Execution metrics grouped by assignee",
      section: "Test Execution Reports",
      group: "Execution Summary",
      supportedFilters: [],
      supportsDateRange: false,
      supportsGranularity: false,
      supportsArchiveFilter: false,
      supportsVersionFilter: false,
      chartType: "bar",
      apiType: "executors",
    },
    "exec-by-requirement": {
      type: "exec-by-requirement",
      title: "Coverage by Requirement",
      description: "Test coverage linked to requirements",
      section: "Test Execution Reports",
      group: "Execution Summary",
      supportedFilters: [],
      supportsDateRange: false,
      supportsGranularity: false,
      supportsArchiveFilter: false,
      supportsVersionFilter: false,
      chartType: "table",
      apiType: "coverage",
    },
    "exec-by-timeframe": {
      type: "exec-by-timeframe",
      title: "Executions by Time Frame",
      description: "Execution trends over time with pass/fail breakdown",
      section: "Test Execution Reports",
      group: "Execution Summary",
      supportedFilters: ["environmentIds", "buildIds"],
      supportsDateRange: true,
      supportsGranularity: true,
      supportsArchiveFilter: false,
      supportsVersionFilter: false,
      chartType: "area",
      apiType: "exec-by-timeframe",
    },
  };

  return metadata[reportType] || null;
}

/**
 * Get supported filters for a report type
 *
 * @param reportType - Type of report
 * @returns Array of supported filter names
 */
export function getSupportedFilters(reportType: ReportType): string[] {
  const meta = getReportMetadata(reportType);
  if (!meta) return [];

  const filters = [...meta.supportedFilters];
  if (meta.supportsArchiveFilter) filters.push("isArchived");
  if (meta.supportsVersionFilter) filters.push("latestVersionOnly");
  if (meta.supportsDateRange) {
    filters.push("fromDate", "toDate");
    if (meta.supportsGranularity) filters.push("granularity");
  }

  return filters;
}

/**
 * Check if report supports a specific filter
 *
 * @param reportType - Type of report
 * @param filterName - Name of filter to check
 * @returns Whether the report supports this filter
 */
export function supportsFilter(reportType: ReportType, filterName: string): boolean {
  return getSupportedFilters(reportType).includes(filterName);
}
