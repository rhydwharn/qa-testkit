"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Loader2 } from "lucide-react";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token || !email) {
      setError("Invalid reset link. Missing token or email.");
      setValidating(false);
      return;
    }

    // Validate token
    fetch(
      `/api/auth/validate-reset-token?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
    )
      .then(async (res) => {
        if (res.ok) {
          setIsValid(true);
        } else {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Invalid or expired reset link.");
        }
      })
      .catch(() => {
        setError("Failed to validate reset link. Please try again.");
      })
      .finally(() => {
        setValidating(false);
      });
  }, [token, email]);

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

    setLoading(true);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, email, password }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to reset password. Please try again.");
      return;
    }

    setSubmitted(true);
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Set new password</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enter your new password below.
        </p>
      </div>

      {validating ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : submitted ? (
        <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800 border border-green-200">
          <p className="font-medium">Password reset successful!</p>
          <p className="mt-1">Your password has been updated. You can now sign in with your new password.</p>
          <div className="mt-4">
            <Link href="/login">
              <Button className="w-full">Go to login</Button>
            </Link>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive border border-destructive/20">
          <p className="font-medium">Error</p>
          <p className="mt-1">{error}</p>
          {!isValid && (
            <p className="mt-3 text-xs">
              <Link href="/forgot-password" className="text-destructive hover:underline">
                Request a new reset link
              </Link>
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <PasswordInput
              id="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              autoFocus
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
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Reset password
          </Button>
        </form>
      )}
    </div>
  );
}
