"use client";

import { useState, useEffect, useRef } from "react";
import { TestIds } from "@/lib/test-ids";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Pencil, Save, Trash2, Loader2, CheckCircle2, AlertCircle,
  Plus, X, GripVertical, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CommentThread } from "@/components/CommentThread";
import { ArchiveButton } from "@/components/ArchiveButton";
import { VersionSelector } from "@/components/VersionSelector";
import { useResizableColumns } from "@/hooks/use-resize";
import { ColResizeHandle } from "@/components/ui/resize-handle";

interface Step {
  id: string;
  order: number;
  stepDetails: string;
  expectedResult?: string | null;
  testData?: string | null;
}

interface TestCase {
  id: string;
  key: string;
  summary: string;
  description?: string;
  status: "DRAFT" | "READY" | "DEPRECATED";
  priority?: { id: string; name: string; color: string } | null;
  folder?: { name: string } | null;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  isArchived?: boolean;
  jiraRequirementKeys: string[];
  versions: Array<{
    id: string;
    versionNo: number;
    isLatest: boolean;
    steps: Step[];
  }>;
}

interface Priority { id: string; name: string; color: string; }

const STATUS_BADGE: Record<string, "default" | "secondary" | "draft"> = {
  READY: "default", DRAFT: "draft", DEPRECATED: "secondary",
};

type ActiveTab = "detail" | "steps" | "attachments" | "comments" | "history" | "cycles";

