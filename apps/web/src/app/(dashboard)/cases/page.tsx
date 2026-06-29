"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useResizablePanel } from "@/hooks/use-resize";
import { PanelResizeHandle } from "@/components/ui/resize-handle";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TestIds } from "@/lib/test-ids";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Search, FlaskConical, Upload, Eye, Trash2, Loader2, CheckCircle2,
  AlertCircle, Pencil, Check, X, ChevronRight, ChevronDown, FolderOpen,
  Folder as FolderIcon, Download, Copy, Link2, HelpCircle, FileText,
  FolderPlus, RefreshCw, Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { FolderRenameDialog } from "@/components/FolderRenameDialog";
import { FolderMoveDialog } from "@/components/FolderMoveDialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Step {
  id: string;
  order: number;
  stepDetails: string;
  expectedResult?: string;
  testData?: string;
}

interface TestCase {
  id: string;
  key: string;
  summary: string;
  status: string;
  priority?: { name: string; color: string } | null;
  folder?: { id: string; name: string } | null;
  versions: Array<{ steps: Step[] }>;
}

interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
  children: FolderNode[];
  _count?: { testCases: number };
}

interface ImportCase {
  summary: string;
  description?: string;
  precondition?: string;
  status?: string;
  priority?: string;
  labels?: string[];
  jiraRequirementKeys?: string[];
  folder?: string;
  key?: string;
  steps?: Array<{ stepDetails: string; expectedResult?: string; testData?: string }>;
}

const IMPORT_FIELDS = [
  { key: "summary", label: "Summary", required: true },
  { key: "key", label: "Test Case ID", required: false },
  { key: "folders", label: "Folders", required: false },
  { key: "storyLinkages", label: "Story Linkages", required: false },
  { key: "workKey", label: "Work Key", required: false },
  { key: "precondition", label: "Precondition", required: false },
  { key: "description", label: "Description", required: false },
  { key: "status", label: "Status", required: false },
  { key: "priority", label: "Priority", required: false },
  { key: "assignee", label: "Assignee", required: false },
  { key: "reporter", label: "Reporter", required: false },
  { key: "estimatedTime", label: "Estimated Time", required: false },
  { key: "labels", label: "Labels", required: false },
  { key: "components", label: "Components", required: false },
  { key: "sprint", label: "Sprint", required: false },
  { key: "steps", label: "Step Summary", required: false },
  { key: "testData", label: "Test Data", required: false },
  { key: "expectedResult", label: "Expected Result", required: false },
];

// ---------------------------------------------------------------------------
// File parsing
// ---------------------------------------------------------------------------

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Strip UTF-8 BOM if present
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  // RFC 4180-compliant parser: handles quoted fields with embedded newlines and commas
  const allRows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          // Escaped quote inside a quoted field
          cell += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        cell += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        row.push(cell.trim());
        cell = "";
        i++;
      } else if (ch === '\r' && text[i + 1] === '\n') {
        row.push(cell.trim());
        cell = "";
        allRows.push(row);
        row = [];
        i += 2;
      } else if (ch === '\n' || ch === '\r') {
        row.push(cell.trim());
        cell = "";
        allRows.push(row);
        row = [];
        i++;
      } else {
        cell += ch;
        i++;
      }
    }
  }
  // Flush final cell/row
  if (cell || row.length > 0) {
    row.push(cell.trim());
    if (row.some((c) => c.trim())) allRows.push(row);
  }

  if (allRows.length < 2) return { headers: [], rows: [] };

  const headers = allRows[0].map((h) => h.replace(/^"|"$/g, "").trim());
  const rows = allRows.slice(1)
    .filter((cells) => cells.some((c) => c.trim()))
    .map((cells) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => { obj[h] = (cells[idx] ?? "").replace(/^"|"$/g, "").trim(); });
      return obj;
    });
  return { headers, rows };
}

function parseFeature(text: string): ImportCase[] {
  const lines = text.split(/\r?\n/);
  const items: ImportCase[] = [];
  let featureName = "";
  let current: ImportCase | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("Feature:")) featureName = line.replace(/^Feature:\s*/, "");
    else if (line.startsWith("Scenario Outline:") || line.startsWith("Scenario:")) {
      if (current) items.push(current);
      current = { summary: line.replace(/^Scenario Outline:\s*|^Scenario:\s*/, ""), description: featureName, steps: [], jiraRequirementKeys: [] };
    } else if (current && /^(Given|When|Then|And|But)\s/.test(line)) {
      current.steps!.push({ stepDetails: line });
    }
  }
  if (current) items.push(current);
  return items;
}

async function parseXlsx(file: File): Promise<{ sheets: string[]; headers: string[]; rows: Record<string, string>[]; unsupported?: boolean }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const XLSX: any = await import("xlsx").catch(() => null);
    if (!XLSX) return { sheets: [], headers: [], rows: [], unsupported: true };
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const json: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
    const headers = json.length > 0 ? Object.keys(json[0]) : [];
    return { sheets: wb.SheetNames as string[], headers, rows: json };
  } catch {
    return { sheets: [], headers: [], rows: [] };
  }
}

function extractSteps(
  row: Record<string, string>,
  stepsCol: string
): Array<{ stepDetails: string; testData?: string; expectedResult?: string }> {
  const STEP_SUMMARY_ALIASES = ["step summary", "steps summary", "step details", "test steps", "steps"];
  const effectiveCol =
    stepsCol ||
    Object.keys(row).find((k) => STEP_SUMMARY_ALIASES.includes(k.toLowerCase().trim())) ||
    "";

  if (effectiveCol && row[effectiveCol]?.trim()) {
    const raw = row[effectiveCol].trim();
    const parts = raw.includes(";")
      ? raw.split(";").map((s) => s.trim()).filter(Boolean)
      : [raw];
    return parts.map((s) => ({ stepDetails: s }));
  }

  const stepPattern = /^step\s*(\d+)/i;
  const groups: Record<number, { stepDetails: string; testData: string; expectedResult: string }> = {};

  for (const [col, value] of Object.entries(row)) {
    const m = col.trim().match(stepPattern);
    if (!m || !value?.trim()) continue;
    const n = parseInt(m[1], 10);
    if (!groups[n]) groups[n] = { stepDetails: "", testData: "", expectedResult: "" };
    const rest = col.slice(m[0].length).replace(/^\s*[-:]\s*/, "").toLowerCase().trim();
    if (rest.includes("test data") || rest === "data") groups[n].testData = value;
    else if (rest.includes("expected") || rest.includes("result")) groups[n].expectedResult = value;
    else groups[n].stepDetails = value;
  }

  return Object.entries(groups)
    .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10))
    .map(([, s]) => s)
    .filter((s) => s.stepDetails.trim());
}

function groupRowsIntoTestCases(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: Record<string, any>[],
  fieldMapping: Record<string, string>
): ImportCase[] {
  if (rows.length === 0) return [];

  const str = (v: unknown): string => (v == null ? "" : String(v).trim());

  const allCols = Object.keys(rows[0]);

  const resolveCol = (mapKey: string, aliases: string[]): string =>
    fieldMapping[mapKey] ||
    allCols.find((c) =>
      aliases.some((a) => c.toLowerCase().trim() === a.toLowerCase())
    ) ||
    "";

  const summaryCol = resolveCol("summary", ["summary", "name", "title", "test case"]);
  const descCol = resolveCol("description", ["description", "desc"]);
  const precondCol = resolveCol("precondition", ["precondition", "pre-condition", "preconditions"]);
  const statusCol = resolveCol("status", ["status"]);
  const priorityCol = resolveCol("priority", ["priority"]);
  const labelsCol = resolveCol("labels", ["labels", "label", "tags"]);
  const storyCol = resolveCol("storyLinkages", ["story linkages", "jira keys", "requirement keys", "story links"]);
  const foldersCol = resolveCol("folders", ["folders", "folder", "folder path"]);
  const stepsCol = resolveCol("steps", ["step summary", "steps summary", "step details", "test steps", "steps"]);
  const testDataCol = resolveCol("testData", ["test data", "testdata"]);
  const expectedCol = resolveCol("expectedResult", ["expected result", "expected results", "expected"]);
  const keyCol = resolveCol("key", ["key", "test case id", "tc id", "id", "work-key", "work key"]);

  const issueKeyCol = allCols.find((c) => c.toLowerCase().trim() === "issue key") ?? "";

  const cases: ImportCase[] = [];
  let current: ImportCase | null = null;

  for (const row of rows) {
    const issueKey = issueKeyCol ? str(row[issueKeyCol]) : "";
    const summary = summaryCol ? str(row[summaryCol]) : "";
    const stepText = stepsCol ? str(row[stepsCol]) : "";

    if (issueKey || summary) {
      if (current) cases.push(current);
      const rawLabels = labelsCol ? str(row[labelsCol]) : "";
      const rawStory = storyCol ? str(row[storyCol]) : "";
      const rawFolder = foldersCol ? str(row[foldersCol]) : "";
      const rawKey = keyCol ? str(row[keyCol]) : "";
      current = {
        summary: summary || issueKey,
        description: descCol ? str(row[descCol]) : "",
        precondition: precondCol ? str(row[precondCol]) : "",
        status: statusCol ? str(row[statusCol]) : "",
        priority: priorityCol ? str(row[priorityCol]) : "",
        labels: rawLabels ? rawLabels.split(";").map((s) => s.trim()).filter(Boolean) : [],
        jiraRequirementKeys: rawStory ? rawStory.split(";").map((s) => s.trim()).filter(Boolean) : [],
        folder: rawFolder || undefined,
        key: rawKey || undefined,
        steps: [],
      };
    }

    if (current && stepText) {
      const td = testDataCol ? str(row[testDataCol]) : "";
      const er = expectedCol ? str(row[expectedCol]) : "";
      current.steps!.push({
        stepDetails: stepText,
        testData: td || undefined,
        expectedResult: er || undefined,
      });
    }
  }

  if (current) cases.push(current);
  return cases;
}

