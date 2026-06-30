"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Menu, X, LayoutDashboard, ClipboardList, RefreshCw, FileText, BarChart2, Zap, Settings2, Plus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProject } from "@/hooks/use-project";
import { useTenant } from "@/hooks/use-tenant";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PROJECT_PAGES = ["/cases", "/cycles", "/plans", "/reports", "/automation"];

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Test Cases", href: "/cases", icon: ClipboardList, project: true },
  { label: "Test Cycles", href: "/cycles", icon: RefreshCw, project: true },
  { label: "Test Plans", href: "/plans", icon: FileText, project: true },
  { label: "Reports", href: "/reports", icon: BarChart2, project: true },
  { label: "Automation", href: "/automation", icon: Zap },
  { label: "Settings", href: "/settings", icon: Settings2 },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { projects, selectedProjectId, selectedProject, setSelectedProject } = useProject();
  const [isOpen, setIsOpen] = useState(false);

  function handleSelectProject(id: string) {
    setSelectedProject(id);
    const segment = PROJECT_PAGES.find(p => pathname.startsWith(p));
    if (segment) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("projectId", id);
      router.replace(`${pathname.split("?")[0]}?${params.toString()}`);
    }
    setIsOpen(false);
  }

  function buildHref(href: string, needsProject: boolean) {
    if (!needsProject || !selectedProjectId) return href;
    return `${href}?projectId=${selectedProjectId}`;
  }

  function handleNavClick() {
    setIsOpen(false);
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/") || pathname.startsWith(href + "?");
  }

  const initials = selectedProject?.key?.slice(0, 2) ?? "QA";

  return (
    <>
      {/* Hamburger menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 sm:hidden"
        onClick={() => setIsOpen(!isOpen)}
        data-testid="mobile-nav-toggle"
      >
        {isOpen ? (
          <X className="h-4 w-4" />
        ) : (
          <Menu className="h-4 w-4" />
        )}
      </Button>

      {/* Mobile menu */}
      {isOpen && (
        <div className="absolute top-12 left-0 right-0 bg-card border-b shadow-lg z-40 sm:hidden" data-testid="mobile-nav-menu">
          <div className="max-h-[calc(100vh-3rem)] overflow-y-auto">
            {/* Project Selector */}
            <div className="px-4 py-3 border-b" data-testid="mobile-nav-project-section">
              <p className="text-xs font-semibold text-muted-foreground mb-2">WORKSPACE</p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center w-full gap-2 px-2 py-2 rounded-lg hover:bg-muted transition-colors"
                    data-testid="mobile-nav-project-selector"
                  >
                    <div className="flex items-center justify-center h-7 w-7 rounded-md bg-primary/20 text-primary-foreground/70 text-xs font-bold shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium truncate">
                        {selectedProject?.name ?? "Select Project"}
                      </p>
                      {selectedProject && (
                        <p className="text-xs text-muted-foreground">{selectedProject.key}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="start" className="w-56" data-testid="mobile-nav-project-menu">
                  {projects.map(p => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => handleSelectProject(p.id)}
                      className={cn(p.id === selectedProjectId && "font-medium text-primary")}
                      data-testid={`mobile-nav-project-option-${p.id}`}
                    >
                      <span className="text-xs font-mono mr-2 text-muted-foreground">{p.key}</span>
                      <span>{p.name}</span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild data-testid="mobile-nav-new-project">
                    <Link href="/settings?section=new-project" onClick={() => setIsOpen(false)}>
                      <Plus className="h-4 w-4 mr-2" /> New Project
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Navigation Items */}
            <nav className="px-2 py-2 space-y-1" data-testid="mobile-nav-items">
              {NAV.map(({ label, href, icon: Icon, project }) => {
                const to = buildHref(href, !!project);
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={to}
                    onClick={handleNavClick}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                      active
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-muted"
                    )}
                    data-testid={`mobile-nav-item-${label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                    <span className="text-sm">{label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Sign Out */}
            <div className="px-2 py-2 border-t" data-testid="mobile-nav-footer">
              <button
                onClick={() => {
                  setIsOpen(false);
                  signOut({ callbackUrl: "/login" });
                }}
                className="flex items-center w-full gap-3 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
                data-testid="mobile-nav-signout"
              >
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 top-12 bg-black/20 z-30 sm:hidden"
          onClick={() => setIsOpen(false)}
          data-testid="mobile-nav-overlay"
        />
      )}
    </>
  );
}
