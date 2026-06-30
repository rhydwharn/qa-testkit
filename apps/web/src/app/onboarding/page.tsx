"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckSquare, Loader2, Pencil, Check, Copy, Eye, EyeOff, Upload, X } from "lucide-react";

type Step = 1 | 2 | 3;

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

export default function OnboardingPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  // Step 1 state
  const [workspaceName, setWorkspaceName] = useState("");
  const [slug, setSlug] = useState("");
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [step1Loading, setStep1Loading] = useState(false);
  const [step1Error, setStep1Error] = useState("");
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoDisplay, setLogoDisplay] = useState<"NAME_ONLY" | "LOGO_ONLY" | "LOGO_AND_NAME">("NAME_ONLY");
  const [logoError, setLogoError] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Step 2 state
  const [projectKey, setProjectKey] = useState("");
  const [projectName, setProjectName] = useState("");
  const [step2Loading, setStep2Loading] = useState(false);
  const [step2Error, setStep2Error] = useState("");

  // Step 3 state
  const [keyName, setKeyName] = useState("CI/CD Pipeline");
  const [step3Loading, setStep3Loading] = useState(false);
  const [step3Error, setStep3Error] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  // Redirect to dashboard only after onboarding is complete (step 3 with API key generated)
  // Don't redirect during onboarding just because tenantId exists
  useEffect(() => {
    if (session?.user?.tenantId && step === 3 && generatedKey) {
      router.push("/dashboard");
    }
  }, [session?.user?.tenantId, step, generatedKey, router]);

  // Auto-generate slug from workspace name
  useEffect(() => {
    if (!editingSlug) {
      setSlug(toSlug(workspaceName));
    }
  }, [workspaceName, editingSlug]);

  // Check slug availability
  useEffect(() => {
    if (!slug) { setSlugAvailable(null); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/tenants/check-slug?slug=${encodeURIComponent(slug)}`);
      if (res.ok) {
        const data = await res.json();
        setSlugAvailable(data.available);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [slug]);

  function handleLogoSelect(file: File | null) {
    setLogoError("");
    if (!file) { setLogoFile(null); setLogoPreview(null); return; }
    if (!file.type.startsWith("image/")) { setLogoError("Only image files are allowed."); return; }
    if (file.size > 200 * 1024) { setLogoError("Logo must be 200 KB or smaller."); return; }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    setStep1Error("");
    if (!workspaceName.trim()) return;
    if (slugAvailable === false) { setStep1Error("That slug is already taken — choose another."); return; }

    setStep1Loading(true);
    const res = await fetch("/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: workspaceName.trim(), slug }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) { setStep1Loading(false); setStep1Error(data.error ?? "Failed to create workspace."); return; }

    const newTenantId: string = data.id;
    setTenantId(newTenantId);

    // Upload logo if selected
    if (logoFile) {
      const fd = new FormData();
      fd.append("file", logoFile);
      try {
        await fetch(`/api/tenants/${newTenantId}/logo`, { method: "PATCH", body: fd });
      } catch (err) {
        console.error("Failed to upload logo:", err);
      }
    }

    // Always set logoDisplay preference
    try {
      await fetch(`/api/tenants/${newTenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoDisplay }),
      });
    } catch (err) {
      console.error("Failed to set logo display preference:", err);
    }


    setStep1Loading(false);
    // Refresh JWT so tenantId is in session
    await update({ tenantId: newTenantId });
    setStep(2);
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault();
    setStep2Error("");
    setStep2Loading(true);

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: projectKey.toUpperCase(), name: projectName }),
    });
    const data = await res.json().catch(() => ({}));
    setStep2Loading(false);

    if (!res.ok) { setStep2Error(data.error ?? "Failed to create project."); return; }

    setStep(3);
  }

  async function handleStep3(e: React.FormEvent) {
    e.preventDefault();
    setStep3Error("");
    setStep3Loading(true);

    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: keyName }),
    });
    const data = await res.json().catch(() => ({}));
    setStep3Loading(false);

    if (!res.ok) { setStep3Error(data.error ?? "Failed to generate API key."); return; }

    setGeneratedKey(data.key ?? data.plainKey ?? null);
  }

  function handleCopy() {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const steps = [
    { n: 1, label: "Create workspace" },
    { n: 2, label: "First project" },
    { n: 3, label: "API key" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-10">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900">
          <CheckSquare className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold text-foreground">QA Testkit</span>
      </div>

      <div className="w-full max-w-lg">
        {/* Step indicator */}
        <div className="flex items-center justify-center mb-10 gap-0">
          {steps.map((s, i) => (
            <div key={s.n} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold border-2 transition-colors ${
                  step > s.n ? "bg-primary border-primary text-primary-foreground" :
                  step === s.n ? "border-primary text-primary" :
                  "border-muted-foreground/30 text-muted-foreground/50"
                }`}>
                  {step > s.n ? <Check className="h-4 w-4" /> : s.n}
                </div>
                <span className={`mt-1.5 text-xs whitespace-nowrap ${step >= s.n ? "text-foreground" : "text-muted-foreground/50"}`}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`h-px w-16 mb-5 mx-2 transition-colors ${step > s.n ? "bg-primary" : "bg-muted-foreground/20"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Workspace */}
        {step === 1 && (
          <form onSubmit={handleStep1} className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Create your workspace</h2>
              <p className="text-sm text-muted-foreground mt-1">Your workspace is where your team manages test quality.</p>
            </div>

            {step1Error && (
              <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{step1Error}</div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="workspace-name">Workspace name</Label>
              <Input
                id="workspace-name"
                placeholder="Acme QA"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="slug">URL slug</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center rounded-md border bg-muted/50 px-3 text-sm overflow-hidden">
                  <span className="text-muted-foreground shrink-0">testkit.app/</span>
                  {editingSlug ? (
                    <Input
                      id="slug"
                      className="border-0 bg-transparent h-9 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 48))}
                      onBlur={() => setEditingSlug(false)}
                      autoFocus
                    />
                  ) : (
                    <span className="py-2">{slug || "—"}</span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setEditingSlug(true)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
              {slug && (
                <p className={`text-xs ${slugAvailable === false ? "text-destructive" : slugAvailable ? "text-green-600" : "text-muted-foreground"}`}>
                  {slugAvailable === null ? "Checking availability…" : slugAvailable ? "Available" : "Already taken"}
                </p>
              )}
            </div>

            {/* Logo upload (optional) */}
            <div className="space-y-2">
              <Label>Workspace logo <span className="text-muted-foreground font-normal text-xs">(optional, max 200 KB)</span></Label>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleLogoSelect(e.target.files?.[0] ?? null)}
              />
              {logoPreview ? (
                <div className="flex items-center gap-3">
                  <img src={logoPreview} alt="Logo preview" className="h-14 w-14 rounded-lg object-cover border" />
                  <div className="flex flex-col gap-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
                      Change
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleLogoSelect(null)}>
                      <X className="h-3.5 w-3.5 mr-1" /> Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="flex items-center gap-2 w-full rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 text-sm text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground transition-colors"
                >
                  <Upload className="h-4 w-4 shrink-0" />
                  Click to upload logo (JPG, PNG, WebP, SVG)
                </button>
              )}
              {logoError && <p className="text-xs text-destructive">{logoError}</p>}
            </div>

            {/* Display mode */}
            <div className="space-y-2">
              <Label>Sidebar display</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["NAME_ONLY", "LOGO_ONLY", "LOGO_AND_NAME"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setLogoDisplay(mode)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      logoDisplay === mode
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-foreground/40"
                    }`}
                  >
                    {mode === "NAME_ONLY" ? "Name only" : mode === "LOGO_ONLY" ? "Logo only" : "Logo & name"}
                  </button>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={step1Loading || slugAvailable === false || !!logoError}>
              {step1Loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create workspace
            </Button>
          </form>
        )}

        {/* Step 2: First Project */}
        {step === 2 && (
          <form onSubmit={handleStep2} className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Create your first project</h2>
              <p className="text-sm text-muted-foreground mt-1">Projects organise your test cases and cycles.</p>
            </div>

            {step2Error && (
              <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{step2Error}</div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="project-key">Project key</Label>
              <Input
                id="project-key"
                placeholder="SHOP"
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">2–10 uppercase letters, e.g. SHOP, MOBILE</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="project-name">Project name</Label>
              <Input
                id="project-name"
                placeholder="Shop Platform"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => setStep(3)}
              >
                Skip for now
              </Button>
              <Button type="submit" className="flex-1" disabled={step2Loading || projectKey.length < 2}>
                {step2Loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Create project
              </Button>
            </div>
          </form>
        )}

        {/* Step 3: API Key */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Generate an API key</h2>
              <p className="text-sm text-muted-foreground mt-1">Use this key to submit automation results from CI/CD.</p>
            </div>

            {step3Error && (
              <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{step3Error}</div>
            )}

            {!generatedKey ? (
              <form onSubmit={handleStep3} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="key-name">Key name</Label>
                  <Input
                    id="key-name"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value.slice(0, 100))}
                    maxLength={100}
                    placeholder="CI/CD Pipeline"
                    required
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    {keyName.length}/100 characters
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1"
                    onClick={() => router.push("/dashboard")}
                  >
                    Skip for now
                  </Button>
                  <Button type="submit" className="flex-1" disabled={step3Loading}>
                    {step3Loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Generate key
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-5">
                <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                  Copy this key now — it will not be shown again.
                </div>

                <div className="space-y-1.5">
                  <Label>API key</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-md border bg-muted/50 px-3 py-2 font-mono text-sm overflow-x-auto">
                      {showKey ? generatedKey : "•".repeat(Math.min(generatedKey.length, 40))}
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowKey(!showKey)}>
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={handleCopy}>
                      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Button className="w-full" onClick={() => router.push("/dashboard")}>
                  Go to Dashboard
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