// Editable step row — used in both add and edit mode
function StepRow({
  step,
  index,
  onSave,
  onDelete,
  onCancel,
  autoFocus,
}: {
  step: Partial<Step>;
  index: number;
  onSave: (data: { stepDetails: string; testData: string; expectedResult: string }) => void;
  onDelete?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [stepDetails, setStepDetails] = useState(step.stepDetails ?? "");
  const [testData, setTestData] = useState(step.testData ?? "");
  const [expectedResult, setExpectedResult] = useState(step.expectedResult ?? "");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <tr className="bg-brand-50/40 border-b">
      <td className="px-4 py-2 text-center text-muted-foreground font-mono text-xs">{index + 1}</td>
      <td className="px-3 py-2">
        <Textarea
          ref={inputRef}
          value={stepDetails}
          onChange={(e) => setStepDetails(e.target.value)}
          placeholder="Step action…"
          className="min-h-[60px] text-sm resize-none"
          rows={2}
        />
      </td>
      <td className="px-3 py-2">
        <Textarea
          value={testData}
          onChange={(e) => setTestData(e.target.value)}
          placeholder="Input data…"
          className="min-h-[60px] text-sm resize-none"
          rows={2}
        />
      </td>
      <td className="px-3 py-2">
        <Textarea
          value={expectedResult}
          onChange={(e) => setExpectedResult(e.target.value)}
          placeholder="Expected outcome…"
          className="min-h-[60px] text-sm resize-none"
          rows={2}
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-1">
          <Button
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => onSave({ stepDetails, testData, expectedResult })}
            disabled={!stepDetails.trim()}
          >
            <Save className="h-3 w-3 mr-1" /> Save
          </Button>
          {onDelete && (
            <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-destructive" onClick={onDelete}>
              <Trash2 className="h-3 w-3 mr-1" /> Delete
            </Button>
          )}
          {onCancel && (
            <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function TestCaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Prefer the URL param; fall back to the loaded test case's projectId so
  // breadcrumbs work even when the link that brought us here omitted projectId.
  const projectIdParam = searchParams.get("projectId") ?? "";
  const [projectId, setProjectId] = useState(projectIdParam);

  const [tc, setTc] = useState<TestCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("detail");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [priorities, setPriorities] = useState<Priority[]>([]);

  // Editable fields
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "READY" | "DEPRECATED">("DRAFT");
  const [priorityId, setPriorityId] = useState("");
  const [jiraKeys, setJiraKeys] = useState<string[]>([]);
  const [jiraKeyInput, setJiraKeyInput] = useState("");

  // Step editing state
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [addingStep, setAddingStep] = useState(false);
  const [savingStep, setSavingStep] = useState(false);

  const { colWidths: stepColWidths, startColResize: startStepColResize } = useResizableColumns(
    { step: 240, testData: 180, expected: 220, actions: 80 },
    { storageKey: "steps-table-cols", min: 80 }
  );

  // Step drag-to-reorder state
  const [dragStepId, setDragStepId] = useState<string | null>(null);
  const [dragOverStepId, setDragOverStepId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/testcases/${id}`)
      .then((r) => r.json())
      .then((data: TestCase) => {
        setTc(data);
        setSummary(data.summary);
        setDescription(data.description ?? "");
        setStatus(data.status);
        setPriorityId(data.priority?.id ?? "");
        setJiraKeys(data.jiraRequirementKeys ?? []);
        setLoading(false);
        // Resolve projectId from the record if it wasn't in the URL
        if (!projectIdParam && data.projectId) setProjectId(data.projectId);
        if (data.projectId) {
          fetch(`/api/projects/${data.projectId}/settings/priorities`)
            .then((r) => r.json())
            .then((prios) => setPriorities(Array.isArray(prios) ? prios : []))
            .catch(() => {});
        }
      })
      .catch(() => setLoading(false));
  }, [id]);

  async function saveEdits() {
    setSaving(true);
    const res = await fetch(`/api/testcases/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary, description, status, priorityId: priorityId || undefined, jiraRequirementKeys: jiraKeys }),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      setTc((prev) => prev ? { ...prev, ...updated } : prev);
      setEditing(false);
      showMsg("success", "Saved successfully.");
    } else {
      showMsg("error", "Failed to save.");
    }
  }

  function showMsg(type: "success" | "error", text: string) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  }

  function cancelEdit() {
    setEditing(false);
    if (!tc) return;
    setSummary(tc.summary);
    setDescription(tc.description ?? "");
    setStatus(tc.status);
    setPriorityId(tc.priority?.id ?? "");
    setJiraKeys(tc.jiraRequirementKeys ?? []);
    setJiraKeyInput("");
  }

  async function deleteCase() {
    if (!confirm("Delete this test case? This cannot be undone.")) return;
    await fetch(`/api/testcases/${id}`, { method: "DELETE" });
    router.back();
  }

  // ── Step CRUD ────────────────────────────────────────────────────────────────

  const latestVersion = tc?.versions.find((v) => v.isLatest) ?? tc?.versions[0];

  async function handleStepDrop(targetStepId: string) {
    if (!dragStepId || dragStepId === targetStepId || !latestVersion) return;
    const current = [...latestVersion.steps];
    const fromIdx = current.findIndex(s => s.id === dragStepId);
    const toIdx = current.findIndex(s => s.id === targetStepId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...current];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const withOrder = reordered.map((s, i) => ({ ...s, order: i + 1 }));
    setDragStepId(null);
    setDragOverStepId(null);
    await saveAllSteps(withOrder);
  }

  async function saveAllSteps(steps: Step[]) {
    if (!latestVersion) return;
    setSavingStep(true);
    await fetch(`/api/testcases/${id}/steps`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId: latestVersion.id, steps }),
    });
    setSavingStep(false);
    // Refresh
    const fresh = await fetch(`/api/testcases/${id}`).then((r) => r.json());
    setTc(fresh);
  }

  async function handleSaveStep(data: { stepDetails: string; testData: string; expectedResult: string }, stepId?: string) {
    if (!latestVersion) return;
    const current = latestVersion.steps;

    let updated: Step[];
    if (stepId) {
      // Edit existing
      updated = current.map((s) =>
        s.id === stepId
          ? { ...s, stepDetails: data.stepDetails, testData: data.testData, expectedResult: data.expectedResult }
          : s
      );
    } else {
      // Add new — order is 1-based
      const newStep: Step = {
        id: `__new__${Date.now()}`,
        order: current.length + 1,
        stepDetails: data.stepDetails,
        testData: data.testData,
        expectedResult: data.expectedResult,
      };
      updated = [...current, newStep];
    }

    // Re-assign order 1-based
    const reordered = updated.map((s, i) => ({ ...s, order: i + 1 }));
    await saveAllSteps(reordered);
    setEditingStepId(null);
    setAddingStep(false);
    showMsg("success", stepId ? "Step updated." : "Step added.");
  }

  async function handleDeleteStep(stepId: string) {
    if (!latestVersion) return;
    const updated = latestVersion.steps
      .filter((s) => s.id !== stepId)
      .map((s, i) => ({ ...s, order: i + 1 }));
    await saveAllSteps(updated);
    showMsg("success", "Step deleted.");
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tc) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Test case not found.</p>
        <Button variant="link" onClick={() => router.back()}>Go back</Button>
      </div>
    );
  }

  const steps = latestVersion?.steps ?? [];

  const TABS: { id: ActiveTab; label: string }[] = [
    { id: "detail", label: "Detail" },
    { id: "steps", label: `Steps (${steps.length})` },
    { id: "attachments", label: "Attachments" },
    { id: "comments", label: "Comments" },
    { id: "history", label: "Execution History" },
    { id: "cycles", label: "Linked Cycles" },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0 p-6 overflow-y-auto" data-testid="cases-detail-page">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5 gap-4" data-testid="cases-detail-header">
        <div className="min-w-0 flex-1">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <Link href={`/cases?projectId=${projectId}`} className="hover:text-foreground transition-colors">
              Test Cases
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-mono text-foreground">{tc.key}</span>
          </div>

          {/* Summary */}
          {editing ? (
            <Input
              className="text-lg font-semibold h-11 border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-brand-500"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold leading-tight">{tc.summary}</h1>
              <Badge variant={STATUS_BADGE[tc.status] ?? "draft"}>{tc.status}</Badge>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {msg && (
            <span className={cn("text-xs flex items-center gap-1 whitespace-nowrap", msg.type === "success" ? "text-green-600" : "text-destructive")}>
              {msg.type === "success" ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
              {msg.text}
            </span>
          )}
          {editing ? (
            <>
              <Button size="sm" onClick={saveEdits} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelEdit}>Cancel</Button>
            </>
          ) : (
            <>
              <ArchiveButton entityType="TEST_CASE" entityId={id} isArchived={tc.isArchived ?? false} />
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4 mr-1.5" /> Edit
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={deleteCase}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="flex border-b mb-6 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ActiveTab)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Detail tab ──────────────────────────────────────────────────────── */}
      {activeTab === "detail" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {editing ? (
              <>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what this test case verifies…"
                    className="resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>JIRA Requirement Keys</Label>
                  <div className="flex flex-wrap gap-1.5 p-2.5 border rounded-md min-h-[42px] focus-within:ring-1 focus-within:ring-ring">
                    {jiraKeys.map((key) => (
                      <span key={key} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-0.5 text-xs font-mono">
                        {key}
                        <button type="button" onClick={() => setJiraKeys((p) => p.filter((k) => k !== key))}>
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      placeholder={jiraKeys.length === 0 ? "e.g. PROJ-123" : "Add more…"}
                      className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
                      value={jiraKeyInput}
                      onChange={(e) => setJiraKeyInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          const val = jiraKeyInput.trim().toUpperCase();
                          if (val && !jiraKeys.includes(val)) setJiraKeys((p) => [...p, val]);
                          setJiraKeyInput("");
                        }
                        if (e.key === "Backspace" && !jiraKeyInput && jiraKeys.length > 0)
                          setJiraKeys((p) => p.slice(0, -1));
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Press Enter or comma to add a key</p>
                </div>
              </>
            ) : (
              <>
                {tc.description ? (
                  <div>
                    <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wide mb-2">Description</p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{tc.description}</p>
                  </div>
                ) : (
                  <div className="border-2 border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground">
                    <p>No description added.</p>
                    <button onClick={() => setEditing(true)} className="text-brand-500 hover:underline mt-1 text-xs">Add description</button>
                  </div>
                )}

                {tc.jiraRequirementKeys && tc.jiraRequirementKeys.length > 0 && (
                  <div>
                    <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wide mb-2">JIRA Requirements</p>
                    <div className="flex flex-wrap gap-1.5">
                      {tc.jiraRequirementKeys.map((key) => (
                        <span key={key} className="inline-flex items-center bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-0.5 text-xs font-mono">
                          {key}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Metadata sidebar */}
          <div className="space-y-5">
            {/* Version Selector */}
            {tc.versions && tc.versions.length > 0 && (
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground mb-2.5">Version</p>
                <VersionSelector
                  testCaseId={id}
                  currentVersionNo={latestVersion?.versionNo ?? 1}
                  onVersionChange={(versionNo) => {
                    const version = tc.versions.find(v => v.versionNo === versionNo);
                    if (version) {
                      // Could refresh data or navigate to show different version
                      console.log("Version changed to:", versionNo);
                    }
                  }}
                />
              </div>
            )}

            <div className="rounded-lg border p-4 space-y-4 text-sm">
              {/* Status */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Status</p>
                {editing ? (
                  <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="READY">Ready</SelectItem>
                      <SelectItem value="DEPRECATED">Deprecated</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant={STATUS_BADGE[tc.status] ?? "draft"}>{tc.status}</Badge>
                )}
              </div>

              {/* Priority */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Priority</p>
                {editing ? (
                  <Select value={priorityId} onValueChange={setPriorityId}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      {priorities.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                            {p.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : tc.priority ? (
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: tc.priority.color }} />
                    <span>{tc.priority.name}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>

              {/* Folder */}
              {tc.folder && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Folder</p>
                  <p>{tc.folder.name}</p>
                </div>
              )}

              <div className="pt-1 border-t space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="mt-0.5">{new Date(tc.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last updated</p>
                  <p className="mt-0.5">{new Date(tc.updatedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Steps tab ───────────────────────────────────────────────────────── */}
      {activeTab === "steps" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {steps.length === 0 ? "No steps yet." : `${steps.length} step${steps.length === 1 ? "" : "s"}`}
            </p>
            {!addingStep && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setAddingStep(true); setEditingStepId(null); }}
                disabled={savingStep}
              >
                <Plus className="h-4 w-4 mr-1.5" /> Add Step
              </Button>
            )}
          </div>

          {steps.length === 0 && !addingStep ? (
            <div className="border-2 border-dashed rounded-xl p-12 text-center text-sm text-muted-foreground space-y-3">
              <p className="font-medium text-base">No steps defined</p>
              <p className="text-xs max-w-sm mx-auto">Add steps to describe how this test case should be executed, what data to use, and what result to expect.</p>
              <Button size="sm" onClick={() => setAddingStep(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> Add First Step
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: 40 }} />
                  <col style={{ width: stepColWidths.step }} />
                  <col style={{ width: stepColWidths.testData }} />
                  <col style={{ width: stepColWidths.expected }} />
                  <col style={{ width: stepColWidths.actions }} />
                </colgroup>
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground relative overflow-visible">
                      Step Summary
                      <ColResizeHandle onMouseDown={(e) => startStepColResize(e, "step")} />
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground relative overflow-visible">
                      Test Data
                      <ColResizeHandle onMouseDown={(e) => startStepColResize(e, "testData")} />
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground relative overflow-visible">
                      Expected Result
                      <ColResizeHandle onMouseDown={(e) => startStepColResize(e, "expected")} />
                    </th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {steps.map((step, idx) =>
                    editingStepId === step.id ? (
                      <StepRow
                        key={step.id}
                        step={step}
                        index={idx}
                        autoFocus
                        onSave={(data) => handleSaveStep(data, step.id)}
                        onDelete={() => handleDeleteStep(step.id)}
                        onCancel={() => setEditingStepId(null)}
                      />
                    ) : (
                      <tr
                        key={step.id}
                        draggable
                        onDragStart={() => setDragStepId(step.id)}
                        onDragEnd={() => { setDragStepId(null); setDragOverStepId(null); }}
                        onDragOver={e => { e.preventDefault(); setDragOverStepId(step.id); }}
                        onDragLeave={() => setDragOverStepId(null)}
                        onDrop={e => { e.preventDefault(); handleStepDrop(step.id); }}
                        className={cn(
                          "border-b last:border-0 group hover:bg-muted/20 transition-colors align-top cursor-grab",
                          savingStep && "opacity-50 pointer-events-none",
                          dragOverStepId === step.id && dragStepId !== step.id && "border-t-2 border-t-primary bg-primary/5",
                          dragStepId === step.id && "opacity-40"
                        )}
                      >
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground cursor-grab" />
                            <span className="font-mono text-xs font-semibold text-muted-foreground">{idx + 1}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm leading-relaxed">{step.stepDetails}</p>
                        </td>
                        <td className="px-4 py-4">
                          {step.testData ? (
                            <span className="inline-block font-mono text-xs bg-muted px-2 py-1 rounded text-foreground/80 break-all">
                              {step.testData}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm text-muted-foreground leading-relaxed">{step.expectedResult || "—"}</p>
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Edit step"
                              onClick={() => { setEditingStepId(step.id); setAddingStep(false); }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Delete step"
                              onClick={() => handleDeleteStep(step.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}

                  {/* Add new step row */}
                  {addingStep && (
                    <StepRow
                      step={{}}
                      index={steps.length}
                      autoFocus
                      onSave={(data) => handleSaveStep(data)}
                      onCancel={() => setAddingStep(false)}
                    />
                  )}
                </tbody>
              </table>
            </div>
          )}

          {savingStep && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Saving…
            </div>
          )}
        </div>
      )}

      {/* ── Attachments tab ─────────────────────────────────────────────────── */}
      {activeTab === "attachments" && (
        <AttachmentsTab testCaseId={id} />
      )}

      {/* ── Comments tab ────────────────────────────────────────────────────── */}
      {activeTab === "comments" && (
        <div className="p-1">
          <CommentThread entityType="TEST_CASE" entityId={id} />
        </div>
      )}

      {/* ── Execution History tab ───────────────────────────────────────────── */}
      {activeTab === "history" && <ExecutionHistoryTab testCaseId={id} projectId={projectId} />}

      {/* ── Linked Cycles tab ───────────────────────────────────────────────── */}
      {activeTab === "cycles" && <LinkedCyclesTab testCaseId={id} projectId={projectId} />}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function AttachmentsTab({ testCaseId }: { testCaseId: string }) {
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/attachments?entityType=TEST_CASE&entityId=${testCaseId}`)
      .then(r => r.json())
      .then(d => setAttachments(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [testCaseId]);

  async function upload(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("entityType", "TEST_CASE");
    form.append("entityId", testCaseId);
    const res = await fetch("/api/attachments", { method: "POST", body: form });
    if (res.ok) {
      const att = await res.json();
      setAttachments(prev => [...prev, att]);
    }
    setUploading(false);
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div
        className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
      >
        <input ref={fileInputRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
        {uploading ? <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /> : (
          <>
            <Plus className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Drop file or click to upload</p>
            <p className="text-xs text-muted-foreground mt-1">PNG, JPG, PDF up to 20MB</p>
          </>
        )}
      </div>
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((att: any) => (
            <div key={att.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/20">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{att.fileName}</p>
                <p className="text-xs text-muted-foreground">{(att.fileSize / 1024).toFixed(1)} KB</p>
              </div>
              <a href={`/api/attachments/${att.id}`} target="_blank" rel="noreferrer"
                className="text-xs text-primary hover:underline">View</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExecutionHistoryTab({ testCaseId, projectId }: { testCaseId: string; projectId: string }) {
  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/testcases/${testCaseId}/executions?projectId=${projectId}`)
      .then(r => r.json())
      .then(d => { setExecutions(d.executions ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [testCaseId, projectId]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!executions.length) return (
    <div className="p-8 text-center text-sm text-muted-foreground">No executions yet.</div>
  );
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Cycle</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Executed By</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {executions.map((ex: any) => (
            <tr key={ex.id} className="hover:bg-muted/20">
              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{ex.testCycle?.key ?? "—"}</td>
              <td className="px-4 py-2.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  ex.status === "PASS" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                  ex.status === "FAIL" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                  "bg-muted text-muted-foreground"
                }`}>{ex.status}</span>
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">{ex.assignee?.name ?? "—"}</td>
              <td className="px-4 py-2.5 text-muted-foreground text-xs">
                {ex.executedAt ? new Date(ex.executedAt).toLocaleDateString() : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LinkedCyclesTab({ testCaseId, projectId }: { testCaseId: string; projectId: string }) {
  const [cycles, setCycles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/testcases/${testCaseId}/cycles?projectId=${projectId}`)
      .then(r => r.json())
      .then(d => { setCycles(d.cycles ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [testCaseId, projectId]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!cycles.length) return (
    <div className="p-8 text-center text-sm text-muted-foreground">Not linked to any cycles yet.</div>
  );
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Key</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Cycle</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Progress</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {cycles.map((c: any) => (
            <tr key={c.id} className="hover:bg-muted/20">
              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{c.key}</td>
              <td className="px-4 py-2.5 font-medium">{c.summary}</td>
              <td className="px-4 py-2.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">{c.status}</span>
              </td>
              <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                {c.pass ?? 0}P / {c.fail ?? 0}F / {c.total ?? 0}T
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
