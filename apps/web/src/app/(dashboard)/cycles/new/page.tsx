"use client";

import { useState, useEffect } from "react";
import { TestIds } from "@/lib/test-ids";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, CheckSquare, Square } from "lucide-react";
import Link from "next/link";

interface TestCase {
  id: string;
  key: string;
  summary: string;
  status: string;
}

interface Environment { id: string; name: string; }
interface Build { id: string; name: string; }

export default function NewCyclePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [cycleStatus, setCycleStatus] = useState<"DRAFT" | "ACTIVE" | "CLOSED">("DRAFT");
  const [environmentId, setEnvironmentId] = useState("");
  const [buildId, setBuildId] = useState("");
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [builds, setBuilds] = useState<Build[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId) return;
    Promise.all([
      fetch(`/api/testcases?projectId=${projectId}`).then(async (r) => {
        if (!r.ok) throw new Error("Failed to fetch test cases");
        return r.json();
      }),
      fetch(`/api/projects/${projectId}/settings/environments`).then(async (r) => {
        if (!r.ok) throw new Error("Failed to fetch environments");
        return r.json();
      }),
      fetch(`/api/projects/${projectId}/settings/builds`).then(async (r) => {
        if (!r.ok) throw new Error("Failed to fetch builds");
        return r.json();
      }),
    ]).then(([cases, envs, blds]) => {
      setTestCases(Array.isArray(cases) ? cases : []);
      setEnvironments(Array.isArray(envs) ? envs : []);
      setBuilds(Array.isArray(blds) ? blds : []);
    }).catch(() => {});
  }, [projectId]);

  function toggleCase(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) { setError("No project selected"); return; }
    
    // Validate selected environment if set
    if (environmentId && !environments.find(e => e.id === environmentId)) {
      setError("Selected environment is no longer available");
      return;
    }
    
    // Validate selected build if set
    if (buildId && !builds.find(b => b.id === buildId)) {
      setError("Selected build is no longer available");
      return;
    }
    
    setSaving(true);
    setError("");

    const res = await fetch("/api/testcycles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        summary,
        description,
        status: cycleStatus,
        environmentId: environmentId || undefined,
        buildId: buildId || undefined,
        testCaseIds: Array.from(selectedIds),
      }),
    });

    setSaving(false);
    if (res.ok) {
      const cycle = await res.json();
      router.push(`/cycles/${cycle.id}?projectId=${projectId}`);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to create cycle");
    }
  }

  return (
    <div className="max-w-3xl space-y-6" data-testid="cycles-new-page">
      <div className="flex items-center gap-3" data-testid="cycles-new-header">
        <Link href={`/cycles?projectId=${projectId}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New Test Cycle</h1>
          <p className="text-sm text-muted-foreground">Create a cycle and add test cases to execute</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive border border-destructive/20">
            {error}
          </div>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Cycle Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="summary">Name *</Label>
              <Input
                id="summary"
                placeholder="e.g. Sprint 12 Regression, Release 2.1 Smoke"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Goals, scope, or notes for this cycle"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={cycleStatus} onValueChange={(v) => setCycleStatus(v as typeof cycleStatus)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Environment</Label>
                <Select value={environmentId} onValueChange={setEnvironmentId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={environments.length === 0 ? "None configured" : "Select environment"} />
                  </SelectTrigger>
                  <SelectContent>
                    {environments.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {environments.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    <Link href={`/settings?projectId=${projectId}`} className="text-brand-500 hover:underline">Configure environments</Link> in Settings.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Build</Label>
                <Select value={buildId} onValueChange={setBuildId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={builds.length === 0 ? "None configured" : "Select build"} />
                  </SelectTrigger>
                  <SelectContent>
                    {builds.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {builds.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    <Link href={`/settings?projectId=${projectId}`} className="text-brand-500 hover:underline">Configure builds</Link> in Settings.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Add Test Cases</span>
              <span className="text-sm font-normal text-muted-foreground">
                {selectedIds.size} of {testCases.length} selected
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {testCases.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No test cases in this project yet.{" "}
                <Link href={`/cases/new?projectId=${projectId}`} className="text-brand-500 hover:underline">
                  Create some first.
                </Link>
              </div>
            ) : (
              <div className="space-y-0 divide-y rounded-md border overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-muted/50">
                  <span className="text-xs font-medium text-muted-foreground">TEST CASE</span>
                  <button
                    type="button"
                    className="text-xs text-brand-500 hover:underline"
                    onClick={() => {
                      if (selectedIds.size === testCases.length) setSelectedIds(new Set());
                      else setSelectedIds(new Set(testCases.map((t) => t.id)));
                    }}
                  >
                    {selectedIds.size === testCases.length ? "Deselect all" : "Select all"}
                  </button>
                </div>
                {testCases.map((tc) => (
                  <div
                    key={tc.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => toggleCase(tc.id)}
                  >
                    {selectedIds.has(tc.id)
                      ? <CheckSquare className="h-4 w-4 text-brand-500 shrink-0" />
                      : <Square className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <span className="font-mono text-xs text-muted-foreground w-16 shrink-0">{tc.key}</span>
                    <span className="text-sm">{tc.summary}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving || !summary.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Create Cycle
          </Button>
          <Link href={`/cycles?projectId=${projectId}`}>
            <Button type="button" variant="ghost">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
