"use client";

import { Suspense } from "react";
import { CheckSquare } from "lucide-react";
import ResetPasswordForm from "./reset-password-form";

export default function ResetPasswordPage() {
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

        <Suspense fallback={<div className="flex items-center justify-center py-8"><span>Loading...</span></div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
