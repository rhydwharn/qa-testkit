/**
 * Centralized data-test-id naming convention for automated testing.
 *
 * Format: "{page}-{section}-{element}[-{identifier}]"
 *
 * Examples:
 * - "cycles-table-row-ABC123" (table row with cycle ID)
 * - "cases-pagination-next" (pagination next button)
 * - "automation-table-header-framework" (table header)
 * - "settings-form-submit" (form submit button)
 */

export const TestIds = {
  // ─── Navigation / Layout ───────────────────────────────────────────────────
  sidebar: {
    root: "sidebar-root",
    menu: "sidebar-menu",
    item: (name: string) => `sidebar-item-${name}`,
    logo: "sidebar-logo",
  },
  header: {
    root: "header-root",
    projectSelector: "header-project-selector",
    userMenu: "header-user-menu",
    notifications: "header-notifications",
  },

  // ─── Cycles Page ───────────────────────────────────────────────────────────
  cycles: {
    page: "cycles-page",
    title: "cycles-page-title",
    table: "cycles-table",
    tableHeader: "cycles-table-header",
    tableBody: "cycles-table-body",
    tableRow: (cycleId: string) => `cycles-table-row-${cycleId}`,
    tableCell: (cycleId: string, field: string) => `cycles-table-cell-${cycleId}-${field}`,
    headerCheckbox: "cycles-table-header-checkbox",
    checkbox: (cycleId: string) => `cycles-table-checkbox-${cycleId}`,
    actionClone: (cycleId: string) => `cycles-action-clone-${cycleId}`,
    bulkDelete: "cycles-bulk-delete",
    bulkStatusChange: "cycles-bulk-status",
    filterSearch: "cycles-filter-search",
    filterStatus: (status: string) => `cycles-filter-status-${status}`,
    filterArchived: "cycles-filter-archived",
    pagination: {
      root: "cycles-pagination",
      info: "cycles-pagination-info",
      itemsSelect: "cycles-pagination-items-select",
      prevButton: "cycles-pagination-prev",
      nextButton: "cycles-pagination-next",
      pageCounter: "cycles-pagination-counter",
    },
  },

  // ─── Cases Page ────────────────────────────────────────────────────────────
  cases: {
    page: "cases-page",
    title: "cases-page-title",
    table: "cases-table",
    tableHeader: "cases-table-header",
    tableBody: "cases-table-body",
    tableRow: (caseId: string) => `cases-table-row-${caseId}`,
    expandButton: (caseId: string) => `cases-expand-button-${caseId}`,
    checkbox: (caseId: string) => `cases-table-checkbox-${caseId}`,
    actionMenu: (caseId: string) => `cases-action-menu-${caseId}`,
    filterSearch: "cases-filter-search",
    filterStatus: (status: string) => `cases-filter-status-${status}`,
    filterFolder: "cases-filter-folder",
    filterArchived: "cases-filter-archived",
    bulkClone: "cases-bulk-clone",
    bulkArchive: "cases-bulk-archive",
    bulkDelete: "cases-bulk-delete",
    bulkLinkCycle: "cases-bulk-link-cycle",
    bulkMoveFolder: "cases-bulk-move-folder",
    bulkStatusChange: "cases-bulk-status",
    pagination: {
      root: "cases-pagination",
      info: "cases-pagination-info",
      itemsSelect: "cases-pagination-items-select",
      prevButton: "cases-pagination-prev",
      nextButton: "cases-pagination-next",
      pageCounter: "cases-pagination-counter",
    },
    accordion: {
      panel: (caseId: string) => `cases-accordion-panel-${caseId}`,
      stepsTable: (caseId: string) => `cases-steps-table-${caseId}`,
      stepRow: (caseId: string, stepId: string) => `cases-step-row-${caseId}-${stepId}`,
      editButton: (caseId: string, stepId: string) => `cases-step-edit-${caseId}-${stepId}`,
      deleteButton: (caseId: string, stepId: string) => `cases-step-delete-${caseId}-${stepId}`,
      saveButton: (caseId: string, stepId: string) => `cases-step-save-${caseId}-${stepId}`,
      cancelButton: (caseId: string, stepId: string) => `cases-step-cancel-${caseId}-${stepId}`,
    },
  },

  // ─── Automation Page ────────────────────────────────────────────────────────
  automation: {
    page: "automation-page",
    title: "automation-page-title",
    subtitle: "automation-page-subtitle",
    noProjectMessage: "automation-no-project-message",
    loadingSpinner: "automation-loading-spinner",
    noRunsMessage: "automation-no-runs-message",
    recentRunsCard: "automation-recent-runs-card",
    recentRunsTitle: "automation-recent-runs-title",
    table: "automation-runs-table",
    tableContainer: "automation-table-container",
    tableHeader: "automation-table-header",
    tableBody: "automation-table-body",
    tableRow: (runId: string) => `automation-table-row-${runId}`,
    framework: (runId: string) => `automation-framework-${runId}`,
    cycleKey: (runId: string) => `automation-cycle-key-${runId}`,
    cycleName: (runId: string) => `automation-cycle-name-${runId}`,
    passCount: (runId: string) => `automation-pass-count-${runId}`,
    failCount: (runId: string) => `automation-fail-count-${runId}`,
    date: (runId: string) => `automation-date-${runId}`,
    pagination: {
      root: "automation-pagination",
      info: "automation-pagination-info",
      label: "automation-pagination-label",
      itemsSelect: "automation-pagination-select",
      prevButton: "automation-pagination-prev",
      nextButton: "automation-pagination-next",
      pageCounter: "automation-pagination-counter",
    },
    headerFramework: "automation-header-framework",
    headerCycle: "automation-header-cycle",
    headerPass: "automation-header-pass",
    headerFail: "automation-header-fail",
    headerDate: "automation-header-date",
  },

  // ─── Reports Page ──────────────────────────────────────────────────────────
  reports: {
    page: "reports-page",
    title: "reports-page-title",
    reportSelector: "reports-report-selector",
    filterForm: "reports-filter-form",
    reportView: (reportType: string) => `reports-view-${reportType}`,
    table: (reportType: string) => `reports-table-${reportType}`,
    tableRow: (reportType: string, rowId: string) => `reports-table-row-${reportType}-${rowId}`,
    chart: (reportType: string) => `reports-chart-${reportType}`,
    pagination: (reportType: string) => ({
      root: `reports-pagination-${reportType}`,
      info: `reports-pagination-${reportType}-info`,
      itemsSelect: `reports-pagination-${reportType}-select`,
      prevButton: `reports-pagination-${reportType}-prev`,
      nextButton: `reports-pagination-${reportType}-next`,
      pageCounter: `reports-pagination-${reportType}-counter`,
    }),
  },

  // ─── Dashboard Page ────────────────────────────────────────────────────────
  dashboard: {
    page: "dashboard-page",
    statsContainer: "dashboard-stats-container",
    noProject: "dashboard-no-project",
    projectStats: "dashboard-project-stats",
    recentCycles: "dashboard-recent-cycles",
    cycleRow: (cycleId: string) => `dashboard-cycle-row-${cycleId}`,
    activitySidebar: "dashboard-activity-sidebar",
    activityItem: (cycleId: string) => `dashboard-activity-item-${cycleId}`,
  },

  // ─── Plans Page ────────────────────────────────────────────────────────────
  plans: {
    page: "plans-page",
    title: "plans-page-title",
    header: "plans-header",
    buttonNew: "plans-button-new",
    filters: "plans-filters",
    filterSearch: "plans-filter-search",
    filterStatusGroup: "plans-filter-status-group",
    filterStatus: (status: string) => `plans-filter-status-${status}`,
    list: "plans-list",
    tableRow: (planId: string) => `plans-table-row-${planId}`,
    pagination: {
      root: "plans-pagination",
      info: "plans-pagination-info",
      itemsSelect: "plans-pagination-items-select",
      prevButton: "plans-pagination-prev",
      nextButton: "plans-pagination-next",
      pageCounter: "plans-pagination-counter",
    },
    newPage: "plans-new-page",
    newHeader: "plans-new-header",
    newForm: "plans-new-form",
    newButtonCreate: "plans-new-button-create",
    detailPage: "plans-detail-page",
    detailHeader: "plans-detail-header",
    detailContent: "plans-detail-content",
    detailButtonEdit: "plans-detail-button-edit",
    detailButtonDelete: "plans-detail-button-delete",
  },

  // ─── Cases Detail Page ─────────────────────────────────────────────────────
  casesDetail: {
    page: "cases-detail-page",
    header: "cases-detail-header",
    buttonBack: "cases-detail-button-back",
    buttonEdit: "cases-detail-button-edit",
    buttonSave: "cases-detail-button-save",
    buttonDelete: "cases-detail-button-delete",
    content: "cases-detail-content",
    tabs: "cases-detail-tabs",
    tab: (tabName: string) => `cases-detail-tab-${tabName}`,
    stepsTable: "cases-detail-steps-table",
  },

  // ─── Cases New Page ────────────────────────────────────────────────────────
  casesNew: {
    page: "cases-new-page",
    header: "cases-new-header",
    buttonBack: "cases-new-button-back",
    form: "cases-new-form",
    buttonCreate: "cases-new-button-create",
  },

  // ─── Cycles Detail Page ────────────────────────────────────────────────────
  cyclesDetail: {
    page: "cycles-detail-page",
    header: "cycles-detail-header",
    content: "cycles-detail-content",
    tabs: "cycles-detail-tabs",
    tab: (tabName: string) => `cycles-detail-tab-${tabName}`,
  },

  // ─── Cycles New Page ───────────────────────────────────────────────────────
  cyclesNew: {
    page: "cycles-new-page",
    header: "cycles-new-header",
    form: "cycles-new-form",
    buttonCreate: "cycles-new-button-create",
  },

  // ─── Settings Page ─────────────────────────────────────────────────────────
  settings: {
    page: "settings-page",
    title: "settings-page-title",
    sidebar: "settings-sidebar",
    sidebarItem: (item: string) => `settings-sidebar-${item}`,
    content: "settings-content",
    formContent: "settings-form-content",
    form: (section: string) => `settings-form-${section}`,
    input: (section: string, field: string) => `settings-input-${section}-${field}`,
    button: (section: string, action: string) => `settings-button-${section}-${action}`,
    table: (section: string) => `settings-table-${section}`,
    tableRow: (section: string, rowId: string) => `settings-table-${section}-${rowId}`,
    tableDelete: (section: string, rowId: string) => `settings-delete-${section}-${rowId}`,
  },

  // ─── Dialogs / Modals ──────────────────────────────────────────────────────
  dialog: {
    overlay: (name: string) => `dialog-${name}-overlay`,
    content: (name: string) => `dialog-${name}-content`,
    header: (name: string) => `dialog-${name}-header`,
    title: (name: string) => `dialog-${name}-title`,
    closeButton: (name: string) => `dialog-${name}-close`,
    submitButton: (name: string) => `dialog-${name}-submit`,
    cancelButton: (name: string) => `dialog-${name}-cancel`,
  },

  // ─── Forms ─────────────────────────────────────────────────────────────────
  form: {
    input: (id: string) => `form-input-${id}`,
    select: (id: string) => `form-select-${id}`,
    checkbox: (id: string) => `form-checkbox-${id}`,
    textarea: (id: string) => `form-textarea-${id}`,
    button: (id: string) => `form-button-${id}`,
    error: (id: string) => `form-error-${id}`,
  },

  // ─── Common UI Elements ────────────────────────────────────────────────────
  common: {
    button: (label: string) => `button-${label.toLowerCase()}`,
    link: (label: string) => `link-${label.toLowerCase()}`,
    input: (placeholder: string) => `input-${placeholder.toLowerCase()}`,
    loadingSpinner: "loading-spinner",
    emptyState: "empty-state",
    error: "error-message",
    success: "success-message",
  },
};

/**
 * Helper function to build test IDs with optional parameters
 * Usage: buildTestId("cycles", "table", "row", cycleId)
 */
export function buildTestId(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join("-");
}