// ---------------------------------------------------------------------------
// Folder sidebar components
// ---------------------------------------------------------------------------

function FolderTreeNode({
  node,
  depth,
  selected,
  allCount,
  caseCounts,
  projectId,
  onSelect,
  onDelete,
  onRename,
  onMove,
  dragOverId,
  onDragOver,
  onDrop,
}: {
  node: FolderNode;
  depth: number;
  selected: string | null;
  allCount: number;
  caseCounts: Record<string, number>;
  projectId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onRename: (id: string, newName: string) => void;
  onMove: (id: string) => void;
  dragOverId: string | "root" | null;
  onDragOver: (id: string) => void;
  onDrop: (folderId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [renameOpen, setRenameOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const count = caseCounts[node.id] ?? 0;
  const hasChildren = node.children.length > 0;
  const isDropTarget = dragOverId === node.id;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors select-none",
          selected === node.id ? "bg-brand-50 text-brand-700 font-medium" : "hover:bg-muted/50 text-foreground",
          isDropTarget && "ring-2 ring-brand-400 bg-brand-50"
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => onSelect(node.id)}
        onDragOver={(e) => { e.preventDefault(); onDragOver(node.id); }}
        onDragLeave={() => onDragOver("")}
        onDrop={(e) => { e.preventDefault(); onDrop(node.id); }}
      >
        {hasChildren ? (
          <button
            className="shrink-0 text-muted-foreground"
            onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); }}
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        {open && hasChildren ? (
          <FolderOpen className={cn("h-3.5 w-3.5 shrink-0", isDropTarget ? "text-brand-500" : "text-amber-500")} />
        ) : (
          <FolderIcon className={cn("h-3.5 w-3.5 shrink-0", isDropTarget ? "text-brand-500" : "text-amber-500")} />
        )}
        <span className="flex-1 truncate">{node.name}</span>
        <span className="text-[11px] text-muted-foreground shrink-0">{count}</span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="shrink-0 text-muted-foreground hover:text-blue-600 p-0.5"
            title="Rename"
            onClick={(e) => { e.stopPropagation(); setRenameOpen(true); }}
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            className="shrink-0 text-muted-foreground hover:text-brand-600 p-0.5"
            title="Move"
            onClick={(e) => { e.stopPropagation(); setMoveOpen(true); }}
          >
            <ChevronRight className="h-3 w-3" />
          </button>
          <button
            className="shrink-0 text-muted-foreground hover:text-destructive p-0.5"
            title="Delete"
            onClick={(e) => { e.stopPropagation(); onDelete(node.id, node.name); }}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        {renameOpen && (
          <FolderRenameDialog
            folderId={node.id}
            currentName={node.name}
            open={renameOpen}
            onOpenChange={setRenameOpen}
            onRename={(newName) => {
              onRename(node.id, newName);
              setRenameOpen(false);
            }}
          />
        )}
        {moveOpen && (
          <FolderMoveDialog
            folderId={node.id}
            projectId={projectId}
            open={moveOpen}
            onOpenChange={setMoveOpen}
            onMove={(newParentId) => {
              onMove(node.id);
              setMoveOpen(false);
            }}
          />
        )}
      </div>
      {open && hasChildren && node.children.map((child) => (
        <FolderTreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          selected={selected}
          allCount={allCount}
          caseCounts={caseCounts}
          projectId={projectId}
          onSelect={onSelect}
          dragOverId={dragOverId}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onDelete={onDelete}
          onRename={onRename}
          onMove={onMove}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import Guide Modal
// ---------------------------------------------------------------------------

function ImportGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-brand-500" />
            Import Test Cases Guide
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 text-sm">
          <section>
            <h3 className="font-semibold mb-1.5">Supported File Formats</h3>
            <ul className="space-y-1 text-muted-foreground list-disc ml-4">
              <li><span className="font-mono font-medium text-foreground">.xlsx</span> / <span className="font-mono font-medium text-foreground">.xls</span> — Microsoft Excel format (recommended for large imports)</li>
              <li><span className="font-mono font-medium text-foreground">.csv</span> — Comma-separated values (UTF-8 encoding)</li>
              <li>Maximum file size: <strong>10 MB</strong></li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold mb-1.5">Preparing Your Spreadsheet</h3>
            <p className="text-muted-foreground mb-2">Your spreadsheet must have a header row in the first row. Column names are mapped to test case fields in Step 2.</p>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Field</th>
                    <th className="text-left px-3 py-2 font-semibold">Required</th>
                    <th className="text-left px-3 py-2 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    { field: "Summary", req: "Yes", note: "The test case title. Max 500 characters." },
                    { field: "Description", req: "No", note: "Detailed description of the test case." },
                    { field: "Precondition", req: "No", note: "Prerequisites before running this test." },
                    { field: "Status", req: "No", note: "DRAFT, READY, or DEPRECATED. Defaults to DRAFT." },
                    { field: "Priority", req: "No", note: "Must match an existing priority name in the project." },
                    { field: "Labels", req: "No", note: "Semicolon-separated list of labels (e.g. Smoke; Regression)." },
                    { field: "Story Linkages", req: "No", note: "Semicolon-separated JIRA issue keys (e.g. PROJ-123; PROJ-456)." },
                    { field: "Step Summary", req: "No", note: "The step action text. Each step goes on its own row — rows with no Summary are treated as additional steps for the previous test case." },
                    { field: "Test Data", req: "No", note: "Input data for the step (optional). Must be in the same row as the Step Summary." },
                    { field: "Expected Result", req: "No", note: "Expected outcome for the step (optional). Must be in the same row as the Step Summary." },
                  ].map((r) => (
                    <tr key={r.field} className="hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium">{r.field}</td>
                      <td className="px-3 py-2">{r.req === "Yes" ? <span className="text-red-600 font-bold">Yes</span> : <span className="text-muted-foreground">No</span>}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-1.5">Multi-row Step Format</h3>
            <p className="text-muted-foreground mb-2">
              Each test step should be on its own row. The first row of a test case contains all fields (Summary, Description, etc.)
              plus the first step. Subsequent rows for the same test case have an <strong>empty Summary</strong> and only the step columns filled in.
            </p>
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-xs whitespace-nowrap">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    {["Issue Key", "Summary", "…", "Step Summary", "Test Data", "Expected Result"].map((h) => (
                      <th key={h} className="text-left px-3 py-2 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr className="hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono text-[10px]">TC-1</td>
                    <td className="px-3 py-2">Login flow</td>
                    <td className="px-3 py-2 text-muted-foreground">…</td>
                    <td className="px-3 py-2">Open app</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2">App opens</td>
                  </tr>
                  <tr className="hover:bg-muted/20 bg-muted/10">
                    <td className="px-3 py-2 text-muted-foreground italic text-[10px]">(empty)</td>
                    <td className="px-3 py-2 text-muted-foreground italic text-[10px]">(empty)</td>
                    <td className="px-3 py-2 text-muted-foreground">…</td>
                    <td className="px-3 py-2">Enter credentials</td>
                    <td className="px-3 py-2">user@example.com</td>
                    <td className="px-3 py-2">Login succeeds</td>
                  </tr>
                  <tr className="hover:bg-muted/20 bg-muted/10">
                    <td className="px-3 py-2 text-muted-foreground italic text-[10px]">(empty)</td>
                    <td className="px-3 py-2 text-muted-foreground italic text-[10px]">(empty)</td>
                    <td className="px-3 py-2 text-muted-foreground">…</td>
                    <td className="px-3 py-2">Click Submit</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2">Dashboard loads</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-1.5">Auto Mapping</h3>
            <p className="text-muted-foreground">
              When <strong>Auto Mapping</strong> is enabled, the system will automatically match your column headers to the
              corresponding test case fields. For best results, use the exact field names shown in the mapping table
              (case-insensitive). Unmatched fields will remain unselected and can be mapped manually.
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-1.5">Duplicate Handling</h3>
            <div className="space-y-2 text-muted-foreground">
              <p><strong className="text-foreground">Import with New Version</strong> — If a test case with the same summary already exists, a new version is created and linked to it. Both versions are preserved.</p>
              <p><strong className="text-foreground">Skip</strong> — If a test case with the same summary already exists, it will not be imported again. The existing test case is unchanged.</p>
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-1.5">Missing Fields Handling</h3>
            <div className="space-y-2 text-muted-foreground">
              <p><strong className="text-foreground">Create</strong> — If a field value like a Label or Priority does not exist in the project, it will be created automatically during import.</p>
              <p><strong className="text-foreground">Ignore</strong> — If a field value does not exist, that field will be left blank on the imported test case. No new values are created.</p>
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-1.5">Destination Folder</h3>
            <p className="text-muted-foreground">
              All imported test cases will be placed into the selected destination folder.
              If no folder is selected, they will be imported into <strong>All Test Cases</strong> (unfoldered).
            </p>
          </section>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Import Wizard Modal (2-step)
// ---------------------------------------------------------------------------

function ImportWizardModal({
  open,
  onClose,
  projectId,
  folders,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  folders: FolderNode[];
  onImported: (count: number) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [showGuide, setShowGuide] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [destFolderId, setDestFolderId] = useState("");
  const [duplicateHandling, setDuplicateHandling] = useState<"new_version" | "skip">("skip");
  const [missingFieldsHandling, setMissingFieldsHandling] = useState<"create" | "ignore">("ignore");

  const [columnHeaders, setColumnHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [autoMapping, setAutoMapping] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setStep(1); setFile(null); setSheets([]); setSelectedSheet(""); setDestFolderId("");
    setDuplicateHandling("skip"); setMissingFieldsHandling("ignore");
    setColumnHeaders([]); setRawRows([]); setFieldMapping({}); setAutoMapping(true);
    setError(""); setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function applyAutoMap(headers: string[]) {
    const mapping: Record<string, string> = {};
    const h = headers.map((h) => h.toLowerCase().trim());
    for (const field of IMPORT_FIELDS) {
      const aliases: Record<string, string[]> = {
        summary: ["summary", "name", "title", "test case"],
        description: ["description", "desc"],
        precondition: ["precondition", "pre-condition", "preconditions"],
        status: ["status"],
        priority: ["priority"],
        labels: ["labels", "label", "tags"],
        storyLinkages: ["story linkages", "jira keys", "requirement keys", "story links"],
        workKey: ["work key", "key"],
        assignee: ["assignee", "assigned to"],
        reporter: ["reporter"],
        estimatedTime: ["estimated time", "estimate"],
        components: ["components", "component"],
        sprint: ["sprint"],
        folders: ["folders", "folder"],
        steps: ["step summary", "steps summary", "step details", "test steps"],
        testData: ["test data", "testdata"],
        expectedResult: ["expected result", "expected results", "expected"],
      };
      const matches = aliases[field.key] ?? [field.label.toLowerCase()];
      const found = headers[h.findIndex((col) => matches.some((m) => col.includes(m)))] ?? "";
      if (found) mapping[field.key] = found;
    }
    return mapping;
  }

  async function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError("");
    setParsing(true);

    try {
      if (f.name.endsWith(".csv")) {
        const text = await f.text();
        const { headers, rows } = parseCsv(text);
        setColumnHeaders(headers);
        setRawRows(rows);
        setSheets([]);
        if (autoMapping) setFieldMapping(applyAutoMap(headers));
      } else if (f.name.endsWith(".feature")) {
        setColumnHeaders([]);
        setRawRows([]);
        setSheets([]);
      } else {
        const result = await parseXlsx(f);
        if (result.unsupported) {
          setError("XLSX/XLS parsing is not yet available. Please save your file as CSV and re-import, or contact support.");
          setFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          setParsing(false);
          return;
        }
        setSheets(result.sheets);
        setSelectedSheet(result.sheets[0] ?? "");
        setColumnHeaders(result.headers);
        setRawRows(result.rows);
        if (autoMapping) setFieldMapping(applyAutoMap(result.headers));
      }
    } catch {
      setError("Failed to parse file. Please check the format.");
    }
    setParsing(false);
  }

  function handleAutoMapToggle() {
    const next = !autoMapping;
    setAutoMapping(next);
    if (next) setFieldMapping(applyAutoMap(columnHeaders));
  }

  async function handleStartImport() {
    if (!file) return;
    setImporting(true);
    setError("");

    try {
      let cases: ImportCase[] = [];

      if (file.name.endsWith(".feature")) {
        const text = await file.text();
        cases = parseFeature(text);
      } else {
        cases = groupRowsIntoTestCases(rawRows, fieldMapping).filter((c) => c.summary.trim());
      }

      if (cases.length === 0) {
        setError("No valid test cases found. Check that the Summary field is mapped correctly.");
        setImporting(false);
        return;
      }

      const res = await fetch("/api/testcases/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          cases,
          folderId: destFolderId || undefined,
          duplicateHandling,
          missingFieldsHandling,
        }),
      });

      let data: Record<string, unknown> = {};
      try { data = await res.json(); } catch { /* non-JSON response handled below */ }
      if (res.ok) {
        onImported((data.imported as number) ?? 0);
        reset();
        onClose();
      } else {
        setError((data.error as string) ?? `Import failed (HTTP ${res.status}). Check the server logs.`);
      }
    } catch (e) {
      console.error("[import] client error:", e);
      setError("Import request failed. Check the browser console for details.");
    }
    setImporting(false);
  }

  const canProceedStep1 = !!file && !parsing;

  function renderFolderOptions(nodes: FolderNode[], depth = 0): React.ReactNode[] {
    return nodes.flatMap((n) => [
      <SelectItem key={n.id} value={n.id}>
        {"—".repeat(depth) + (depth > 0 ? " " : "")}{n.name}
      </SelectItem>,
      ...renderFolderOptions(n.children, depth + 1),
    ]);
  }

  return (
    <>
      <ImportGuideModal open={showGuide} onClose={() => setShowGuide(false)} />
      <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
        <DialogContent className="max-w-2xl" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-brand-500" />
              Import Test Case
              <span className="ml-auto text-sm font-normal text-brand-600">
                {step === 1 ? "Step 1. Upload File" : "Step 2. Map Fields"}
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* ---- STEP 1 ---- */}
          {step === 1 && (
            <div className="space-y-5">
              <div
                className="relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xls,.xlsx,.csv,.feature"
                  className="hidden"
                  onChange={onFileSelect}
                />
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                {file ? (
                  <div className="flex items-center justify-center gap-2 text-sm font-medium text-brand-600">
                    <FileText className="h-4 w-4" />
                    {file.name}
                    {parsing && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium">Drop files to attach, or <span className="text-brand-600 underline">select files</span></p>
                    <p className="text-xs text-muted-foreground mt-1">Supported files: .XLS, .XLSX, .CSV</p>
                    <p className="text-xs text-muted-foreground">Maximum file size: 10 MB</p>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select Sheet {sheets.length > 0 && "*"}</label>
                  {sheets.length > 0 ? (
                    <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select sheet" />
                      </SelectTrigger>
                      <SelectContent>
                        {sheets.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="h-9 rounded-md border bg-muted/30 flex items-center px-3 text-sm text-muted-foreground">
                      {file ? (file.name.endsWith(".feature") ? "N/A (Gherkin)" : "Auto-detected") : "Upload file first"}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Destination Folder</label>
                  <Select value={destFolderId || "__none__"} onValueChange={(v) => setDestFolderId(v === "__none__" ? "" : v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All Test Cases" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">All Test Cases (root)</SelectItem>
                      {renderFolderOptions(folders)}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Test cases will be imported into the Destination folder. (By default, they will be imported into &quot;All Test Cases&quot;)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 rounded-xl border p-4 bg-muted/20">
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2.5">
                    If Test Case with the same key already exists in the system, then
                  </p>
                  <div className="space-y-2">
                    {([
                      { value: "new_version", label: "Import with New Version" },
                      { value: "skip", label: "Skip" },
                    ] as const).map(({ value, label }) => (
                      <label key={value} className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="radio"
                          name="duplicateHandling"
                          value={value}
                          checked={duplicateHandling === value}
                          onChange={() => setDuplicateHandling(value)}
                          className="accent-brand-500"
                        />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2.5">
                    If Test Case fields like components, labels doesn{"'"}t exist in the space
                  </p>
                  <div className="space-y-2">
                    {([
                      { value: "create", label: "Create" },
                      { value: "ignore", label: "Ignore" },
                    ] as const).map(({ value, label }) => (
                      <label key={value} className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="radio"
                          name="missingFieldsHandling"
                          value={value}
                          checked={missingFieldsHandling === value}
                          onChange={() => setMissingFieldsHandling(value)}
                          className="accent-brand-500"
                        />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* ---- STEP 2 ---- */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Map your spreadsheet columns to test case fields.
                </p>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <span className="text-muted-foreground">Auto Mapping</span>
                  <button
                    onClick={handleAutoMapToggle}
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                      autoMapping ? "bg-brand-500" : "bg-muted-foreground/30"
                    )}
                  >
                    <span className={cn(
                      "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow",
                      autoMapping ? "translate-x-4" : "translate-x-0.5"
                    )} />
                  </button>
                </label>
              </div>

              <div className="rounded-xl border overflow-hidden max-h-[360px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground w-1/3">Test Case Field</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Sheet Field</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {IMPORT_FIELDS.map(({ key, label, required }) => (
                      <tr key={key} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5">
                          {label}
                          {required && <span className="text-red-500 ml-0.5">*</span>}
                        </td>
                        <td className="px-4 py-2">
                          <Select
                            value={fieldMapping[key] ?? "__none__"}
                            onValueChange={(v) => setFieldMapping((prev) => ({
                              ...prev,
                              [key]: v === "__none__" ? "" : v,
                            }))}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— Not mapped —</SelectItem>
                              {columnHeaders.map((h) => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {columnHeaders.length === 0 && !file?.name.endsWith(".feature") && (
                <p className="text-sm text-amber-600 bg-amber-50 rounded-md px-3 py-2">
                  No column headers detected. Please go back and verify your file has a header row.
                </p>
              )}

              <p className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
                <strong>Steps:</strong> Map a column named{" "}
                <code className="font-mono bg-muted px-1 rounded">Step Summary</code> or{" "}
                <code className="font-mono bg-muted px-1 rounded">Steps Summary</code> — it is auto-detected if left unmapped.
                Separate multiple steps with a semicolon (<code className="font-mono bg-muted px-1 rounded">;</code>).
                Alternatively, columns named <code className="font-mono bg-muted px-1 rounded">Step 1</code>,{" "}
                <code className="font-mono bg-muted px-1 rounded">Step 1 - Test Data</code>,{" "}
                <code className="font-mono bg-muted px-1 rounded">Step 1 - Expected Result</code>, etc. are also auto-detected.
              </p>

              {file?.name.endsWith(".feature") && (
                <p className="text-sm text-blue-600 bg-blue-50 rounded-md px-3 py-2">
                  Gherkin .feature files are automatically mapped — no manual field mapping required.
                </p>
              )}

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex items-center justify-between">
            <button
              className="flex items-center gap-1.5 text-xs text-brand-600 hover:underline"
              onClick={() => setShowGuide(true)}
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Import Guide
            </button>
            <div className="flex items-center gap-2">
              {step === 2 && (
                <Button variant="outline" size="sm" onClick={() => setStep(1)} disabled={importing}>
                  Back
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => { reset(); onClose(); }}>
                Cancel
              </Button>
              {step === 1 ? (
                <Button size="sm" onClick={() => setStep(2)} disabled={!canProceedStep1}>
                  Next
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleStartImport}
                  disabled={importing || (!fieldMapping.summary && !file?.name.endsWith(".feature"))}
                >
                  {importing && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                  Start Import
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Link to Cycle modal
// ---------------------------------------------------------------------------

interface TestCycleBasic {
  id: string;
  key: string;
  summary: string;
}

function LinkToCycleModal({
  open,
  testCaseIds,
  projectId,
  onClose,
}: {
  open: boolean;
  testCaseIds: string[];
  projectId: string;
  onClose: () => void;
}) {
  const [cycles, setCycles] = useState<TestCycleBasic[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  const isBulk = testCaseIds.length > 1;

  useEffect(() => {
    if (!open || !projectId) return;
    setLoading(true);
    fetch(`/api/testcycles?projectId=${projectId}`)
      .then((r) => r.json())
      .then((d) => { setCycles(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [open, projectId]);

  async function linkToCycle(cycleId: string) {
    setLinking(cycleId);
    for (const tcId of testCaseIds) {
      await fetch(`/api/testcycles/${cycleId}/testcases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testCaseId: tcId }),
      });
    }
    setDone((prev) => new Set([...prev, cycleId]));
    setLinking(null);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setDone(new Set()); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isBulk ? `Link ${testCaseIds.length} Test Cases to Cycle` : "Link to Test Cycle"}
          </DialogTitle>
        </DialogHeader>
        {isBulk && (
          <p className="text-xs text-muted-foreground -mt-2">
            All {testCaseIds.length} selected test cases will be added to the chosen cycle.
          </p>
        )}
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : cycles.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No test cycles found. Create a cycle first.</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {cycles.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-blue-600 font-bold">{c.key}</p>
                  <p className="text-sm truncate">{c.summary}</p>
                </div>
                {done.has(c.id) ? (
                  <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                    <CheckCircle2 className="h-4 w-4" /> Linked
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 h-7 text-xs"
                    onClick={() => linkToCycle(c.id)}
                    disabled={linking === c.id}
                  >
                    {linking === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    Link
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => { setDone(new Set()); onClose(); }}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Per-row action buttons with inline "Move to Folder" picker
// ---------------------------------------------------------------------------

function RowActions({
  tc,
  projectId,
  cloningId,
  flatFolders,
  isAdmin,
  onEdit,
  onLinkCycle,
  onClone,
  onDelete,
  onRestore,
  onMove,
}: {
  tc: TestCase;
  projectId: string;
  cloningId: string | null;
  flatFolders: { id: string; name: string; depth: number }[];
  isAdmin: boolean;
  onEdit: () => void;
  onView: () => void;
  onLinkCycle: () => void;
  onClone: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onRestore: (e: React.MouseEvent) => void;
  onMove: (folderId: string | null) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity relative">
      <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit"
        onClick={(e) => { e.stopPropagation(); onEdit(); }}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Link href={`/cases/${tc.id}?projectId=${projectId}`} onClick={(e) => e.stopPropagation()}>
        <Button size="icon" variant="ghost" className="h-7 w-7" title="View">
          <Eye className="h-3.5 w-3.5" />
        </Button>
      </Link>
      <div className="relative">
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Move to folder"
          onClick={(e) => { e.stopPropagation(); setShowPicker((p) => !p); }}>
          <FolderIcon className="h-3.5 w-3.5" />
        </Button>
        {showPicker && (
          <div
            className="absolute right-0 top-full mt-1 z-50 w-52 bg-background border border-border rounded-lg shadow-lg py-1 max-h-56 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-3 py-1 text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">Move to</p>
            <button
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 flex items-center gap-2"
              onClick={() => { onMove(null); setShowPicker(false); }}
            >
              <FlaskConical className="h-3.5 w-3.5 text-brand-500 shrink-0" />
              <span className="font-medium">All Test Cases</span>
              {!tc.folder && <span className="ml-auto text-[10px] text-muted-foreground">current</span>}
            </button>
            {flatFolders.length > 0 && <div className="border-t my-1" />}
            {flatFolders.map((f) => (
              <button
                key={f.id}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 flex items-center gap-2"
                style={{ paddingLeft: `${12 + f.depth * 10}px` }}
                onClick={() => { onMove(f.id); setShowPicker(false); }}
              >
                <FolderIcon className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="truncate">{f.name}</span>
                {tc.folder?.id === f.id && <span className="ml-auto text-[10px] text-muted-foreground">current</span>}
              </button>
            ))}
            {flatFolders.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">No folders yet.</p>
            )}
          </div>
        )}
      </div>
      {tc.status === "DEPRECATED" ? (
        <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-green-600" title="Restore"
          onClick={onRestore}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Link to Cycle"
          onClick={(e) => { e.stopPropagation(); onLinkCycle(); }}>
          <Link2 className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button size="icon" variant="ghost" className="h-7 w-7" title="Clone"
        onClick={onClone} disabled={cloningId === tc.id}>
        {cloningId === tc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
      {isAdmin && (
        <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" title="Delete (Admin only)"
          onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TcDetailPanel — slide-in detail sub-component
// ---------------------------------------------------------------------------

function TcDetailPanel({ tcId, projectId }: { tcId: string; projectId: string }) {
  const [tc, setTc] = useState<any>(null);

  useEffect(() => {
    setTc(null);
    fetch(`/api/testcases/${tcId}`).then(r => r.json()).then(setTc);
  }, [tcId]);

  if (!tc) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const latestVersion = tc.versions?.find((v: any) => v.isLatest) ?? tc.versions?.[0];

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <span className="font-mono text-xs text-muted-foreground">{tc.key}</span>
        <h2 className="text-sm font-semibold mt-1">{tc.summary}</h2>
      </div>

      {/* Status + Priority */}
      <div className="flex gap-2 flex-wrap">
        <span className={cn(
          "px-2 py-0.5 rounded-full text-xs border",
          tc.status === "READY"
            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
            : tc.status === "DEPRECATED"
            ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800"
            : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
        )}>
          {tc.status}
        </span>
        {tc.priority && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ background: tc.priority.color }} />
            {tc.priority.name}
          </span>
        )}
      </div>

      {/* Description */}
      {tc.description && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
          <p className="text-sm text-foreground">{tc.description}</p>
        </div>
      )}

      {/* Steps */}
      {latestVersion?.steps?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Steps ({latestVersion.steps.length})</p>
          <div className="space-y-2">
            {latestVersion.steps.map((step: any, i: number) => (
              <div key={step.id} className="flex gap-2 text-xs">
                <span className="font-mono text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                <p className="text-foreground">{step.stepDetails}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* JIRA keys */}
      {tc.jiraRequirementKeys?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Requirements</p>
          <div className="flex flex-wrap gap-1">
            {tc.jiraRequirementKeys.map((key: string) => (
              <span key={key} className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-mono dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800">
                {key}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Open full view link */}
      <Link
        href={`/cases/${tcId}?projectId=${projectId}`}
        className="block text-center text-xs text-primary hover:underline pt-2 border-t border-border"
      >
        Open full test case →
      </Link>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Accordion Steps Panel Component
// ---------------------------------------------------------------------------

interface AccordionStepsPanelProps {
  tc: TestCase;
  editingStepId: string | null;
  editingStepData: { stepDetails: string; testData: string; expectedResult: string } | null;
  savingStepId: string | null;
  showNewStepForm: string | null;
  newStepDetails: string;
  newStepTestData: string;
  newStepExpectedResult: string;
  onStartEditStep: (stepId: string, step: Step) => void;
  onCancelEditStep: () => void;
  onChangeStepField: (field: "stepDetails" | "testData" | "expectedResult", value: string) => void;
  onSaveStep: (tcId: string, stepId: string) => void;
  onDeleteStep: (tcId: string, stepId: string) => void;
  onShowNewStepForm: (tcId: string) => void;
  onCancelNewStep: () => void;
  onChangeNewStepField: (field: "newStepDetails" | "newStepTestData" | "newStepExpectedResult", value: string) => void;
  onSaveNewStep: (tcId: string) => void;
}

function AccordionStepsPanel({
  tc,
  editingStepId,
  editingStepData,
  savingStepId,
  showNewStepForm,
  newStepDetails,
  newStepTestData,
  newStepExpectedResult,
  onStartEditStep,
  onCancelEditStep,
  onChangeStepField,
  onSaveStep,
  onDeleteStep,
  onShowNewStepForm,
  onCancelNewStep,
  onChangeNewStepField,
  onSaveNewStep,
}: AccordionStepsPanelProps) {
  const steps = tc.versions[0]?.steps ?? [];
  const tcId = tc.id;

  if (!tc.versions[0]) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No version data available.{" "}
        <Link href={`/cases/${tcId}`} className="text-primary hover:underline">
          Open full view
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-muted/20 border-t border-border">
      <table className="w-full text-xs" style={{ tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: 32 }} />
          <col />
          <col style={{ width: "25%" }} />
          <col style={{ width: "25%" }} />
          <col style={{ width: 80 }} />
        </colgroup>
        <thead className="bg-muted/40 border-b border-border">
          <tr>
            <th className="text-center px-2 py-2 font-semibold text-muted-foreground">#</th>
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Step Details</th>
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Test Data</th>
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Expected Result</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {steps.length === 0 && showNewStepForm !== tcId && (
            <tr>
              <td colSpan={5} className="px-4 py-4 text-center text-muted-foreground text-xs">
                No steps yet.
              </td>
            </tr>
          )}
          {steps.map((step, idx) =>
            editingStepId === step.id ? (
              /* EDIT ROW */
              <tr key={step.id} className="bg-background border-b border-border">
                <td className="px-2 py-2 text-center text-muted-foreground font-mono">{idx + 1}</td>
                <td className="px-2 py-2">
                  <Textarea
                    value={editingStepData?.stepDetails ?? ""}
                    onChange={e => onChangeStepField("stepDetails", e.target.value)}
                    className="min-h-[52px] text-xs resize-none"
                    rows={2}
                    autoFocus
                  />
                </td>
                <td className="px-2 py-2">
                  <Textarea
                    value={editingStepData?.testData ?? ""}
                    onChange={e => onChangeStepField("testData", e.target.value)}
                    className="min-h-[52px] text-xs resize-none"
                    rows={2}
                  />
                </td>
                <td className="px-2 py-2">
                  <Textarea
                    value={editingStepData?.expectedResult ?? ""}
                    onChange={e => onChangeStepField("expectedResult", e.target.value)}
                    className="min-h-[52px] text-xs resize-none"
                    rows={2}
                  />
                </td>
                <td className="px-2 py-2">
                  <div className="flex flex-col gap-1">
                    <Button
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => onSaveStep(tcId, step.id)}
                      disabled={savingStepId === step.id || !editingStepData?.stepDetails.trim()}
                    >
                      {savingStepId === step.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={onCancelEditStep}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ) : (
              /* READ-ONLY ROW */
              <tr key={step.id} className="border-b border-border group/step hover:bg-muted/30 transition-colors align-top">
                <td className="px-2 py-2.5 text-center font-mono text-muted-foreground">{idx + 1}</td>
                <td className="px-3 py-2.5 text-foreground leading-relaxed">{step.stepDetails}</td>
                <td className="px-3 py-2.5">
                  {step.testData ? (
                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground/80 break-all">{step.testData}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground leading-relaxed">{step.expectedResult || "—"}</td>
                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-1 opacity-0 group-hover/step:opacity-100 transition-opacity">
                    <button
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      title="Edit step"
                      onClick={e => {
                        e.stopPropagation();
                        onStartEditStep(step.id, step);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      title="Delete step"
                      onClick={e => {
                        e.stopPropagation();
                        onDeleteStep(tcId, step.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </td>
              </tr>
            )
          )}

          {/* ADD STEP FORM ROW */}
          {showNewStepForm === tcId && (
            <tr className="bg-background border-b border-border">
              <td className="px-2 py-2 text-center text-muted-foreground font-mono">{steps.length + 1}</td>
              <td className="px-2 py-2">
                <Textarea
                  value={newStepDetails}
                  onChange={e => onChangeNewStepField("newStepDetails", e.target.value)}
                  placeholder="Step action…"
                  className="min-h-[52px] text-xs resize-none"
                  rows={2}
                  autoFocus
                />
              </td>
              <td className="px-2 py-2">
                <Textarea
                  value={newStepTestData}
                  onChange={e => onChangeNewStepField("newStepTestData", e.target.value)}
                  placeholder="Input data…"
                  className="min-h-[52px] text-xs resize-none"
                  rows={2}
                />
              </td>
              <td className="px-2 py-2">
                <Textarea
                  value={newStepExpectedResult}
                  onChange={e => onChangeNewStepField("newStepExpectedResult", e.target.value)}
                  placeholder="Expected outcome…"
                  className="min-h-[52px] text-xs resize-none"
                  rows={2}
                />
              </td>
              <td className="px-2 py-2">
                <div className="flex flex-col gap-1">
                  <Button size="sm" className="h-6 text-xs px-2" onClick={() => onSaveNewStep(tcId)} disabled={!newStepDetails.trim()}>
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={onCancelNewStep}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Footer: Add Step button */}
      {showNewStepForm !== tcId && editingStepId === null && (
        <div className="px-4 py-2 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{steps.length} step{steps.length !== 1 ? "s" : ""}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1"
            onClick={e => {
              e.stopPropagation();
              onShowNewStepForm(tcId);
            }}
          >
            <Plus className="h-3 w-3" /> Add Step
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  READY: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
  DRAFT: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
  DEPRECATED: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
};

const ALL_TC_STATUSES = ["DRAFT", "READY", "DEPRECATED"] as const;

export default function CasesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get("projectId") ?? "";
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const [cases, setCases] = useState<TestCase[]>([]);
  const [loading, setCasesLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState("1");

  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [folderSidebarOpen, setFolderSidebarOpen] = useState(true);

  const [showImport, setShowImport] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSummary, setEditSummary] = useState("");
  const [editStatus, setEditStatus] = useState("");

  // Clone
  const [cloningId, setCloningId] = useState<string | null>(null);

  // Link to cycle
  const [linkingTcId, setLinkingTcId] = useState<string | null>(null);

  // Bulk selection with shift-click support
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null);
  const [bulkWorking, setBulkWorking] = useState(false);

  // Drag-and-drop folder move
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | "root" | null>(null);

  // Move-to-folder picker (for bulk toolbar)
  const [showMoveToFolder, setShowMoveToFolder] = useState(false);
  const [showStatusChange, setShowStatusChange] = useState(false);

  // Slide-in detail panel
  const [selectedTcId, setSelectedTcId] = useState<string | null>(null);

  const [expandedTcId, setExpandedTcId] = useState<string | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingStepData, setEditingStepData] = useState<{ stepDetails: string; testData: string; expectedResult: string } | null>(null);
  const [savingStepId, setSavingStepId] = useState<string | null>(null);
  const [addingStepTcId, setAddingStepTcId] = useState<string | null>(null);
  const [showNewStepForm, setShowNewStepForm] = useState<string | null>(null);
  const [newStepDetails, setNewStepDetails] = useState("");
  const [newStepTestData, setNewStepTestData] = useState("");
  const [newStepExpectedResult, setNewStepExpectedResult] = useState("");
  const { width: folderSidebarWidth, onMouseDown: onFolderSidebarResize } = useResizablePanel(240, {
    min: 160, max: 480, storageKey: "cases-folder-sidebar",
  });
  const { width: detailPanelWidth, onMouseDown: onDetailPanelResize } = useResizablePanel(384, {
    min: 280, max: 640, storageKey: "cases-detail-panel",
  });

  async function moveToFolder(tcIds: string[], folderId: string | null) {
    setBulkWorking(true);
    try {
      const res = await fetch("/api/testcases/bulk/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testCaseIds: tcIds,
          folderId: folderId ?? null,
        }),
      });

      if (res.ok) {
        setCases((prev) =>
          prev.map((c) =>
            tcIds.includes(c.id)
              ? { ...c, folder: folderId ? { id: folderId, name: flatFolders.find((f) => f.id === folderId)?.name ?? "" } : null }
              : c
          )
        );
        setImportMsg({ type: "success", text: `Moved ${tcIds.length} test case${tcIds.length !== 1 ? "s" : ""}.` });
      } else {
        setImportMsg({ type: "error", text: "Failed to move test cases." });
      }
    } catch (e) {
      console.error("[moveToFolder] error:", e);
      setImportMsg({ type: "error", text: "Failed to move test cases." });
    } finally {
      setSelectedIds(new Set());
      setBulkWorking(false);
      setShowMoveToFolder(false);
      setTimeout(() => setImportMsg(null), 3000);
    }
  }

  function toggleSelect(id: string, idx: number, shiftKey = false) {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const globalIdx = startIndex + idx;

    if (shiftKey && lastSelectedIdx !== null) {
      const lo = Math.min(lastSelectedIdx, globalIdx);
      const hi = Math.max(lastSelectedIdx, globalIdx);
      const rangeIds = filtered.slice(lo, hi + 1).map((tc) => tc.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        rangeIds.forEach((rid) => next.add(rid));
        return next;
      });
      setLastSelectedIdx(globalIdx);
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
      setLastSelectedIdx(globalIdx);
    }
  }

  function toggleStatusFilter(status: string) {
    setActiveStatuses(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  async function bulkClone() {
    setBulkWorking(true);
    let cloned = 0;
    for (const id of selectedIds) {
      const res = await fetch(`/api/testcases/${id}/clone`, { method: "POST" });
      if (res.ok) cloned++;
    }
    setSelectedIds(new Set());
    setBulkWorking(false);
    setImportMsg({ type: "success", text: `Cloned ${cloned} test case${cloned !== 1 ? "s" : ""}.` });
    loadCases();
    setTimeout(() => setImportMsg(null), 4000);
  }

  async function bulkArchive() {
    if (!confirm(`Archive ${selectedIds.size} test case${selectedIds.size !== 1 ? "s" : ""}? Their status will be set to Deprecated.`)) return;
    setBulkWorking(true);
    let archived = 0;
    for (const id of selectedIds) {
      const res = await fetch(`/api/testcases/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DEPRECATED" }),
      });
      if (res.ok) archived++;
    }
    setSelectedIds(new Set());
    setBulkWorking(false);
    setImportMsg({ type: "success", text: `Archived ${archived} test case${archived !== 1 ? "s" : ""}.` });
    loadCases();
    setTimeout(() => setImportMsg(null), 4000);
  }

  async function restoreCase(id: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    const res = await fetch(`/api/testcases/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DRAFT" }),
    });
    if (res.ok) {
      setCases((prev) => prev.map((c) => c.id === id ? { ...c, status: "DRAFT" } : c));
      setImportMsg({ type: "success", text: "Test case restored to Draft." });
      setTimeout(() => setImportMsg(null), 3000);
    }
  }

  function bulkLinkToCycle() {
    setLinkingTcId("__bulk__");
  }

  async function bulkChangeStatus(newStatus: string) {
    setBulkWorking(true);
    let changed = 0;
    for (const id of selectedIds) {
      const res = await fetch(`/api/testcases/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) changed++;
    }
    setCases((prev) => prev.map((c) => selectedIds.has(c.id) ? { ...c, status: newStatus } : c));
    setSelectedIds(new Set());
    setBulkWorking(false);
    setShowStatusChange(false);
    setImportMsg({ type: "success", text: `Updated ${changed} test case${changed !== 1 ? "s" : ""} to ${newStatus}.` });
    setTimeout(() => setImportMsg(null), 4000);
  }

  // Case counts per folder
  const caseCounts: Record<string, number> = {};
  for (const tc of cases) {
    if (tc.folder?.id) caseCounts[tc.folder.id] = (caseCounts[tc.folder.id] ?? 0) + 1;
  }

  function flattenFolders(nodes: FolderNode[], depth = 0): { id: string; name: string; depth: number }[] {
    return nodes.flatMap((n) => [{ id: n.id, name: n.name, depth }, ...flattenFolders(n.children, depth + 1)]);
  }
  const flatFolders = flattenFolders(folders);

  const loadCases = useCallback(() => {
    if (!projectId) { setCasesLoading(false); return; }
    const url = `/api/testcases?projectId=${projectId}${showArchived ? "&includeArchived=true" : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => { setCases(Array.isArray(d) ? d : []); setCasesLoading(false); })
      .catch(() => setCasesLoading(false));
  }, [projectId, showArchived]);

  const loadFolders = useCallback(() => {
    if (!projectId) return;
    fetch(`/api/folders?projectId=${projectId}&type=CASE`)
      .then((r) => r.json())
      .then((d) => setFolders(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [projectId]);

  useEffect(() => { loadCases(); loadFolders(); }, [loadCases, loadFolders]);

  const filtered = cases.filter((c) => {
    const matchesFolder = !selectedFolderId ? true : c.folder?.id === selectedFolderId;
    const matchesQuery = c.summary.toLowerCase().includes(query.toLowerCase()) ||
      c.key.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = activeStatuses.size === 0 || activeStatuses.has(c.status);
    return matchesFolder && matchesQuery && matchesStatus;
  });

  useEffect(() => {
    setCurrentPage(1);
    setPageInputValue("1");
  }, [selectedFolderId, query, activeStatuses]);

  const allSelected = filtered.length > 0 && filtered.every((tc) => selectedIds.has(tc.id));
  const someSelected = !allSelected && filtered.some((tc) => selectedIds.has(tc.id));
  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((tc) => tc.id)));
    }
  }

  async function createFolder() {
    if (!newFolderName.trim() || !projectId) return;
    setCreatingFolder(true);
    await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, name: newFolderName.trim(), type: "CASE" }),
    });
    setNewFolderName("");
    setShowNewFolder(false);
    setCreatingFolder(false);
    loadFolders();
  }

  async function deleteFolder(id: string, name: string) {
    if (!confirm(`Delete folder "${name}"? Test cases inside will become unfoldered.`)) return;
    await fetch(`/api/folders?id=${id}`, { method: "DELETE" });
    if (selectedFolderId === id) setSelectedFolderId(null);
    loadFolders();
  }

  async function renameFolder(id: string, newName: string) {
    await loadFolders();
  }

  async function moveFolder(id: string) {
    await loadFolders();
  }

  async function cloneCase(id: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    setCloningId(id);
    const res = await fetch(`/api/testcases/${id}/clone`, { method: "POST" });
    if (res.ok) {
      setImportMsg({ type: "success", text: "Test case cloned successfully." });
      loadCases();
    } else {
      setImportMsg({ type: "error", text: "Failed to clone test case." });
    }
    setCloningId(null);
    setTimeout(() => setImportMsg(null), 4000);
  }

  async function deleteCase(id: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm("Permanently delete this test case? This cannot be undone.")) return;
    const res = await fetch(`/api/testcases/${id}`, { method: "DELETE" });
    if (res.ok) {
      setCases((prev) => prev.filter((c) => c.id !== id));
      if (selectedTcId === id) setSelectedTcId(null);
    } else {
      const data = await res.json().catch(() => ({}));
      setImportMsg({ type: "error", text: (data as { error?: string }).error ?? "Failed to delete test case." });
      setTimeout(() => setImportMsg(null), 4000);
    }
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/testcases/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary: editSummary, status: editStatus }),
    });
    if (res.ok) {
      setCases((prev) => prev.map((c) => c.id === id ? { ...c, summary: editSummary, status: editStatus } : c));
      setEditingId(null);
    }
  }

  async function saveAccordionStep(tcId: string, stepId: string) {
    if (!editingStepData) return;
    setSavingStepId(stepId);

    const tc = cases.find(c => c.id === tcId);
    if (!tc?.versions[0]) { setSavingStepId(null); return; }

    const updatedSteps = tc.versions[0].steps.map((s, i) =>
      s.id === stepId
        ? { ...s, ...editingStepData, order: i + 1 }
        : { ...s, order: i + 1 }
    );

    const res = await fetch(`/api/testcases/${tcId}/steps`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps: updatedSteps.map(s => ({
        order: s.order,
        stepDetails: s.stepDetails,
        testData: s.testData ?? "",
        expectedResult: s.expectedResult ?? "",
      })) }),
    });

    if (res.ok) {
      const freshSteps: Step[] = await res.json();
      setCases(prev =>
        prev.map(c =>
          c.id === tcId
            ? { ...c, versions: [{ ...c.versions[0], steps: freshSteps }] }
            : c
        )
      );
      setEditingStepId(null);
      setEditingStepData(null);
    }
    setSavingStepId(null);
  }

  async function deleteAccordionStep(tcId: string, stepId: string) {
    if (!confirm("Delete this step?")) return;
    const tc = cases.find(c => c.id === tcId);
    if (!tc?.versions[0]) return;

    const updatedSteps = tc.versions[0].steps
      .filter(s => s.id !== stepId)
      .map((s, i) => ({ ...s, order: i + 1 }));

    const res = await fetch(`/api/testcases/${tcId}/steps`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps: updatedSteps.map(s => ({
        order: s.order,
        stepDetails: s.stepDetails,
        testData: s.testData ?? "",
        expectedResult: s.expectedResult ?? "",
      })) }),
    });

    if (res.ok) {
      const freshSteps: Step[] = await res.json();
      setCases(prev =>
        prev.map(c =>
          c.id === tcId
            ? { ...c, versions: [{ ...c.versions[0], steps: freshSteps }] }
            : c
        )
      );
    }
  }

  async function saveNewAccordionStep(tcId: string) {
    if (!newStepDetails.trim()) return;
    const tc = cases.find(c => c.id === tcId);
    if (!tc?.versions[0]) return;

    setAddingStepTcId(tcId);
    const currentSteps = tc.versions[0].steps;
    const updatedSteps = [
      ...currentSteps.map((s, i) => ({ ...s, order: i + 1 })),
      {
        order: currentSteps.length + 1,
        stepDetails: newStepDetails.trim(),
        testData: newStepTestData.trim(),
        expectedResult: newStepExpectedResult.trim(),
      },
    ];

    const res = await fetch(`/api/testcases/${tcId}/steps`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps: updatedSteps.map(s => ({
        order: s.order,
        stepDetails: s.stepDetails,
        testData: s.testData ?? "",
        expectedResult: s.expectedResult ?? "",
      })) }),
    });

    if (res.ok) {
      const freshSteps: Step[] = await res.json();
      setCases(prev =>
        prev.map(c =>
          c.id === tcId
            ? { ...c, versions: [{ ...c.versions[0], steps: freshSteps }] }
            : c
        )
      );
      setShowNewStepForm(null);
      setNewStepDetails("");
      setNewStepTestData("");
      setNewStepExpectedResult("");
    }
    setAddingStepTcId(null);
  }

  function exportCases() {
    const url = `/api/testcases/export?projectId=${projectId}${selectedFolderId ? `&folderId=${selectedFolderId}` : ""}`;
    window.open(url, "_blank");
  }

  const selectedFolderName = selectedFolderId
    ? (function findName(nodes: FolderNode[]): string | null {
        for (const n of nodes) {
          if (n.id === selectedFolderId) return n.name;
          const c = findName(n.children);
          if (c) return c;
        }
        return null;
      })(folders)
    : null;

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <FlaskConical className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Select a project from the sidebar to view test cases.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* ======================================================================
          FOLDER SIDEBAR
      ====================================================================== */}
      <aside
        style={folderSidebarOpen ? { width: folderSidebarWidth } : undefined}
        className={cn(
          "shrink-0 flex flex-col bg-background overflow-hidden transition-[width] duration-200",
          folderSidebarOpen ? "" : "w-0"
        )}
      >
        <div className="px-3 py-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Folders</span>
            <button
              onClick={() => setShowNewFolder((p) => !p)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="New folder"
            >
              <FolderPlus className="h-4 w-4" />
            </button>
          </div>
          {showNewFolder && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <Input
                className="h-7 text-xs"
                placeholder="Folder name..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") createFolder(); if (e.key === "Escape") setShowNewFolder(false); }}
                autoFocus
              />
              <Button size="icon" className="h-7 w-7" onClick={createFolder} disabled={creatingFolder || !newFolderName.trim()}>
                {creatingFolder ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              </Button>
            </div>
          )}
        </div>

        {/* Folder tree */}
        <div className="flex-1 overflow-y-auto p-2">
          <div
            onClick={() => setSelectedFolderId(null)}
            onDragOver={(e) => { e.preventDefault(); setDragOverFolderId("root"); }}
            onDragLeave={() => setDragOverFolderId(null)}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("tcId");
              if (id) {
                const ids = selectedIds.has(id) ? Array.from(selectedIds) : [id];
                moveToFolder(ids, null);
              }
              setDragOverFolderId(null);
            }}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors select-none",
              !selectedFolderId ? "bg-brand-50 text-brand-700 font-medium" : "hover:bg-muted/50 text-foreground",
              dragOverFolderId === "root" && "ring-2 ring-brand-400 bg-brand-50"
            )}
          >
            <FlaskConical className="h-3.5 w-3.5 shrink-0 text-brand-500" />
            <span className="flex-1">All Test Cases</span>
            <span className="text-[11px] text-muted-foreground">{cases.length}</span>
          </div>

          {folders.map((node) => (
            <FolderTreeNode
              key={node.id}
              node={node}
              depth={0}
              selected={selectedFolderId}
              allCount={cases.length}
              caseCounts={caseCounts}
              projectId={projectId}
              onSelect={setSelectedFolderId}
              onDelete={deleteFolder}
              onRename={renameFolder}
              onMove={moveFolder}
              dragOverId={dragOverFolderId}
              onDragOver={(fid) => setDragOverFolderId(fid || null)}
              onDrop={(folderId) => {
                const id = draggingId;
                setDragOverFolderId(null);
                setDraggingId(null);
                if (id) {
                  const ids = selectedIds.has(id) ? Array.from(selectedIds) : [id];
                  moveToFolder(ids, folderId);
                }
              }}
            />
          ))}

          {folders.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4 px-2">
              No folders yet. Click + to create one.
            </p>
          )}
        </div>
      </aside>

      {folderSidebarOpen && <PanelResizeHandle onMouseDown={onFolderSidebarResize} />}

      {/* ======================================================================
          MAIN LIST AREA
      ====================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden" data-testid={TestIds.cases.page}>

        {/* Toolbar */}
        <div className="p-4 border-b border-border space-y-3 shrink-0" data-testid="cases-toolbar">
          <div className="flex items-center gap-3" data-testid="cases-toolbar-top">
            {/* Folder toggle */}
            <button
              onClick={() => setFolderSidebarOpen(!folderSidebarOpen)}
              title="Toggle folders"
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              data-testid="cases-folder-toggle"
            >
              <FolderOpen className="h-4 w-4" />
            </button>

            {/* Title */}
            <div className="shrink-0" data-testid="cases-title-section">
              <span className="text-sm font-semibold" data-testid={TestIds.cases.title}>{selectedFolderName ?? "All Test Cases"}</span>
              <span className="text-xs text-muted-foreground ml-2" data-testid="cases-count-badge">
                {filtered.length !== cases.length
                  ? `${filtered.length} / ${cases.length}`
                  : cases.length}
              </span>
            </div>

            {/* Search */}
            <div className="relative flex-1 min-w-0" data-testid="cases-search-container">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search test cases…"
                className="pl-9 h-8"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                data-testid={TestIds.cases.filterSearch}
              />
            </div>

            {/* Actions */}
            <Button size="sm" variant="outline" onClick={exportCases} className="gap-1.5 shrink-0" data-testid="cases-action-export">
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowImport(true)} className="gap-1.5 shrink-0" data-testid="cases-action-import">
              <Upload className="h-3.5 w-3.5" />
              Import
            </Button>
            <Button
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => router.push(`/cases/new?projectId=${projectId}`)}
              data-testid="cases-action-new"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </Button>
          </div>

          {/* Status filter pills + archived toggle */}
          <div className="flex items-center gap-2 flex-wrap" data-testid="cases-filters-row">
            {ALL_TC_STATUSES.map(s => (
              <button
                key={s}
                onClick={() => toggleStatusFilter(s)}
                className={cn(
                  "px-3 py-0.5 rounded-full text-xs font-medium border transition-colors",
                  activeStatuses.has(s)
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground"
                )}
                data-testid={TestIds.cases.filterStatus(s.toLowerCase())}
              >
                {s}
              </button>
            ))}
            <div className="flex items-center gap-2 ml-auto" data-testid="cases-archive-controls">
              <span className="text-xs text-muted-foreground">Show Archived</span>
              <button
                role="switch"
                aria-checked={showArchived}
                onClick={() => { setShowArchived(p => !p); setCasesLoading(true); }}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none",
                  showArchived ? "bg-foreground" : "bg-muted"
                )}
                data-testid={TestIds.cases.filterArchived}
              >
                <span className={cn(
                  "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transform transition-transform",
                  showArchived ? "translate-x-4" : "translate-x-0"
                )} />
              </button>
              <button
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Refresh"
                onClick={() => { setCasesLoading(true); loadCases(); }}
                data-testid="cases-refresh-button"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Import result message */}
          {importMsg && (
            <div className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm border",
              importMsg.type === "success"
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-destructive/10 text-destructive border-destructive/20"
            )}>
              {importMsg.type === "success"
                ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                : <AlertCircle className="h-4 w-4 shrink-0" />}
              <span>{importMsg.text}</span>
              <button className="ml-auto opacity-60 hover:opacity-100" onClick={() => setImportMsg(null)}>✕</button>
            </div>
          )}
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="px-4 py-2 bg-primary/5 border-b border-primary/20 flex items-center gap-3 text-sm shrink-0" data-testid="cases-bulk-actions-bar">
            <span className="font-semibold text-primary" data-testid="cases-bulk-selected-count">{selectedIds.size} selected</span>
            <div className="h-4 w-px bg-primary/20" />
            <div className="flex items-center gap-2 flex-wrap" data-testid="cases-bulk-buttons">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={bulkClone} disabled={bulkWorking} data-testid={TestIds.cases.bulkClone}>
                {bulkWorking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                Clone
              </Button>
              <div className="relative z-40">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setShowStatusChange((p) => !p)} disabled={bulkWorking} data-testid={TestIds.cases.bulkStatusChange}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Change Status
                </Button>
                {showStatusChange && (
                  <div className="absolute top-full left-0 mt-1 z-50 w-44 bg-background border border-border rounded-lg shadow-lg py-1" data-testid="cases-bulk-status-menu">
                    {ALL_TC_STATUSES.map((s) => (
                      <button
                        key={s}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 flex items-center gap-2"
                        onClick={() => bulkChangeStatus(s)}
                        data-testid={`cases-bulk-status-option-${s.toLowerCase()}`}
                      >
                        <span className={cn("h-2 w-2 rounded-full shrink-0", {
                          "bg-slate-400": s === "DRAFT",
                          "bg-emerald-500": s === "READY",
                          "bg-red-500": s === "DEPRECATED",
                        })} />
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={bulkArchive} disabled={bulkWorking} data-testid={TestIds.cases.bulkArchive}>
                <Archive className="h-3.5 w-3.5" />
                Archive
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={bulkLinkToCycle} disabled={bulkWorking} data-testid={TestIds.cases.bulkLinkCycle}>
                <Link2 className="h-3.5 w-3.5" />
                Link to Cycle
              </Button>
              <div className="relative z-40">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => setShowMoveToFolder((p) => !p)}
                  disabled={bulkWorking}
                  data-testid={TestIds.cases.bulkMoveFolder}
                >
                  <FolderIcon className="h-3.5 w-3.5" />
                  Move to Folder
                </Button>
                {showMoveToFolder && (
                  <div className="absolute top-full left-0 mt-1 z-50 w-56 bg-background border border-border rounded-lg shadow-lg py-1 max-h-60 overflow-y-auto">
                    <button
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 flex items-center gap-2"
                      onClick={() => moveToFolder(Array.from(selectedIds), null)}
                    >
                      <FlaskConical className="h-3.5 w-3.5 text-brand-500" />
                      <span className="font-medium">All Test Cases (no folder)</span>
                    </button>
                    {flatFolders.length > 0 && <div className="border-t my-1" />}
                    {flatFolders.map((f) => (
                      <button
                        key={f.id}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 flex items-center gap-2"
                        style={{ paddingLeft: `${12 + f.depth * 12}px` }}
                        onClick={() => moveToFolder(Array.from(selectedIds), f.id)}
                      >
                        <FolderIcon className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <span className="truncate">{f.name}</span>
                      </button>
                    ))}
                    {flatFolders.length === 0 && (
                      <p className="px-3 py-2 text-xs text-muted-foreground">No folders created yet.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button className="ml-auto text-xs text-primary hover:underline" onClick={() => setSelectedIds(new Set())}>
              Clear selection
            </button>
          </div>
        )}

        {/* Test case list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48">
              <FlaskConical className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {query ? "No test cases match your search." : selectedFolderId ? "No test cases in this folder." : "No test cases yet."}
              </p>
              {!query && (
                <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={() => setShowImport(true)}>
                  <Upload className="h-4 w-4" /> Import Test Cases
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Pagination calculations */}
              {(() => {
                const totalPages = Math.ceil(filtered.length / itemsPerPage);
                const startIndex = (currentPage - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const paginatedItems = filtered.slice(startIndex, endIndex);
                const goToPage = (page: number) => setCurrentPage(Math.min(Math.max(1, page), totalPages));

                return (
                  <>
                    <table className="w-full text-sm" data-testid={TestIds.cases.table}>
              <thead className="bg-muted/30 sticky top-0 z-10 border-b border-border" data-testid={TestIds.cases.tableHeader}>
                <tr data-testid="cases-header-row">
                  <th className="px-2 py-2.5 w-14 bg-muted/50 border-b border-border" data-testid="cases-header-checkbox">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-border cursor-pointer"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected; }}
                      onChange={toggleSelectAll}
                      data-testid="cases-select-all-checkbox"
                    />
                  </th>
                  <th className="text-left px-2 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap bg-muted/50 border-b border-border" data-testid="cases-header-key">Key</th>
                  <th className="text-left px-2 py-2.5 text-xs font-semibold text-muted-foreground bg-muted/50 border-b border-border" data-testid="cases-header-summary">Summary</th>
                  <th className="text-left px-2 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap bg-muted/50 border-b border-border w-16" data-testid="cases-header-priority">Priority</th>
                  <th className="text-left px-2 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap bg-muted/50 border-b border-border" data-testid="cases-header-status">Status</th>
                  <th className="text-left px-2 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap bg-muted/50 border-b border-border w-20" data-testid="cases-header-actions">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border" data-testid={TestIds.cases.tableBody}>
                {paginatedItems.map((tc, idx) => {
                  const isEditing = editingId === tc.id;
                  return (
                    <React.Fragment key={tc.id}>
                      <tr key={tc.id + "-row"}
                      draggable
                      onDragStart={(e) => {
                        setDraggingId(tc.id);
                        e.dataTransfer.setData("tcId", tc.id);
                        e.dataTransfer.effectAllowed = "move";
                        if (selectedIds.has(tc.id) && selectedIds.size > 1) {
                          const badge = document.createElement("div");
                          badge.textContent = `Moving ${selectedIds.size} test cases`;
                          badge.style.cssText = "position:fixed;top:-100px;left:-100px;background:#2563eb;color:#fff;padding:4px 10px;border-radius:6px;font-size:12px;pointer-events:none;";
                          document.body.appendChild(badge);
                          e.dataTransfer.setDragImage(badge, 0, 0);
                          setTimeout(() => document.body.removeChild(badge), 0);
                        }
                      }}
                      onDragEnd={() => { setDraggingId(null); setDragOverFolderId(null); }}
                      onClick={() => {
                        if (!isEditing) setSelectedTcId(tc.id === selectedTcId ? null : tc.id);
                      }}
                      className={cn(
                        "hover:bg-muted/40 cursor-pointer transition-colors group",
                        selectedTcId === tc.id && "bg-primary/5",
                        draggingId === tc.id && "opacity-50"
                      )}
                      data-testid={TestIds.cases.tableRow(tc.id)}
                    >
                      <td className="px-2 py-3 flex items-center gap-1 w-14" data-testid={`cases-cell-expand-${tc.id}`}>
                        <button
                          className="flex items-center justify-center h-6 w-6 rounded hover:bg-muted/60 text-muted-foreground transition-colors flex-shrink-0"
                          title={expandedTcId === tc.id ? "Collapse steps" : "Expand steps"}
                          onClick={e => {
                            e.stopPropagation();
                            if (editingId === tc.id) setEditingId(null);
                            setExpandedTcId(prev => prev === tc.id ? null : tc.id);
                            setShowNewStepForm(null);
                            setEditingStepId(null);
                            setEditingStepData(null);
                          }}
                          data-testid={TestIds.cases.expandButton(tc.id)}
                        >
                          {expandedTcId === tc.id
                            ? <ChevronDown className="h-3.5 w-3.5" />
                            : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-border cursor-pointer flex-shrink-0"
                          checked={selectedIds.has(tc.id)}
                          onChange={(e) => toggleSelect(tc.id, idx, e.nativeEvent instanceof MouseEvent && (e.nativeEvent as MouseEvent).shiftKey)}
                          onClick={(e) => e.stopPropagation()}
                          data-testid={TestIds.cases.checkbox(tc.id)}
                        />
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap">
                        <Link
                          href={`/cases/${tc.id}?projectId=${projectId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {tc.key}
                        </Link>
                      </td>
                      <td className="px-2 py-3">
                        {isEditing ? (
                          <div className="flex items-center gap-2 min-w-0" onClick={(e) => e.stopPropagation()}>
                            <Input
                              className="h-7 text-sm flex-1 min-w-0"
                              value={editSummary}
                              onChange={(e) => setEditSummary(e.target.value)}
                              autoFocus
                            />
                            <Select value={editStatus} onValueChange={setEditStatus}>
                              <SelectTrigger className="h-7 w-28 text-xs shrink-0">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="DRAFT">Draft</SelectItem>
                                <SelectItem value="READY">Ready</SelectItem>
                                <SelectItem value="DEPRECATED">Deprecated</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 shrink-0" onClick={(e) => { e.stopPropagation(); saveEdit(tc.id); }}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground shrink-0" onClick={(e) => { e.stopPropagation(); setEditingId(null); }}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-sm text-foreground">{tc.summary}</span>
                        )}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap">
                        {!isEditing && tc.priority && (
                          <span
                            className="h-2 w-2 rounded-full inline-block"
                            style={{ background: tc.priority.color }}
                            title={tc.priority.name}
                          />
                        )}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap">
                        {!isEditing && (
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-xs border",
                            STATUS_COLORS[tc.status] ?? "bg-muted text-muted-foreground border-muted"
                          )}>
                            {tc.status}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap">
                        {!isEditing && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <RowActions
                              tc={tc}
                              projectId={projectId}
                              cloningId={cloningId}
                              flatFolders={flatFolders}
                              isAdmin={isAdmin}
                              onEdit={() => { setEditingId(tc.id); setEditSummary(tc.summary); setEditStatus(tc.status); setExpandedTcId(null); }}
                              onView={() => {}}
                              onLinkCycle={() => setLinkingTcId(tc.id)}
                              onClone={(e) => cloneCase(tc.id, e)}
                              onDelete={(e) => deleteCase(tc.id, e)}
                              onRestore={(e) => restoreCase(tc.id, e)}
                              onMove={(folderId) => moveToFolder([tc.id], folderId)}
                            />
                          </div>
                        )}
                      </td>
                    </tr>

                      {expandedTcId === tc.id && (
                        <tr key={tc.id + "-steps"}>
                          <td colSpan={5} className="p-0 border-b border-border">
                            <AccordionStepsPanel
                              tc={tc}
                              editingStepId={editingStepId}
                              editingStepData={editingStepData}
                              savingStepId={savingStepId}
                              showNewStepForm={showNewStepForm}
                              newStepDetails={newStepDetails}
                              newStepTestData={newStepTestData}
                              newStepExpectedResult={newStepExpectedResult}
                              onStartEditStep={(stepId, step) => {
                                setEditingStepId(stepId);
                                setEditingStepData({
                                  stepDetails: step.stepDetails,
                                  testData: step.testData ?? "",
                                  expectedResult: step.expectedResult ?? "",
                                });
                              }}
                              onCancelEditStep={() => { setEditingStepId(null); setEditingStepData(null); }}
                              onChangeStepField={(field, value) =>
                                setEditingStepData(prev => prev ? { ...prev, [field]: value } : null)
                              }
                              onSaveStep={saveAccordionStep}
                              onDeleteStep={deleteAccordionStep}
                              onShowNewStepForm={setShowNewStepForm}
                              onCancelNewStep={() => {
                                setShowNewStepForm(null);
                                setNewStepDetails("");
                                setNewStepTestData("");
                                setNewStepExpectedResult("");
                              }}
                              onChangeNewStepField={(field, value) => {
                                if (field === "newStepDetails") setNewStepDetails(value);
                                else if (field === "newStepTestData") setNewStepTestData(value);
                                else setNewStepExpectedResult(value);
                              }}
                              onSaveNewStep={saveNewAccordionStep}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

                    {/* Pagination controls */}
                    <div className="px-4 py-4 border-t border-border flex items-center justify-between" data-testid={TestIds.cases.pagination.root}>
                      <div className="text-xs text-muted-foreground" data-testid={TestIds.cases.pagination.info}>
                        Showing {startIndex + 1}–{Math.min(endIndex, filtered.length)} of {filtered.length} test cases
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Items per page selector */}
                        <div className="flex items-center gap-2 relative z-40">
                          <label className="text-xs text-muted-foreground">Per page:</label>
                          <select
                            value={itemsPerPage}
                            onChange={(e) => {
                              setItemsPerPage(Number(e.target.value));
                              setCurrentPage(1);
                            }}
                            className="text-xs border border-border rounded px-2 py-1 bg-background cursor-pointer relative z-40"
                            data-testid={TestIds.cases.pagination.itemsSelect}
                          >
                            <option value="10">10</option>
                            <option value="20">20</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                          </select>
                        </div>

                        {/* Pagination buttons */}
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
                            data-testid={TestIds.cases.pagination.prevButton}
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
                              data-testid={TestIds.cases.pagination.pageCounter}
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
                            data-testid={TestIds.cases.pagination.nextButton}
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
      </div>

      {/* ======================================================================
          SLIDE-IN DETAIL PANEL
      ====================================================================== */}
      {selectedTcId && <PanelResizeHandle onMouseDown={onDetailPanelResize} />}
      {selectedTcId && (
        <div style={{ width: detailPanelWidth }} className="shrink-0 overflow-y-auto bg-card flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card z-10 shrink-0">
            <span className="text-sm font-semibold">Test Case</span>
            <div className="flex items-center gap-2">
              <Link
                href={`/cases/${selectedTcId}?projectId=${projectId}`}
                className="text-xs text-primary hover:underline"
              >
                Open full view →
              </Link>
              <button onClick={() => setSelectedTcId(null)}>
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          </div>
          <TcDetailPanel tcId={selectedTcId} projectId={projectId} />
        </div>
      )}

      {/* Modals */}
      <ImportWizardModal
        open={showImport}
        onClose={() => setShowImport(false)}
        projectId={projectId}
        folders={folders}
        onImported={(count) => {
          setImportMsg({ type: "success", text: `Successfully imported ${count} test case${count !== 1 ? "s" : ""}.` });
          loadCases();
          setTimeout(() => setImportMsg(null), 5000);
        }}
      />

      {linkingTcId && (
        <LinkToCycleModal
          open={!!linkingTcId}
          testCaseIds={
            linkingTcId === "__bulk__"
              ? Array.from(selectedIds)
              : [linkingTcId]
          }
          projectId={projectId}
          onClose={() => {
            setLinkingTcId(null);
            if (linkingTcId === "__bulk__") setSelectedIds(new Set());
          }}
        />
      )}
    </div>
  );
}
