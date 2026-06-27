"use client";

import { useState, useEffect, use } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckSquare, Loader2, CheckCircle } from "lucide-react";

interface InviteInfo {
  tenantName: string;
  email: string;
  role: string;
  expired: boolean;
  hasAccount: boolean;
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [fetchError, setFetchError] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setFetchError(d.error ?? "Invalid invite link.");
          return;
        }
        const data = await res.json();
        setInvite(data);
      });
  }, [token]);

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const body: Record<string, string> = {};
    if (!invite?.hasAccount) {
      if (!name.trim() || !password) {
        setError("Name and password are required.");
        setLoading(false);
        return;
      }
      body.name = name;
      body.password = password;
    }

    const res = await fetch(`/api/invites/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error ?? "Failed to accept invite.");
      setLoading(false);
      return;
    }

    // Sign in
    const signInRes = await signIn("credentials", {
      email: invite!.email,
      password: invite!.hasAccount ? undefined : password,
      redirect: false,
    });

    setLoading(false);

    if (signInRes?.error) {
      setAccepted(true); // Still accepted, just sign in separately
    } else {
      router.push("/dashboard");
    }
  }

  if (fetchError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="text-destructive mb-4 text-lg font-semibold">{fetchError}</div>
          <Link href="/login">
            <Button variant="outline">Back to login</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-sm space-y-4">
          <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
          <h2 className="text-xl font-bold">You&apos;ve joined {invite.tenantName}!</h2>
          <p className="text-sm text-muted-foreground">Sign in to access your workspace.</p>
          <Link href="/login">
            <Button className="w-full">Sign in</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (invite.expired) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-sm space-y-3">
          <p className="text-destructive font-semibold">This invite link has expired.</p>
          <p className="text-sm text-muted-foreground">Ask the workspace owner to send a new invite.</p>
          <Link href="/login">
            <Button variant="outline">Back to login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-background">
      <div className="flex items-center gap-2 mb-10">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900">
          <CheckSquare className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold text-foreground">QA Testkit</span>
      </div>

      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">You&apos;re invited!</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Join <span className="font-semibold text-foreground">{invite.tenantName}</span> as{" "}
            <span className="capitalize">{invite.role.toLowerCase()}</span>
          </p>
        </div>

        <div className="rounded-md border px-4 py-3 text-sm bg-muted/30">
          <span className="text-muted-foreground">Invite sent to: </span>
          <span className="font-medium">{invite.email}</span>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
        )}

        {invite.hasAccount ? (
          <form onSubmit={handleAccept} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You already have an account. Sign in to accept this invite.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Accept invite &amp; sign in
            </Button>
          </form>
        ) : (
          <form onSubmit={handleAccept} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Create password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create account &amp; join
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
