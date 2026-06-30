"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, LayoutDashboard, ClipboardList, RefreshCw, FileText, BarChart2, Zap, Settings2, Plus, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProject } from "@/hooks/use-project";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  kbd?: string;
  group: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { selectedProjectId } = useProject();

  const pq = selectedProjectId ? `?projectId=${selectedProjectId}` : "";

  const ALL_COMMANDS: CommandItem[] = [
    // Navigation
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, action: () => router.push("/dashboard"), group: "Navigate" },
    { id: "cases", label: "Test Cases", icon: ClipboardList, action: () => router.push(`/cases${pq}`), group: "Navigate" },
    { id: "cycles", label: "Test Cycles", icon: RefreshCw, action: () => router.push(`/cycles${pq}`), group: "Navigate" },
    { id: "plans", label: "Test Plans", icon: FileText, action: () => router.push(`/plans${pq}`), group: "Navigate" },
    { id: "reports", label: "Reports", icon: BarChart2, action: () => router.push(`/reports${pq}`), group: "Navigate" },
    { id: "automation", label: "Automation", icon: Zap, action: () => router.push("/automation"), group: "Navigate" },
    { id: "settings", label: "Settings", icon: Settings2, action: () => router.push("/settings"), group: "Navigate" },
    // Actions
    { id: "new-tc", label: "New Test Case", icon: Plus, action: () => router.push(`/cases/new${pq}`), kbd: "⌘N", group: "Create" },
    { id: "new-cycle", label: "New Test Cycle", icon: Plus, action: () => router.push(`/cycles/new${pq}`), group: "Create" },
    { id: "new-plan", label: "New Test Plan", icon: Plus, action: () => router.push(`/plans/new${pq}`), group: "Create" },
  ];

  const filtered = useMemo(() => query.trim()
    ? ALL_COMMANDS.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.group.toLowerCase().includes(query.toLowerCase())
      )
    : ALL_COMMANDS, [query]);

  const groups = useMemo(() => [...new Set(filtered.map(c => c.group))], [filtered]);

  // Listen for open event and keyboard shortcut
  useEffect(() => {
    function handleOpen() { setOpen(true); setQuery(""); setSelected(0); }
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); handleOpen(); }
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      if (e.key === "Enter" && filtered[selected]) { filtered[selected].action(); setOpen(false); }
    }
    window.addEventListener("open-command", handleOpen);
    window.addEventListener("keydown", handleKey);
    return () => { window.removeEventListener("open-command", handleOpen); window.removeEventListener("keydown", handleKey); };
  }, [open, filtered, selected]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);
  useEffect(() => { setSelected(0); }, [query]);

  if (!open) return null;

  let itemIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
      onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-fade-in-scale">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search or jump to…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <kbd className="text-xs bg-muted border rounded px-1.5 py-0.5 text-muted-foreground font-mono">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No results for "{query}"</p>
          )}
          {groups.map(group => (
            <div key={group}>
              <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{group}</p>
              {filtered.filter(c => c.group === group).map(cmd => {
                itemIndex++;
                const idx = itemIndex;
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.id}
                    onMouseEnter={() => setSelected(idx)}
                    onClick={() => { cmd.action(); setOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors",
                      selected === idx ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{cmd.label}</span>
                    {cmd.kbd && (
                      <kbd className={cn("text-xs font-mono border rounded px-1.5 py-0.5",
                        selected === idx ? "bg-white/20 border-white/30 text-white" : "bg-muted border-border text-muted-foreground"
                      )}>{cmd.kbd}</kbd>
                    )}
                    <ArrowRight className={cn("h-3.5 w-3.5 opacity-0 transition-opacity", selected === idx && "opacity-100")} />
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> open</span>
          <span><kbd className="font-mono">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
