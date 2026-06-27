import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateKey(prefix: string, id: number) {
  return `${prefix}-${id}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    PASS: "text-pass bg-pass/10",
    FAIL: "text-fail bg-fail/10",
    BLOCKED: "text-blocked bg-blocked/10",
    SKIPPED: "text-skipped bg-skipped/10",
    NOT_RUN: "text-muted-foreground bg-muted",
    IN_PROGRESS: "text-brand-500 bg-brand-50",
  };
  return map[status] ?? "text-muted-foreground bg-muted";
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
