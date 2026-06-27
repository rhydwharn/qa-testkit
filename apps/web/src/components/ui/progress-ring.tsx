"use client";
import { cn } from "@/lib/utils";

interface ProgressRingProps {
  size?: number;
  strokeWidth?: number;
  pass?: number;
  fail?: number;
  blocked?: number;
  notRun?: number;
  total?: number;
  showLabel?: boolean;
  className?: string;
}

export function ProgressRing({
  size = 64,
  strokeWidth = 8,
  pass = 0,
  fail = 0,
  blocked = 0,
  notRun = 0,
  total,
  showLabel = true,
  className,
}: ProgressRingProps) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const effectiveTotal = total ?? (pass + fail + blocked + notRun);
  const pct = (n: number) => (effectiveTotal > 0 ? n / effectiveTotal : 0);

  const segments = [
    { color: "#10B981", pct: pct(pass) },
    { color: "#EF4444", pct: pct(fail) },
    { color: "#F59E0B", pct: pct(blocked) },
    {
      color: "#94A3B8",
      pct:
        pct(notRun) ||
        (effectiveTotal === 0
          ? 1
          : pct(effectiveTotal - pass - fail - blocked)),
    },
  ];

  let offset = 0;
  const passRate =
    effectiveTotal > 0 ? Math.round((pass / effectiveTotal) * 100) : null;

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        className
      )}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {segments.map((seg, i) => {
          const dashArray = seg.pct * circ;
          const dashOffset = circ - offset * circ;
          offset += seg.pct;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashArray} ${circ - dashArray}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="butt"
            />
          );
        })}
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-foreground">
            {passRate !== null ? `${passRate}%` : "—"}
          </span>
        </div>
      )}
    </div>
  );
}
