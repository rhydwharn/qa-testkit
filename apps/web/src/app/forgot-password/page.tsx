"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckSquare, Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to process request. Please try again.");
      return;
    }

    setSubmitted(true);
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

      {/* Right form */}
      <div className="flex flex-1 flex-col items-center justify-center p-8 bg-background">
        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-2 mb-10">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900">
            <CheckSquare className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-foreground">QA Testkit</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">Reset your password</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {submitted
                ? "Check your email for a reset link"
                : "Enter your email address and we'll send you a link to reset your password."}
            </p>
          </div>

          {submitted ? (
            <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800 border border-green-200">
              <p className="font-medium">Email sent!</p>
              <p className="mt-1">
                Check your email for a password reset link. The link will expire in 1 hour.
              </p>
              <div className="mt-4 space-y-2">
                <p className="text-xs">
                  <Link href="/login" className="text-green-700 hover:text-green-800 font-medium underline">
                    Back to login
                  </Link>
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading || !email.trim()}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Send reset link
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Remember your password?{" "}
                <Link href="/login" className="text-primary hover:underline underline-offset-2">
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
