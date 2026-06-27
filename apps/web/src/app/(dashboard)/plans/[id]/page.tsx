"use client";

import { useState, useEffect, useRef } from "react";
import { TestIds } from "@/lib/test-ids";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Pencil,
  Save,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Link2,
  Unlink,
} from "lucide-react";
import { CommentThread } from "@/components/CommentThread";
import { ArchiveButton } from "@/components/ArchiveButton";

interface CycleLink {
  testCycleId: string;
  testCycle: {
    id: string;
    key: string;
    summary: string;
    status: string;
    _count: { executions: number };
    environment?: { name: string } | null;
    build?: { name: string } | null;
  };
}

interface Plan {
  id: string;
  key: string;
  summary: string;
  description?: string;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  priority?: { name: string; color: string } | null;
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
  cycles: CycleLink[];
  executionStatsByCycle: Record<string, Record<string, number>>;
}

interface AvailableCycle {
  id: string;
  key: string;
  summary: string;
  status: string;
}

const STATUS_BADGE: Record<string, "default" | "secondary" | "draft"> = {
  ACTIVE: "default",
  DRAFT: "draft",
  COMPLETED: "secondary",
  ARCHIVED: "secondary",
};

function computePassRate(stats: Record<string, number>): { pass: number; total: number; rate: number } {
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  const pass = stats["PASS"] ?? stats["PASSED"] ?? 0;
  const rate = total > 0 ? Math.round((pass / total) * 100) : 0;
  return { pass, total, rate };
}

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<"details" | "comments">("details");

  // Editable fields
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Plan["status"]>("DRAFT");

  // Link cycle dialog
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [availableCycles, setAvailableCycles] = useState<AvailableCycle[]>([]);
  const [cycleSearchResults, setCycleSearchResults] = useState<AvailableCycle[]>([]);
  const [linkingCycleId, setLinkingCycleId] = useState("");
  const [cycleSearchQuery, setCycleSearchQuery] = useState("");
  const [cycleSearchLoading, setCycleSearchLoading] = useState(false);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    fetch(`/api/testplans/${id}`)
      .then((r) => r.json())
      .then((data: Plan) => {
        setPlan(data);
        setSummary(data.summary);
        setDescription(data.description ?? "");
        setStatus(data.status);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  // Debounced search for test cycles
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  useEffect(() => {
    if (!projectId || !showLinkDialog) {
      setCycleSearchResults([]);
      return;
    }

    if (!cycleSearchQuery.trim()) {
      setCycleSearchResults([]);
      setCycleSearchLoading(false);
      return;
    }

    setCycleSearchLoading(true);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search - wait 300ms after user stops typing
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const searchParams = new URLSearchParams({
          projectId,
          q: cycleSearchQuery,
        });
        const res = await fetch(`/api/testcycles/search?${searchParams}`);
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();

        // Filter out already linked cycles
        const linkedIds = plan?.cycles.map(c => c.testCycleId) ?? [];
        const filtered = (Array.isArray(data) ? data : []).filter(
          (cycle: AvailableCycle) => !linkedIds.includes(cycle.id)
        );

        setCycleSearchResults(filtered);
      } catch (error) {
        console.error("Failed to search cycles:", error);
        setCycleSearchResults([]);
      } finally {
        setCycleSearchLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [cycleSearchQuery, projectId, showLinkDialog, plan?.cycles]);

  function cancelEdit() {
    if (!plan) return;
    setEditing(false);
    setSummary(plan.summary);
    setDescription(plan.description ?? "");
    setStatus(plan.status);
  }

  async function saveEdits() {
    setSaving(true);
    const res = await fetch(`/api/testplans/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary, description, status }),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      setPlan((prev) => prev ? { ...prev, ...updated } : prev);
      setEditing(false);
      setMsg({ type: "success", text: "Test plan updated." });
      setTimeout(() => setMsg(null), 3000);
    } else {
      setMsg({ type: "error", text: "Failed to save changes." });
    }
  }

  async function deletePlan() {
    if (!confirm("Delete this test plan? This cannot be undone.")) return;
    await fetch(`/api/testplans/${id}`, { method: "DELETE" });
    router.push(`/plans?projectId=${projectId}`);
  }

  async function unlinkCycle(cycleId: string) {
    const res = await fetch(`/api/testplans/${id}/cycles?cycleId=${cycleId}`, { method: "DELETE" });
    if (res.ok) {
      setPlan((prev) =>
        prev ? { ...prev, cycles: prev.cycles.filter((c) => c.testCycleId !== cycleId) } : prev
      );
    } else {
      setMsg({ type: "error", text: "Failed to unlink cycle." });
    }
  }

  async function openLinkDialog() {
    setShowLinkDialog(true);
    setLinkingCycleId("");
    fetch(`/api/testcycles?projectId=${projectId}`)
      .then((r) => r.json())
      .then((data: AvailableCycle[]) => setAvailableCycles(Array.isArray(data) ? data : []))
      .catch(() => {});
  }

  async function linkCycle() {
    if (!linkingCycleId) return;
    setLinking(true);
    const res = await fetch(`/api/testplans/${id}/cycles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testCycleId: linkingCycleId }),
    });
    setLinking(false);
    if (res.ok) {
      const foundCycle = availableCycles.find((c) => c.id === linkingCycleId);
      if (foundCycle) {
        setPlan((prev) =>
          prev
            ? {
                ...prev,
                cycles: [
                  ...prev.cycles,
                  {
                    testCycleId: foundCycle.id,
                    testCycle: {
                      id: foundCycle.id,
                      key: foundCycle.key,
                      summary: foundCycle.summary,
                      status: foundCycle.status,
                      _count: { executions: 0 },
                      environment: null,
                      build: null,
                    },
                  },
                ],
              }
            : prev
        );
      }
      setShowLinkDialog(false);
      setMsg({ type: "success", text: "Cycle linked successfully." });
      setTimeout(() => setMsg(null), 3000);
    } else {
      const data = await res.json().catch(() => ({}));
      setMsg({ type: "error", text: data.error || "Failed to link cycle." });
      setShowLinkDialog(false);
    }
  }

  if (loading) {
    return (
    <div data-testid="plans-detail-page" className="flex justify-center items-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!plan) {
    return (
    <div data-testid="plans-detail-page" className="text-center py-16">
        <p className="text-muted-foreground">Test plan not found.</p>
        <Button variant="link" onClick={() => router.back()}>Go back</Button>
      </div>
    );
  }

  const linkedCycleIds = new Set(plan.cycles.map((c) => c.testCycleId));
  const unlinkedCycles = availableCycles.filter((c) => !linkedCycleIds.has(c.id));

  return (
    <div data-testid="plans-detail-page" className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3" data-testid="plans-detail-header">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">{plan.key}</span>
              <Badge variant={STATUS_BADGE[plan.status] ?? "draft"}>{plan.status}</Badge>
            </div>
            {editing ? (
              <Input
                className="text-xl font-bold mt-1 h-auto py-1"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            ) : (
              <h1 className="text-xl font-bold">{plan.summary}</h1>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {editing ? (
            <>
              <Button size="sm" onClick={saveEdits} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelEdit}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <ArchiveButton entityType="TEST_PLAN" entityId={id} isArchived={plan.isArchived ?? false} />
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4 mr-1.5" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={deletePlan}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {msg && (
        <div
          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm border ${
            msg.type === "success"
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-destructive/10 text-destructive border-destructive/20"
          }`}
        >
          {msg.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {msg.text}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {[
          { id: "details", label: "Details" },
          { id: "comments", label: "Comments" },
        ].map(({ id: tabId, label }) => (
          <button
            key={tabId}
            onClick={() => setActiveTab(tabId as typeof activeTab)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
              activeTab === tabId
                ? "border-brand-500 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Details Tab */}
      {activeTab === "details" && (
        <>
          {/* Details card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Goals, scope, or notes for this plan"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as Plan["status"])}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DRAFT">Draft</SelectItem>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="COMPLETED">Completed</SelectItem>
                        <SelectItem value="ARCHIVED">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  {plan.description && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Description</p>
                      <p className="text-sm">{plan.description}</p>
                    </div>
                  )}
                  <div className="flex gap-6 text-sm">
                    {plan.priority && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Priority</p>
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: plan.priority.color }} />
                          {plan.priority.name}
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Created</p>
                      <p>{new Date(plan.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Updated</p>
                      <p>{new Date(plan.updatedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Linked Cycles card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Linked Cycles ({plan.cycles.length})
                </CardTitle>
                <Button size="sm" variant="outline" onClick={openLinkDialog}>
                  <Link2 className="h-4 w-4 mr-1.5" />
                  Link Cycle
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {plan.cycles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No test cycles linked yet.
                </p>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <div className="grid grid-cols-12 bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
                    <span className="col-span-2">Key</span>
                    <span className="col-span-4">Summary</span>
                    <span className="col-span-2">Status</span>
                    <span className="col-span-1 text-right">Execs</span>
                    <span className="col-span-2">Pass Rate</span>
                    <span className="col-span-1" />
                  </div>
                  {plan.cycles.map(({ testCycleId, testCycle: c }) => {
                    const stats = plan.executionStatsByCycle[testCycleId] ?? {};
                    const { total, rate } = computePassRate(stats);
                    return (
    <div data-testid="plans-detail-page"
                        key={testCycleId}
                        className="grid grid-cols-12 items-center px-4 py-3 text-sm border-t hover:bg-muted/20 transition-colors"
                      >
                        <span className="col-span-2 font-mono text-xs text-muted-foreground">{c.key}</span>
                        <span className="col-span-4 pr-2 truncate">{c.summary}</span>
                        <span className="col-span-2">
                          <Badge variant={STATUS_BADGE[c.status] ?? "draft"} className="text-xs">
                            {c.status}
                          </Badge>
                        </span>
                        <span className="col-span-1 text-right text-muted-foreground text-xs">
                          {total > 0 ? total : c._count.executions}
                        </span>
                        <span className="col-span-2 pr-3">
                          {total > 0 ? (
                            <div className="space-y-1">
                              <Progress value={rate} className="h-1.5" />
                              <p className="text-xs text-muted-foreground">{rate}%</p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </span>
                        <span className="col-span-1 flex justify-end">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => unlinkCycle(testCycleId)}
                            title="Unlink cycle"
                          >
                            <Unlink className="h-3.5 w-3.5" />
                          </Button>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Comments Tab */}
      {activeTab === "comments" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comments</CardTitle>
          </CardHeader>
          <CardContent>
            <CommentThread entityType="TEST_PLAN" entityId={id} />
          </CardContent>
        </Card>
      )}

      {/* Link Cycle Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={(open) => {
        setShowLinkDialog(open);
        if (!open) {
          setCycleSearchQuery("");
          setCycleSearchResults([]);
          setLinkingCycleId("");
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link a Test Cycle</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Search Test Cycles</Label>
              <div className="relative">
                <Input
                  placeholder="Type cycle ID, key, or name..."
                  value={cycleSearchQuery}
                  onChange={(e) => setCycleSearchQuery(e.target.value)}
                  className="h-9"
                  autoFocus
                />
                {cycleSearchLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Search Results */}
              <div className="border rounded-lg max-h-64 overflow-y-auto bg-background">
                {cycleSearchQuery.trim() === "" ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Start typing to search for test cycles...
                  </p>
                ) : cycleSearchLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : cycleSearchResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No test cycles found. Try a different search term.
                  </p>
                ) : (
                  <div>
                    {cycleSearchResults.map((cycle) => (
                      <button
                        key={cycle.id}
                        onClick={() => {
                          setLinkingCycleId(cycle.id);
                        }}
                        className={`w-full text-left px-3 py-3 border-b last:border-b-0 hover:bg-muted transition-colors ${
                          linkingCycleId === cycle.id ? "bg-primary/10 border-l-2 border-l-primary" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-xs text-muted-foreground">{cycle.key}</p>
                            <p className="text-sm font-medium truncate">{cycle.summary}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Status: <span className="capitalize">{cycle.status.toLowerCase()}</span>
                            </p>
                          </div>
                          {linkingCycleId === cycle.id && (
                            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {linkingCycleId && (
                <div className="p-2 bg-primary/5 border border-primary/20 rounded text-xs text-primary">
                  Selected: <span className="font-mono">{cycleSearchResults.find(c => c.id === linkingCycleId)?.key}</span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowLinkDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={linkCycle}
              disabled={!linkingCycleId || linking}
            >
              {linking && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Link Cycle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
