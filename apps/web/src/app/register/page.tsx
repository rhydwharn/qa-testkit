"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { CheckSquare, Loader2 } from "lucide-react";

type TenantMode = "create" | "join";

export default function RegisterPage() {
  const router = useRouter();
  const [tenantMode, setTenantMode] = useState<TenantMode>("create");
  const [tenantName, setTenantName] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (tenantMode === "create" && !tenantName.trim()) {
      setError("Please enter a workspace name.");
      return;
    }

    if (tenantMode === "join" && !tenantId.trim()) {
      setError("Please enter a workspace ID.");
      return;
    }

    setLoading(true);

    const registerPayload = {
      name,
      email,
      password,
      tenantMode,
      ...(tenantMode === "create" ? { tenantName } : { tenantId }),
    };

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registerPayload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Registration failed.");
      setLoading(false);
      return;
    }

    // Auto sign in then go to appropriate page
    const signInRes = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (signInRes?.error) {
      setError("Account created but could not sign in automatically. Please log in.");
      router.push("/login");
    } else {
      // If creating new tenant, go to onboarding; if joining, go to projects
      const redirectPath = tenantMode === "create" ? "/onboarding" : "/projects";
      router.push(redirectPath);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left branded panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col items-center justify-center p-12 text-white">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
            <CheckSquare className="h-7 w-7 text-white" />
          </div>
          <span className="text-3xl font-bold tracking-tight">QA Testkit</span>
        </div>
        <p className="text-slate-400 text-center max-w-xs text-sm leading-relaxed">
          Manage test cases, cycles, and execution results — all in one place.
        </p>
        <div className="mt-12 grid grid-cols-2 gap-4 text-center w-full max-w-xs">
          <div className="rounded-lg bg-white/5 p-4">
            <p className="text-2xl font-bold">100%</p>
            <p className="text-xs text-slate-400 mt-1">Visibility</p>
          </div>
          <div className="rounded-lg bg-white/5 p-4">
            <p className="text-2xl font-bold">Real-time</p>
            <p className="text-xs text-slate-400 mt-1">Reporting</p>
          </div>
        </div>
      </div>

      {/* Right register form */}
      <div className="flex flex-1 flex-col items-center justify-center p-8 bg-background">
        <div className="flex lg:hidden items-center gap-2 mb-10">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900">
            <CheckSquare className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-foreground">QA Testkit</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Already have an account?{" "}
              <Link href="/login" className="text-primary underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-3 pb-4 border-b">
              <Label className="text-base font-semibold">Workspace</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-50">
                  <input
                    type="radio"
                    name="tenantMode"
                    value="create"
                    checked={tenantMode === "create"}
                    onChange={() => setTenantMode("create")}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Create new workspace</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-50">
                  <input
                    type="radio"
                    name="tenantMode"
                    value="join"
                    checked={tenantMode === "join"}
                    onChange={() => setTenantMode("join")}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Join existing workspace</span>
                </label>
              </div>
            </div>

            {tenantMode === "create" && (
              <div className="space-y-1.5">
                <Label htmlFor="tenantName">Workspace name</Label>
                <Input
                  id="tenantName"
                  type="text"
                  placeholder="e.g., Acme Corp QA"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  required
                />
              </div>
            )}

            {tenantMode === "join" && (
              <div className="space-y-1.5">
                <Label htmlFor="tenantId">Workspace ID</Label>
                <Input
                  id="tenantId"
                  type="text"
                  placeholder="Enter workspace ID"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <PasswordInput
                id="confirm"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create account
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
