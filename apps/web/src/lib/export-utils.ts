/**
 * Report Export Utilities
 *
 * Functions to export report data in various formats: CSV, PDF, JSON
 */

import type { ReportData, ReportParameters, ExportFormat } from "@/types/reports";

/**
 * Export report data as CSV
 *
 * @param data - Report data to export
 * @param filename - Output file name (without extension)
 *
 * @example
 * ```typescript
 * exportAsCSV(reportData, "test-cases-by-status");
 * ```
 */
export function exportAsCSV(data: ReportData, filename: string): void {
  const csv = generateCSV(data);
  downloadFile(csv, `${filename}.csv`, "text/csv;charset=utf-8;");
}

/**
 * Export report data as JSON
 *
 * @param data - Report data to export
 * @param filename - Output file name (without extension)
 *
 * @example
 * ```typescript
 * exportAsJSON(reportData, "test-cases-by-status");
 * ```
 */
export function exportAsJSON(data: ReportData, filename: string): void {
  const json = JSON.stringify(
    {
      report: data,
      exportedAt: new Date().toISOString(),
      version: "1.0",
    },
    null,
    2
  );
  downloadFile(json, `${filename}.json`, "application/json;charset=utf-8;");
}

/**
 * Export report data as PDF
 *
 * Requires jsPDF and jsPDF-autotable libraries to be installed:
 * pnpm add jspdf jspdf-autotable
 *
 * @param data - Report data to export
 * @param filename - Output file name (without extension)
 * @param includeCharts - Whether to include chart images (if available)
 *
 * @example
 * ```typescript
 * exportAsPDF(reportData, "test-cases-by-status", true);
 * ```
 */
export async function exportAsPDF(
  data: ReportData,
  filename: string,
  includeCharts: boolean = true
): Promise<void> {
  // PDF export is not currently available
  // jsPDF and jsPdf-autotable would need to be installed for this feature
  // For now, export as CSV instead
  console.info("PDF export not available. Exporting as CSV instead.");
  return exportAsCSV(data, filename);
}

/**
 * Generate CSV content from report data
 *
 * @param data - Report data
 * @returns CSV string content
 */
function generateCSV(data: ReportData): string {
  const lines: string[] = [];

  // Header with title and metadata
  lines.push(`"${data.title}"`);
  lines.push(`"Generated: ${new Date().toISOString()}"`);
  lines.push(`"Report Type: ${data.type}"`);
  lines.push("");

  // Parameters section
  if (Object.keys(data.parameters || {}).length > 0) {
    lines.push('"Filters Applied:"');
    const params = formatParametersForDisplay(data.parameters);
    Object.entries(params).forEach(([key, value]) => {
      lines.push(`"${key}","${value}"`);
    });
    lines.push("");
  }

  // Summary section
  if (data.summary) {
    lines.push('"Summary"');
    const summary = formatSummaryForDisplay(data.summary);
    Object.entries(summary).forEach(([key, value]) => {
      lines.push(`"${key}","${value}"`);
    });
    lines.push("");
  }

  // Data table
  if (data.rows.length > 0) {
    const columns = Object.keys(data.rows[0]);
    lines.push(columns.map((col) => `"${col}"`).join(","));

    data.rows.forEach((row) => {
      const values = columns.map((col) => {
        const value = row[col];
        if (value === null || value === undefined) return '""';
        if (typeof value === "string" && value.includes('"')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return `"${value}"`;
      });
      lines.push(values.join(","));
    });
  }

  return lines.join("\n");
}

/**
 * Download file to user's computer
 *
 * @param content - File content
 * @param filename - File name
 * @param mimeType - MIME type
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format report parameters for display
 *
 * @param params - Report parameters
 * @returns Formatted key-value pairs
 */
function formatParametersForDisplay(params: ReportParameters): Record<string, string> {
  const formatted: Record<string, string> = {};

  if (params.statuses?.length) {
    formatted["Statuses"] = params.statuses.join(", ");
  }
  if (params.priorityIds?.length) {
    formatted["Priorities"] = params.priorityIds.join(", ");
  }
  if (params.componentIds?.length) {
    formatted["Components"] = params.componentIds.join(", ");
  }
  if (params.labelIds?.length) {
    formatted["Labels"] = params.labelIds.join(", ");
  }
  if (params.assigneeIds?.length) {
    formatted["Assignees"] = params.assigneeIds.join(", ");
  }
  if (params.environmentIds?.length) {
    formatted["Environments"] = params.environmentIds.join(", ");
  }
  if (params.buildIds?.length) {
    formatted["Builds"] = params.buildIds.join(", ");
  }
  if (params.fromDate) {
    formatted["From Date"] = params.fromDate;
  }
  if (params.toDate) {
    formatted["To Date"] = params.toDate;
  }
  if (params.granularity) {
    formatted["Granularity"] = params.granularity;
  }
  if (params.isArchived !== undefined) {
    formatted["Include Archived"] = params.isArchived ? "Yes" : "No";
  }
  if (params.latestVersionOnly !== undefined) {
    formatted["Latest Version Only"] = params.latestVersionOnly ? "Yes" : "No";
  }

  return formatted;
}

/**
 * Format summary statistics for display
 *
 * @param summary - Report summary
 * @returns Formatted key-value pairs
 */
function formatSummaryForDisplay(summary: any): Record<string, string> {
  const formatted: Record<string, string> = {};

  if (summary.totalCount !== undefined) {
    formatted["Total"] = String(summary.totalCount);
  }
  if (summary.passCount !== undefined) {
    formatted["Pass"] = String(summary.passCount);
  }
  if (summary.failCount !== undefined) {
    formatted["Fail"] = String(summary.failCount);
  }
  if (summary.blockedCount !== undefined) {
    formatted["Blocked"] = String(summary.blockedCount);
  }
  if (summary.notRunCount !== undefined) {
    formatted["Not Run"] = String(summary.notRunCount);
  }
  if (summary.passRate !== undefined) {
    formatted["Pass Rate"] = `${summary.passRate.toFixed(1)}%`;
  }

  return formatted;
}

/**
 * Generate suggested filename for report
 *
 * @param reportType - Type of report
 * @param timestamp - Whether to include timestamp
 * @returns Suggested filename (without extension)
 */
export function generateFilename(reportType: string, timestamp: boolean = true): string {
  const date = new Date();
  const dateStr = timestamp
    ? date.toISOString().split("T")[0] + "_" + date.getTime()
    : "";
  const name = reportType.replace(/([A-Z])/g, "-$1").toLowerCase().replace(/^-/, "");
  return dateStr ? `${name}_${dateStr}` : name;
}

/**
 * Trigger export based on format
 *
 * @param data - Report data
 * @param format - Export format
 * @param filename - Output filename
 * @param includeCharts - Whether to include charts in PDF
 */
export async function exportReport(
  data: ReportData,
  format: ExportFormat,
  filename: string,
  includeCharts: boolean = true
): Promise<void> {
  switch (format) {
    case "csv":
      exportAsCSV(data, filename);
      break;
    case "json":
      exportAsJSON(data, filename);
      break;
    case "pdf":
      await exportAsPDF(data, filename, includeCharts);
      break;
    default:
      throw new Error(`Unknown export format: ${format}`);
  }
}
