"use client";
import { signOut } from "next-auth/react";
import { Bell, Search, Sun, Moon, LogOut, User, Building2 } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { TestIds } from "@/lib/test-ids";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { useTenant } from "@/hooks/use-tenant";

const SECTION_LABELS: Record<string, string> = {
  cases: "Test Cases", cycles: "Test Cycles", plans: "Test Plans",
  reports: "Reports", settings: "Settings", automation: "Automation", dashboard: "Dashboard",
};

interface TopbarProps {
  user: { name?: string | null; email?: string | null; image?: string | null };
}

interface TenantItem { id: string; name: string; slug: string; role: string }

export function Topbar({ user }: TopbarProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const pathname = usePathname();
  const segment = pathname.split("/").find(s => SECTION_LABELS[s]);
  const { tenantId, tenantName, switchTenant } = useTenant();
  const [tenants, setTenants] = useState<TenantItem[]>([]);

  useEffect(() => {
    fetch("/api/tenants")
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setTenants(data); })
      .catch(() => {});
  }, [tenantId]);

  const showSwitcher = tenants.length > 1;

  return (
    <header className="flex h-12 items-center justify-between border-b bg-card px-4 gap-4 shrink-0" data-testid="topbar-header">
      {/* Left: section label */}
      <div className="hidden sm:block sm:w-24 md:w-32 shrink-0" data-testid="topbar-section-label">
        <span className="text-xs sm:text-sm font-semibold text-foreground" data-testid={`topbar-section-${segment || "default"}`}>
          {segment ? SECTION_LABELS[segment] : (tenantName ?? "QA Testkit")}
        </span>
      </div>

      {/* Center: command search */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("open-command"))}
        className="flex items-center gap-2 px-3 h-8 w-full sm:w-auto md:w-72 rounded-lg bg-muted/70 border border-border text-sm text-muted-foreground hover:bg-muted hover:border-primary/30 transition-colors"
        data-testid="topbar-search-button"
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 text-left text-xs" data-testid="topbar-search-text">Search or jump to…</span>
        <kbd className="hidden sm:inline-block text-[10px] bg-background border rounded px-1 py-0.5 font-mono leading-none" data-testid="topbar-search-shortcut">⌘K</kbd>
      </button>

      {/* Right: actions */}
      <div className="flex items-center gap-1 shrink-0 justify-end" data-testid="topbar-actions">
        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="topbar-notifications-button">
          <Bell className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          data-testid="topbar-theme-toggle"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 dark:-rotate-90 dark:scale-0" data-testid="topbar-theme-light" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 dark:rotate-0 dark:scale-100" data-testid="topbar-theme-dark" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" data-testid="topbar-user-menu-trigger">
              <Avatar className="h-7 w-7" data-testid="topbar-user-avatar">
                <AvatarImage src={user.image ?? undefined} data-testid="topbar-user-avatar-image" />
                <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-primary-foreground/70" data-testid="topbar-user-avatar-fallback">
                  {getInitials(user.name ?? user.email ?? "U")}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52" data-testid="topbar-user-menu">
            <div className="px-2 py-1.5" data-testid="topbar-user-info">
              <p className="text-sm font-medium truncate" data-testid="topbar-user-name">{user.name ?? "User"}</p>
              <p className="text-xs text-muted-foreground truncate" data-testid="topbar-user-email">{user.email}</p>
            </div>
            <DropdownMenuSeparator data-testid="topbar-user-menu-separator-1" />
            <DropdownMenuItem data-testid="topbar-profile-option">
              <User className="h-4 w-4 mr-2" /> Profile
            </DropdownMenuItem>
            {showSwitcher && (
              <>
                <DropdownMenuSeparator data-testid="topbar-user-menu-separator-2" />
                <div className="px-2 py-1 text-xs text-muted-foreground" data-testid="topbar-workspace-switcher-label">Switch workspace</div>
                {tenants.map(t => (
                  <DropdownMenuItem
                    key={t.id}
                    onClick={() => t.id !== tenantId && switchTenant(t.id)}
                    className={t.id === tenantId ? "font-medium text-primary pointer-events-none" : ""}
                    data-testid={`topbar-workspace-option-${t.id}`}
                  >
                    <Building2 className="h-3.5 w-3.5 mr-2 shrink-0" />
                    <span className="truncate" data-testid={`topbar-workspace-name-${t.id}`}>{t.name}</span>
                  </DropdownMenuItem>
                ))}
              </>
            )}
            <DropdownMenuSeparator data-testid="topbar-user-menu-separator-3" />
            <DropdownMenuItem className="text-destructive" onClick={() => signOut({ callbackUrl: "/login" })} data-testid="topbar-signout-option">
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
