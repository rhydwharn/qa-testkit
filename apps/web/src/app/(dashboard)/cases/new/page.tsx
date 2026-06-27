"use client";

import { useState, useEffect } from "react";
import { TestIds } from "@/lib/test-ids";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Loader2, GripVertical } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  stepDetails: string;
  expectedResult: string;
  testData: string;
}

interface Priority { id: string; name: string; color: string; }
interface ProjectLabel { id: string; name: string; color: string; }
interface Folder { id: string; name: string; parentId: string | null; }

type ActiveTab = "detail" | "steps" | "attachments";

export default function NewTestCasePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [activeTab, setActiveTab] = useState<ActiveTab>("detail");

  // Detail fields
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [precondition, setPrecondition] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "READY" | "DEPRECATED">("DRAFT");
  const [priorityId, setPriorityId] = useState("");
  const [folderId, setFolderId] = useState("");
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [jiraKeys, setJiraKeys] = useState<string[]>([]);
  const [jiraKeyInput, setJiraKeyInput] = useState("");

  // Steps
  const [steps, setSteps] = useState<Step[]>([]);

  // Remote data
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [labels, setLabels] = useState<ProjectLabel[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId) return;
    Promise.all([
      fetch(`/api/projects/${projectId}/settings/priorities`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/settings/labels`).then((r) => r.json()),
      fetch(`/api/folders?projectId=${projectId}&type=CASE`).then((r) => r.json()),
    ]).then(([prios, lbls, flds]) => {
      setPriorities(Array.isArray(prios) ? prios : []);
      setLabels(Array.isArray(lbls) ? lbls : []);
      setFolders(Array.isArray(flds) ? flds : []);
    }).catch(() => {});
  }, [projectId]);

  function addStep() {
    setSteps((prev) => [
      ...prev,
      { id: String(Date.now()), stepDetails: "", expectedResult: "", testData: "" },
    ]);
  }

  function removeStep(id: string) {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  }

  function updateStep(id: string, field: keyof Step, value: string) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }

  async function handleCreate() {
    if (!projectId) { setError("No project selected"); return; }
    if (!summary.trim()) { setError("Summary is required"); return; }
    setSaving(true);
    setError("");

    const res = await fetch("/api/testcases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        summary,
        description,
        status,
        priorityId: priorityId || undefined,
        folderId: folderId || undefined,
        labelIds: selectedLabelIds.length > 0 ? selectedLabelIds : undefined,
        jiraRequirementKeys: jiraKeys,
        steps: steps
          .filter((s) => s.stepDetails.trim())
          .map(({ stepDetails, expectedResult, testData }) => ({ stepDetails, expectedResult, testData })),
      }),
    });

    setSaving(false);
    if (res.ok) {
      router.push(`/cases?projectId=${projectId}`);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to create test case");
    }
  }

  const TABS: { id: ActiveTab; label: string }[] = [
    { id: "detail", label: "Detail" },
    { id: "steps", label: "Steps" },
    { id: "attachments", label: "Attachments" },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/cases?projectId=${projectId}`} className="hover:text-foreground transition-colors">
            Test Cases
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">Create New Test Case</span>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-xs text-destructive">{error}</span>
          )}
          <Link href={`/cases?projectId=${projectId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back
            </Button>
          </Link>
          <Button size="sm" onClick={handleCreate} disabled={saving || !summary.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Create
          </Button>
        </div>
      </div>

      {/* Summary field (always visible, above tabs) */}
      <div className="px-6 mb-4">
        <Input
          placeholder="Summary *"
          className="text-base font-medium h-11 border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-brand-500"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b px-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              activeTab === tab.id
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content — scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
      {activeTab === "detail" && (
        <div className="space-y-6 max-w-3xl">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Description</Label>
            <Textarea
              placeholder="Enter Description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Precondition</Label>
            <Textarea
              placeholder="Enter Precondition"
              rows={2}
              value={precondition}
              onChange={(e) => setPrecondition(e.target.value)}
            />
          </div>

          {/* Detail grid */}
          <div>
            <div className="flex items-center gap-2 mb-4 cursor-pointer select-none">
              <span className="font-medium text-sm">Detail</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Folder Path</Label>
                <Select value={folderId} onValueChange={setFolderId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {folders.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Priority</Label>
                <Select value={priorityId} onValueChange={setPriorityId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select" />
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
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select
          data-testid="form-select-status"
          value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="READY">Ready</SelectItem>
                    <SelectItem value="DEPRECATED">Deprecated</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {labels.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Labels</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {labels.map((lbl) => {
                      const selected = selectedLabelIds.includes(lbl.id);
                      return (
                        <button
                          key={lbl.id}
                          type="button"
                          onClick={() =>
                            setSelectedLabelIds((prev) =>
                              selected ? prev.filter((id) => id !== lbl.id) : [...prev, lbl.id]
                            )
                          }
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition-colors",
                            selected ? "border-transparent text-white" : "border-border text-muted-foreground hover:border-foreground/40"
                          )}
                          style={selected ? { backgroundColor: lbl.color } : {}}
                        >
                          {!selected && <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: lbl.color }} />}
                          {lbl.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* JIRA Requirement Keys */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">JIRA Requirement Keys</Label>
            <div className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-[40px] focus-within:ring-1 focus-within:ring-ring">
              {jiraKeys.map((key) => (
                <span key={key} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-0.5 text-xs font-mono">
                  {key}
                  <button type="button" onClick={() => setJiraKeys((prev) => prev.filter((k) => k !== key))} className="hover:text-blue-900">✕</button>
                </span>
              ))}
              <input
                type="text"
                placeholder={jiraKeys.length === 0 ? "e.g. PROJ-123 (press Enter)" : "Add more..."}
                className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
                value={jiraKeyInput}
                onChange={(e) => setJiraKeyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    const val = jiraKeyInput.trim().toUpperCase();
                    if (val && !jiraKeys.includes(val)) setJiraKeys((prev) => [...prev, val]);
                    setJiraKeyInput("");
                  }
                  if (e.key === "Backspace" && !jiraKeyInput && jiraKeys.length > 0) {
                    setJiraKeys((prev) => prev.slice(0, -1));
                  }
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">Press Enter or comma to add a key</p>
          </div>
        </div>
      )}

      {activeTab === "steps" && (
        <div className="max-w-4xl space-y-4">
          {/* Steps Detail table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Steps Detail</h3>
              <Button type="button" variant="outline" size="sm" onClick={addStep}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Step
              </Button>
            </div>

            {steps.length === 0 ? (
              <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground space-y-3 bg-muted/20">
                <p className="font-medium">No Steps Available</p>
                <Button variant="outline" size="sm" onClick={addStep}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add First Step
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-8">#</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Step Summary</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-48">Test Data</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-48">Expected Result</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {steps.map((step, idx) => (
                      <tr key={step.id} className="group">
                        <td className="px-3 py-2 text-xs text-muted-foreground font-mono align-top pt-3">
                          <div className="flex items-center gap-1">
                            <GripVertical className="h-3 w-3 opacity-0 group-hover:opacity-50" />
                            {idx + 1}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Textarea
                            placeholder="Enter Step Details"
                            rows={2}
                            className="min-h-0 resize-none text-sm"
                            value={step.stepDetails}
                            onChange={(e) => updateStep(step.id, "stepDetails", e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Textarea
                            placeholder="Enter Test Data"
                            rows={2}
                            className="min-h-0 resize-none text-sm"
                            value={step.testData}
                            onChange={(e) => updateStep(step.id, "testData", e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Textarea
                            placeholder="Enter Expected Result"
                            rows={2}
                            className="min-h-0 resize-none text-sm"
                            value={step.expectedResult}
                            onChange={(e) => updateStep(step.id, "expectedResult", e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <button
                            type="button"
                            onClick={() => removeStep(step.id)}
                            className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity mt-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "attachments" && (
        <div className="max-w-3xl">
          <div className="border-2 border-dashed rounded-lg p-12 text-center text-sm text-muted-foreground">
            <p className="font-medium mb-1">No attachments yet</p>
            <p>Attachments can be added after creating the test case.</p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
