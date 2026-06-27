"use client";

import { useState } from "react";
import { TestIds } from "@/lib/test-ids";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export default function NewPlanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [planStatus, setPlanStatus] = useState<"DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED">("DRAFT");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) { setError("No project selected"); return; }
    setSaving(true);
    setError("");

    const res = await fetch("/api/testplans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, summary, description, status: planStatus }),
    });

    setSaving(false);
    if (res.ok) {
      const plan = await res.json();
      router.push(`/plans/${plan.id}?projectId=${projectId}`);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to create plan");
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3" data-testid="plans-new-header">
        <Link href={`/plans?projectId=${projectId}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New Test Plan</h1>
          <p className="text-sm text-muted-foreground">Create a plan to organise your test cycles</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive border border-destructive/20">
            {error}
          </div>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Plan Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="summary">Summary *</Label>
              <Input
                id="summary"
                placeholder="e.g. Q3 Release Plan, Sprint 12 Test Plan"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Goals, scope, or notes for this plan"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={planStatus} onValueChange={(v) => setPlanStatus(v as typeof planStatus)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving || !summary.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Create Plan
          </Button>
          <Link href={`/plans?projectId=${projectId}`}>
            <Button type="button" variant="ghost">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
