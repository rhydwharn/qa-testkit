"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, ClipboardList, RefreshCw, FileText,
  BarChart2, Zap, Settings2, ChevronDown, LogOut,
  CheckSquare, Plus, ChevronsLeft, ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProject } from "@/hooks/use-project";
import { useTenant } from "@/hooks/use-tenant";
import { signOut } from "next-auth/react";
import { TestIds } from "@/lib/test-ids";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Pages that accept a projectId query param
const PROJECT_PAGES = ["/cases", "/cycles", "/plans", "/reports", "/automation"];

const NAV = [
  { label: "Dashboard",   href: "/dashboard",  icon: LayoutDashboard },
  { label: "Test Cases",  href: "/cases",      icon: ClipboardList,   project: true },
  { label: "Test Cycles", href: "/cycles",     icon: RefreshCw,       project: true },
  { label: "Test Plans",  href: "/plans",      icon: FileText,        project: true },
  { label: "Reports",     href: "/reports",    icon: BarChart2,       project: true },
  { label: "Automation",  href: "/automation", icon: Zap },
  { label: "Settings",    href: "/settings",   icon: Settings2 },
];

const SIDEBAR_KEY = "qa_tm_sidebar_expanded";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { projects, selectedProjectId, selectedProject, setSelectedProject } = useProject();
  const { tenantName, tenantLogoUrl, tenantLogoDisplay } = useTenant();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    setExpanded(stored !== "false");
  }, []);

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    localStorage.setItem(SIDEBAR_KEY, String(next));
  }

  function handleSelectProject(id: string) {
    setSelectedProject(id);
    // Also update the URL so useSearchParams()-based pages re-fetch
    const segment = PROJECT_PAGES.find(p => pathname.startsWith(p));
    if (segment) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("projectId", id);
      router.replace(`${pathname.split("?")[0]}?${params.toString()}`);
    }
  }

  function buildHref(href: string, needsProject: boolean) {
    if (!needsProject || !selectedProjectId) return href;
    return `${href}?projectId=${selectedProjectId}`;
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/") || pathname.startsWith(href + "?");
  }

  const initials = selectedProject?.key?.slice(0, 2) ?? "QA";
  const w = expanded ? "w-56" : "w-14";

  return (
    <nav
      className={cn(
        "relative flex flex-col h-screen bg-sidebar border-r border-sidebar-border overflow-hidden z-30 shrink-0",
        "transition-[width] duration-200 ease-in-out",
        w
      )}
      data-testid={TestIds.sidebar.root}
    >
      {/* Logo + toggle */}
      <div className="flex items-center h-14 px-3 border-b border-sidebar-border shrink-0 gap-2" data-testid="sidebar-header">
        {expanded ? (
          <>
            {/* Expanded: logo fills available space, or icon+name */}
            {tenantLogoUrl && tenantLogoDisplay !== "NAME_ONLY" ? (
              <img
                src={tenantLogoUrl}
                alt={tenantName ?? "Logo"}
                className={cn(
                  "object-contain rounded shrink-0",
                  tenantLogoDisplay === "LOGO_ONLY"
                    // Take the full header height, grow to fill width up to a cap
                    ? "h-9 w-auto max-w-[8rem] flex-1"
                    // Side-by-side with name: fixed square
                    : "h-9 w-9 min-w-[2.25rem]"
                )}
                data-testid="sidebar-logo"
              />
            ) : (
              <div className="flex items-center justify-center h-8 w-8 min-w-[2rem] rounded-lg bg-primary shrink-0" data-testid="sidebar-logo-fallback">
                <CheckSquare className="h-4 w-4 text-white" />
              </div>
            )}
            {tenantLogoDisplay !== "LOGO_ONLY" && (
              <span
                className="text-white font-semibold text-sm min-w-0 flex-1 truncate"
                title={tenantName ?? "QA Testkit"}
                data-testid="sidebar-tenant-name"
              >
                {tenantName ?? "QA Testkit"}
              </span>
            )}
          </>
        ) : (
          /* Collapsed: centered icon or logo */
          <div className="flex flex-1 items-center justify-center" data-testid="sidebar-logo-collapsed">
            {tenantLogoUrl && tenantLogoDisplay !== "NAME_ONLY" ? (
              <img
                src={tenantLogoUrl}
                alt={tenantName ?? "Logo"}
                className="h-8 w-8 object-contain rounded"
                data-testid="sidebar-logo-collapsed-img"
              />
            ) : (
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary" data-testid="sidebar-logo-collapsed-fallback">
                <CheckSquare className="h-4 w-4 text-white" />
              </div>
            )}
          </div>
        )}
        <button
          onClick={toggle}
          className="text-sidebar-fg hover:text-white hover:bg-sidebar-hover rounded p-0.5 transition-colors shrink-0 relative z-40"
          title={expanded ? "Collapse sidebar" : "Expand sidebar"}
          data-testid="sidebar-toggle-button"
        >
          {expanded
            ? <ChevronsLeft className="h-4 w-4" />
            : <ChevronsRight className="h-4 w-4" />
          }
        </button>
      </div>

      {/* Project switcher */}
      <div className="px-2 py-2 border-b border-sidebar-border shrink-0" data-testid="sidebar-project-switcher">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center w-full rounded-lg px-1.5 py-1.5 hover:bg-sidebar-hover transition-colors"
              title={expanded ? undefined : (selectedProject?.name ?? "Select project")}
              data-testid="sidebar-project-selector-button"
            >
              <div className="flex items-center justify-center h-7 w-7 rounded-md bg-primary/20 text-primary-foreground/70 text-xs font-bold shrink-0" data-testid="sidebar-project-initials">
                {initials}
              </div>
              {expanded && (
                <div className="ml-2.5 flex-1 min-w-0 flex items-center justify-between" data-testid="sidebar-project-name-container">
                  <span className="text-sidebar-fg text-xs font-medium truncate" data-testid="sidebar-project-name">
                    {selectedProject?.name ?? "Select Project"}
                  </span>
                  <ChevronDown className="h-3 w-3 text-sidebar-fg ml-1 shrink-0" data-testid="sidebar-project-dropdown-icon" />
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-52" data-testid="sidebar-project-menu">
            {projects.map(p => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => handleSelectProject(p.id)}
                className={cn(p.id === selectedProjectId && "font-medium text-primary")}
                data-testid={`sidebar-project-option-${p.id}`}
              >
                <span className="text-xs font-mono mr-2 text-muted-foreground" data-testid={`sidebar-project-key-${p.id}`}>{p.key}</span>
                <span data-testid={`sidebar-project-name-${p.id}`}>{p.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator data-testid="sidebar-project-menu-separator" />
            <DropdownMenuItem asChild data-testid="sidebar-new-project-option">
              <Link href="/settings?section=new-project" className="flex items-center gap-2">
                <Plus className="h-3.5 w-3.5" /> New Project
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Nav items */}
      <div className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden" data-testid={TestIds.sidebar.menu}>
        {NAV.map(({ label, href, icon: Icon, project }) => {
          const to = buildHref(href, !!project);
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={to}
              title={expanded ? undefined : label}
              className={cn(
                "flex items-center rounded-lg px-1.5 py-2 transition-colors",
                active
                  ? "bg-sidebar-active-bg text-white"
                  : "text-sidebar-fg hover:bg-sidebar-hover hover:text-white"
              )}
              data-testid={TestIds.sidebar.item(label.toLowerCase().replace(/\s+/g, "-"))}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {expanded && (
                <span className="ml-3 text-sm font-medium whitespace-nowrap" data-testid={`sidebar-nav-label-${label.toLowerCase().replace(/\s+/g, "-")}`}>
                  {label}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Sign out */}
      <div className="px-2 py-3 border-t border-sidebar-border shrink-0" data-testid="sidebar-footer">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title={expanded ? undefined : "Sign out"}
          className="flex items-center w-full rounded-lg px-1.5 py-2 text-sidebar-fg hover:bg-sidebar-hover hover:text-white transition-colors"
          data-testid="sidebar-signout-button"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          {expanded && (
            <span className="ml-3 text-sm whitespace-nowrap" data-testid="sidebar-signout-text">Sign out</span>
          )}
        </button>
      </div>
    </nav>
  );
}
