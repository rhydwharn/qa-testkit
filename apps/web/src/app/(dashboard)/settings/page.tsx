"use client";

import { useState, useEffect, useRef } from "react";
import { TestIds } from "@/lib/test-ids";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useResizablePanel } from "@/hooks/use-resize";
import { PanelResizeHandle } from "@/components/ui/resize-handle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Link as LinkIcon,
  Key,
  Check,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  FolderPlus,
  Globe,
  Package,
  Tag,
  Flag,
  Boxes,
  Users,
  Building2,
  UserPlus,
  Shield,
  Upload,
  X,
} from "lucide-react";
import { useProject } from "@/hooks/use-project";
import { useTenant, broadcastTenantDisplay } from "@/hooks/use-tenant";
import { EditableSettingRow } from "@/components/EditableSettingRow";
import { CreateRoleDialog } from "@/components/CreateRoleDialog";
import { EditRoleDialog } from "@/components/EditRoleDialog";
import { cn } from "@/lib/utils";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  projectId: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  project?: { name: string; key: string } | null;
}

type SettingsSection =
  | "workspace-general"
  | "workspace-members"
  | "workspace-permissions"
  | "workspace-roles"
  | "new-project"
  | "api-keys"
  | "jira"
  | "environments"
  | "builds"
  | "labels"
  | "priorities"
  | "components"
  | "members";

export default function SettingsPage() {
  const { projects, selectedProjectId, selectedProject, refresh: refreshProjects } = useProject();
  const { tenantId, tenantName, tenantRole, tenantLogoUrl, tenantLogoDisplay, refreshTenant } = useTenant();
  const searchParams = useSearchParams();
  const [section, setSection] = useState<SettingsSection>(() => {
    // Will be overridden by useEffect — start with default
    return "workspace-members";
  });

  // Honour ?section= query param on mount
  useEffect(() => {
    const param = searchParams.get("section") as SettingsSection | null;
    const valid: SettingsSection[] = [
      "workspace-general", "workspace-members", "workspace-permissions", "workspace-roles", "new-project", "api-keys", "jira",
      "environments", "builds", "labels", "priorities", "components", "members",
    ];
    if (param && valid.includes(param)) setSection(param);
  }, [searchParams]);
  const { width: navWidth, onMouseDown: onNavResize } = useResizablePanel(208, {
    min: 160, max: 360, storageKey: "settings-nav",
  });

  const [creatingProject, setCreatingProject] = useState(false);
  const [projectMsg, setProjectMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // JIRA
  const [jiraBaseUrl, setJiraBaseUrl] = useState("");
  const [jiraProjectKey, setJiraProjectKey] = useState("");
  const [jiraUserEmail, setJiraUserEmail] = useState("");
  const [jiraApiToken, setJiraApiToken] = useState("");
  const [savingJira, setSavingJira] = useState(false);
  const [jiraSuccess, setJiraSuccess] = useState(false);

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyProject, setNewKeyProject] = useState("none");
  const [generatingKey, setGeneratingKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedProjectId, setCopiedProjectId] = useState<string | null>(null);

  // Environments
  const [envs, setEnvs] = useState<{ id: string; name: string }[]>([]);
  const [envsLoading, setEnvsLoading] = useState(false);
  const [newEnvName, setNewEnvName] = useState("");
  const [addingEnv, setAddingEnv] = useState(false);

  // Builds
  const [builds, setBuilds] = useState<{ id: string; name: string }[]>([]);
  const [buildsLoading, setBuildsLoading] = useState(false);
  const [newBuildName, setNewBuildName] = useState("");
  const [addingBuild, setAddingBuild] = useState(false);

  // Labels
  const [labels, setLabels] = useState<{ id: string; name: string; color: string }[]>([]);
  const [labelsLoading, setLabelsLoading] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#6366f1");
  const [addingLabel, setAddingLabel] = useState(false);

  // Priorities
  const [priorities, setPriorities] = useState<{ id: string; name: string; level: number; color: string }[]>([]);
  const [prioritiesLoading, setPrioritiesLoading] = useState(false);
  const [newPriorityName, setNewPriorityName] = useState("");
  const [newPriorityLevel, setNewPriorityLevel] = useState("3");
  const [newPriorityColor, setNewPriorityColor] = useState("#6366f1");
  const [addingPriority, setAddingPriority] = useState(false);

  // Components
  const [components, setComponents] = useState<{ id: string; name: string }[]>([]);
  const [componentsLoading, setComponentsLoading] = useState(false);
  const [newComponentName, setNewComponentName] = useState("");
  const [addingComponent, setAddingComponent] = useState(false);

  // Project Members
  const [members, setMembers] = useState<{ id: string; userId: string; role: string; user: { id: string; name?: string; email: string; image?: string } }[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("TESTER");
  const [addingMember, setAddingMember] = useState(false);

  // Workspace Members
  const [workspaceMembers, setWorkspaceMembers] = useState<{ id: string; role: string; joinedAt: string; user: { id: string; name?: string | null; email: string } }[]>([]);
  const [workspaceMembersLoading, setWorkspaceMembersLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  // Workspace Permissions
  const [permissionFeatures, setPermissionFeatures] = useState<any[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionChanges, setPermissionChanges] = useState<Record<string, Record<string, boolean>>>({});
  const [permissionHasChanges, setPermissionHasChanges] = useState(false);
  const [permissionSaving, setPermissionSaving] = useState(false);

  // Workspace General
  const [wsName, setWsName] = useState("");
  const [savingWs, setSavingWs] = useState(false);
  const [wsMsg, setWsMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [wsLogoFile, setWsLogoFile] = useState<File | null>(null);
  const [wsLogoPreview, setWsLogoPreview] = useState<string | null>(null);
  const [wsLogoDisplay, setWsLogoDisplay] = useState<"LOGO_ONLY" | "NAME_ONLY" | "LOGO_AND_NAME">("NAME_ONLY");
  const [wsLogoError, setWsLogoError] = useState("");
  const wsLogoInputRef = useRef<HTMLInputElement>(null);

  // Workspace Roles
  const [roles, setRoles] = useState<any[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  useEffect(() => {
    fetch("/api/keys")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setApiKeys(data); setKeysLoading(false); })
      .catch(() => setKeysLoading(false));
  }, []);

  useEffect(() => {
    if (!tenantId || section !== "workspace-permissions") {
      return;
    }
    setPermissionsLoading(true);
    fetch(`/api/tenants/${tenantId}/settings/permissions`)
      .then((r) => r.json())
      .then((data) => {
        setPermissionFeatures(data.featureFlags || []);
        setPermissionsLoading(false);
      })
      .catch((err) => {
        console.error("Fetch permissions failed:", err);
        setPermissionsLoading(false);
      });
  }, [tenantId, section]);

  useEffect(() => {
    if (!tenantId || section !== "workspace-roles") {
      return;
    }
    setRolesLoading(true);
    fetch(`/api/tenants/${tenantId}/roles`)
      .then((r) => r.json())
      .then((data) => {
        setRoles(data.roles || []);
        setRolesLoading(false);
      })
      .catch((err) => {
        console.error("Fetch roles failed:", err);
        setRolesLoading(false);
      });
  }, [tenantId, section]);

  useEffect(() => {
    if (!selectedProjectId) return;
    fetch(`/api/projects/${selectedProjectId}/settings/jira`)
      .then(r => r.json())
      .then(data => {
        setJiraBaseUrl(data.jiraBaseUrl || "");
        setJiraProjectKey(data.jiraProjectKey || "");
        setJiraUserEmail(data.jiraUserEmail || "");
        if (data.hasToken) setJiraApiToken("••••••••");
      }).catch((err) => { console.error("Fetch failed:", err); });
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || section !== "environments") return;
    setEnvsLoading(true);
    fetch(`/api/projects/${selectedProjectId}/settings/environments`)
      .then(async r => {
        if (!r.ok) throw new Error("Failed to fetch environments");
        return r.json();
      })
      .then(d => { if (Array.isArray(d)) setEnvs(d); setEnvsLoading(false); })
      .catch(() => setEnvsLoading(false));
  }, [selectedProjectId, section]);

  useEffect(() => {
    if (!selectedProjectId || section !== "builds") return;
    setBuildsLoading(true);
    fetch(`/api/projects/${selectedProjectId}/settings/builds`)
      .then(async r => {
        if (!r.ok) throw new Error("Failed to fetch builds");
        return r.json();
      })
      .then(d => { if (Array.isArray(d)) setBuilds(d); setBuildsLoading(false); })
      .catch(() => setBuildsLoading(false));
  }, [selectedProjectId, section]);

  useEffect(() => {
    if (!selectedProjectId || section !== "labels") return;
    setLabelsLoading(true);
    fetch(`/api/projects/${selectedProjectId}/settings/labels`)
      .then(async r => {
        if (!r.ok) throw new Error("Failed to fetch labels");
        return r.json();
      })
      .then(d => { if (Array.isArray(d)) setLabels(d); setLabelsLoading(false); })
      .catch(() => setLabelsLoading(false));
  }, [selectedProjectId, section]);

  useEffect(() => {
    if (!selectedProjectId || section !== "priorities") return;
    setPrioritiesLoading(true);
    fetch(`/api/projects/${selectedProjectId}/settings/priorities`)
      .then(async r => {
        if (!r.ok) throw new Error("Failed to fetch priorities");
        return r.json();
      })
      .then(d => { if (Array.isArray(d)) setPriorities(d); setPrioritiesLoading(false); })
      .catch(() => setPrioritiesLoading(false));
  }, [selectedProjectId, section]);

  useEffect(() => {
    if (!selectedProjectId || section !== "components") return;
    setComponentsLoading(true);
    fetch(`/api/projects/${selectedProjectId}/settings/components`)
      .then(async r => {
        if (!r.ok) throw new Error("Failed to fetch components");
        return r.json();
      })
      .then(d => { if (Array.isArray(d)) setComponents(d); setComponentsLoading(false); })
      .catch(() => setComponentsLoading(false));
  }, [selectedProjectId, section]);

  useEffect(() => {
    if (!selectedProjectId || section !== "members") return;
    setMembersLoading(true);
    fetch(`/api/projects/${selectedProjectId}/members`)
      .then(async r => {
        if (!r.ok) throw new Error("Failed to fetch members");
        return r.json();
      })
      .then(d => { if (Array.isArray(d)) setMembers(d); setMembersLoading(false); })
      .catch(() => setMembersLoading(false));
  }, [selectedProjectId, section]);

  useEffect(() => {
    if (!tenantId || section !== "workspace-members") return;
    setWorkspaceMembersLoading(true);
    fetch(`/api/tenants/${tenantId}/members`)
      .then(async r => {
        if (!r.ok) throw new Error("Failed to fetch workspace members");
        return r.json();
      })
      .then(d => { if (Array.isArray(d)) setWorkspaceMembers(d); setWorkspaceMembersLoading(false); })
      .catch(() => setWorkspaceMembersLoading(false));
  }, [tenantId, section]);

  useEffect(() => {
    if (tenantName) setWsName(tenantName);
  }, [tenantName]);

  useEffect(() => {
    if (tenantLogoDisplay) setWsLogoDisplay(tenantLogoDisplay as "LOGO_ONLY" | "NAME_ONLY" | "LOGO_AND_NAME");
  }, [tenantLogoDisplay]);

  function handleWsLogoSelect(file: File | null) {
    setWsLogoError("");
    if (!file) { setWsLogoFile(null); setWsLogoPreview(null); return; }
    if (!file.type.startsWith("image/")) { setWsLogoError("Only image files are allowed."); return; }
    if (file.size > 200 * 1024) { setWsLogoError("Logo must be 200 KB or smaller."); return; }
    setWsLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setWsLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function removeLogo() {
    if (!tenantId) return;
    const res = await fetch(`/api/tenants/${tenantId}/logo`, { method: "DELETE" });
    if (res.ok) {
      setWsLogoFile(null);
      setWsLogoPreview(null);
      // Broadcast instantly so sidebar clears the logo without waiting for JWT
      broadcastTenantDisplay({
        tenantName: tenantName,
        tenantLogoUrl: null,
        tenantLogoDisplay: wsLogoDisplay,
      });
      refreshTenant(); // background JWT refresh
      setWsMsg({ type: "success", text: "Logo removed." });
    } else {
      setWsMsg({ type: "error", text: "Failed to remove logo." });
    }
    setTimeout(() => setWsMsg(null), 3000);
  }

  async function saveWsSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId || !wsName.trim()) return;
    setSavingWs(true);

    // Upload logo first (if a new file is pending)
    let newLogoUrl = tenantLogoUrl;
    if (wsLogoFile) {
      const fd = new FormData();
      fd.append("file", wsLogoFile);
      const logoRes = await fetch(`/api/tenants/${tenantId}/logo`, { method: "PATCH", body: fd });
      if (!logoRes.ok) {
        const d = await logoRes.json().catch(() => ({}));
        setWsLogoError(d.error ?? "Failed to upload logo.");
        setSavingWs(false);
        return;
      }
      const logoData = await logoRes.json().catch(() => ({}));
      newLogoUrl = logoData.logoUrl ?? newLogoUrl;
      setWsLogoFile(null);
    }

    const res = await fetch(`/api/tenants/${tenantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: wsName, logoDisplay: wsLogoDisplay }),
    });

    if (res.ok) {
      // Broadcast new display values immediately — sidebar updates before JWT round-trip
      broadcastTenantDisplay({
        tenantName: wsName,
        tenantLogoUrl: newLogoUrl,
        tenantLogoDisplay: wsLogoDisplay,
      });
      // Clear local preview — broadcast now holds the canonical logoUrl
      setWsLogoPreview(null);
      setSavingWs(false);
      setWsMsg({ type: "success", text: "Workspace settings updated." });
      // Refresh JWT in background so next session load has the right values
      refreshTenant();
    } else {
      const d = await res.json().catch(() => ({}));
      setSavingWs(false);
      setWsMsg({ type: "error", text: d.error ?? "Failed to update." });
    }
    setTimeout(() => setWsMsg(null), 3000);
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId || !inviteEmail.trim()) return;
    setInviting(true);
    setInviteUrl(null);
    const res = await fetch(`/api/tenants/${tenantId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    setInviting(false);
    if (res.ok) {
      const d = await res.json();
      setInviteUrl(d.inviteUrl);
      setInviteEmail("");
    } else {
      const d = await res.json().catch(() => ({}));
      setWsMsg({ type: "error", text: d.error ?? "Failed to send invite." });
      setTimeout(() => setWsMsg(null), 3000);
    }
  }

  async function removeMember(userId: string) {
    if (!tenantId) return;
    if (!confirm("Remove this member from the workspace?")) return;
    await fetch(`/api/tenants/${tenantId}/members/${userId}`, { method: "DELETE" });
    setWorkspaceMembers(prev => prev.filter(m => m.user.id !== userId));
  }

  async function saveJira(e: React.FormEvent) {
    e.preventDefault();
    setSavingJira(true);
    try {
      await fetch(`/api/projects/${selectedProjectId}/settings/jira`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jiraProjectKey, jiraBaseUrl, jiraUserEmail, jiraApiToken }),
      });
      setJiraSuccess(true);
      setTimeout(() => setJiraSuccess(false), 3000);
    } finally {
      setSavingJira(false);
    }
  }

  async function generateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setGeneratingKey(true);
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newKeyName,
        projectId: newKeyProject && newKeyProject !== "none" ? newKeyProject : undefined,
      }),
    });
    setGeneratingKey(false);
    if (res.ok) {
      const data = await res.json();
      setRevealedKey(data.key);
      setShowKey(true);
      setNewKeyName("");
      fetch("/api/keys").then((r) => r.json()).then((data) => { if (Array.isArray(data)) setApiKeys(data); });
    }
  }

  async function revokeKey(id: string) {
    if (!confirm("Revoke this API key? Any automation using it will stop working.")) return;
    await fetch(`/api/keys/${id}`, { method: "DELETE" });
    setApiKeys((prev) => prev.filter((k) => k.id !== id));
  }

  function copyKey() {
    if (revealedKey) {
      navigator.clipboard.writeText(revealedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function copyProjectId(projectId: string) {
    navigator.clipboard.writeText(projectId);
    setCopiedProjectId(projectId);
    setTimeout(() => setCopiedProjectId(null), 2000);
  }

  const projectSections: SettingsSection[] = ["environments", "builds", "labels", "priorities", "components", "members"];


  function PermissionsRedirect() {
    useEffect(() => {
      window.location.href = "/settings/workspace/permissions";
    }, []);
    return <div className="text-center py-12"><p className="text-gray-500">Redirecting to permissions...</p></div>;
  }

  function NavItem({
    id,
    icon: Icon,
    label,
  }: {
    id: SettingsSection;
    icon: React.ElementType;
    label: string;
  }) {
    return (
      <button
        onClick={() => setSection(id)}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors text-left",
          section === id
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {label}
      </button>
    );
  }

  return (
    <div className="flex flex-1 min-h-0">
      {/* Left nav */}
      <nav style={{ width: navWidth }} className="shrink-0 border-r border-border overflow-y-auto bg-card/50 py-2">
        <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Workspace
        </p>
        <div className="px-2 space-y-0.5">
          <NavItem id="workspace-general" icon={Building2} label="General" />
          <NavItem id="workspace-members" icon={UserPlus} label="Members" />
          <NavItem id="workspace-permissions" icon={Shield} label="Permissions" />
          <NavItem id="workspace-roles" icon={Users} label="Roles" />
        </div>

        <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          General
        </p>
        <div className="px-2 space-y-0.5">
          <NavItem id="new-project" icon={FolderPlus} label="Create Project" />
          <NavItem id="api-keys" icon={Key} label="API Keys" />
        </div>

        <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Integrations
        </p>
        <div className="px-2 space-y-0.5">
          <NavItem id="jira" icon={LinkIcon} label="JIRA" />
        </div>

        {selectedProjectId && (
          <>
            <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Project Config
            </p>
            <div className="px-2 space-y-0.5">
              <NavItem id="environments" icon={Globe} label="Environments" />
              <NavItem id="builds" icon={Package} label="Builds" />
              <NavItem id="labels" icon={Tag} label="Labels" />
              <NavItem id="priorities" icon={Flag} label="Priorities" />
              <NavItem id="components" icon={Boxes} label="Components" />
              <NavItem id="members" icon={Users} label="Members" />
            </div>
          </>
        )}
      </nav>

      <PanelResizeHandle onMouseDown={onNavResize} />

      {/* Right content panel */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* If a project section is active but no project selected */}
        {projectSections.includes(section) && !selectedProjectId ? (
          <div className="flex flex-col items-center justify-center h-48 text-center gap-2">
            <p className="text-sm font-medium text-muted-foreground">Select a project to configure</p>
            <p className="text-xs text-muted-foreground">Choose a project from the sidebar to manage its settings.</p>
          </div>
        ) : (
          <>
            {/* ── Workspace General ── */}
            {section === "workspace-general" && (
              <div className="max-w-lg space-y-8">
                <div>
                  <h2 className="text-base font-semibold mb-1">Workspace settings</h2>
                  <p className="text-sm text-muted-foreground">Manage your workspace name and identity.</p>
                </div>
                {wsMsg && (
                  <div className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm border",
                    wsMsg.type === "success"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-destructive/10 text-destructive border-destructive/20"
                  )}>
                    {wsMsg.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                    {wsMsg.text}
                  </div>
                )}
                <form onSubmit={saveWsSettings} className="space-y-6" data-testid="settings-form-content">
                  <div className="space-y-1.5">
                    <Label htmlFor="ws-name">Workspace name <span className="text-muted-foreground font-normal text-xs">(max 50 characters)</span></Label>
                    <Input
                      id="ws-name"
                      value={wsName}
                      onChange={e => setWsName(e.target.value.slice(0, 50))}
                      required
                      maxLength={50}
                    />
                    <p className="text-xs text-muted-foreground">{wsName.length}/50</p>
                  </div>

                  {/* Logo upload */}
                  <div className="space-y-2">
                    <Label>Workspace logo <span className="text-muted-foreground font-normal text-xs">(optional, max 200 KB)</span></Label>
                    <input
                      ref={wsLogoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleWsLogoSelect(e.target.files?.[0] ?? null)}
                    />
                    {wsLogoPreview || tenantLogoUrl ? (
                      <div className="flex items-center gap-3">
                        <img
                          src={wsLogoPreview ?? tenantLogoUrl ?? ""}
                          alt="Logo"
                          className="h-14 w-14 rounded-lg object-cover border"
                        />
                        <div className="flex flex-col gap-1">
                          <Button type="button" variant="outline" size="sm" onClick={() => wsLogoInputRef.current?.click()}>
                            <Upload className="h-3.5 w-3.5 mr-1.5" /> Change
                          </Button>
                          <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={removeLogo}>
                            <X className="h-3.5 w-3.5 mr-1" /> Remove
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => wsLogoInputRef.current?.click()}
                        className="flex items-center gap-2 w-full rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 text-sm text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground transition-colors"
                      >
                        <Upload className="h-4 w-4 shrink-0" />
                        Click to upload logo (JPG, PNG, WebP, SVG)
                      </button>
                    )}
                    {wsLogoError && <p className="text-xs text-destructive">{wsLogoError}</p>}
                  </div>

                  {/* Display mode */}
                  <div className="space-y-2">
                    <Label>Sidebar display</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {(["NAME_ONLY", "LOGO_ONLY", "LOGO_AND_NAME"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setWsLogoDisplay(mode)}
                          className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                            wsLogoDisplay === mode
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-foreground/40"
                          }`}
                        >
                          {mode === "NAME_ONLY" ? "Name only" : mode === "LOGO_ONLY" ? "Logo only" : "Logo & name"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={savingWs || !["OWNER", "ADMIN"].includes(tenantRole ?? "") || !!wsLogoError}
                  >
                    {savingWs ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                    Save settings
                  </Button>
                </form>
              </div>
            )}

            {/* ── Workspace Members ── */}
            {section === "workspace-members" && (
              <div className="max-w-2xl space-y-6">
                <div>
                  <h2 className="text-base font-semibold mb-1">Workspace members</h2>
                  <p className="text-sm text-muted-foreground">Invite people to collaborate in this workspace.</p>
                </div>

                {wsMsg && (
                  <div className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm border",
                    wsMsg.type === "success"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-destructive/10 text-destructive border-destructive/20"
                  )}>
                    {wsMsg.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                    {wsMsg.text}
                  </div>
                )}

                {/* Invite form — only for OWNER/ADMIN */}
                {["OWNER", "ADMIN"].includes(tenantRole ?? "") && (
                  <form onSubmit={sendInvite} className="flex gap-2">
                    <Input
                      placeholder="colleague@company.com"
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      className="flex-1 h-8"
                      required
                    />
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger className="w-28 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="MEMBER">Member</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="submit" size="sm" disabled={inviting || !inviteEmail.trim()}>
                      {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4 mr-1" />}
                      Invite
                    </Button>
                  </form>
                )}

                {/* Invite URL result */}
                {inviteUrl && (
                  <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                    <p className="text-sm font-medium">Invite link generated — share it with your colleague:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs font-mono bg-background border rounded px-2 py-1.5 overflow-x-auto">
                        {inviteUrl}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { navigator.clipboard.writeText(inviteUrl); setInviteCopied(true); setTimeout(() => setInviteCopied(false), 2000); }}
                      >
                        {inviteCopied ? <Check className="h-4 w-4 mr-1 text-green-600" /> : <Copy className="h-4 w-4 mr-1" />}
                        {inviteCopied ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Link expires in 7 days and can only be used once.</p>
                  </div>
                )}

                {/* Member list */}
                <div className="rounded-md border overflow-hidden">
                  {workspaceMembersLoading ? (
                    <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
                    </div>
                  ) : workspaceMembers.length === 0 ? (
                    <div className="flex items-center justify-center h-16 text-muted-foreground text-sm">No members found</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 border-b">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Name</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Email</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Role</th>
                          <th className="px-4 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {workspaceMembers.map(m => (
                          <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2.5 font-medium">{m.user.name ?? "—"}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{m.user.email}</td>
                            <td className="px-4 py-2.5">
                              <span className={cn(
                                "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium",
                                m.role === "OWNER" ? "bg-amber-100 text-amber-700" :
                                m.role === "ADMIN" ? "bg-blue-100 text-blue-700" :
                                "bg-muted text-muted-foreground"
                              )}>
                                {m.role === "OWNER" && <Shield className="h-3 w-3" />}
                                {m.role}
                              </span>
                            </td>

            
                            <td className="px-4 py-2.5 text-right">
                              {m.role !== "OWNER" && ["OWNER", "ADMIN"].includes(tenantRole ?? "") && (
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeMember(m.user.id)}>
                                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ── Create Project ── */}
            {section === "new-project" && (
              <div className="max-w-lg">
                <h2 className="text-base font-semibold mb-1">Create Project</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Each project is an isolated workspace with its own test cases, cycles, and settings.
                </p>
                <form
                  className="space-y-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setCreatingProject(true);
                    setProjectMsg(null);
                    const fd = new FormData(e.currentTarget);
                    const res = await fetch("/api/projects", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        key: (fd.get("key") as string).toUpperCase(),
                        name: fd.get("name"),
                        description: fd.get("description"),
                      }),
                    });
                    setCreatingProject(false);
                    if (res.ok) {
                      const data = await res.json();
                      setProjectMsg({ type: "success", text: `Project "${data.name}" (${data.key}) created.` });
                      (e.target as HTMLFormElement).reset();
                      // Refresh project list in sidebar immediately
                      refreshProjects();
                    } else {
                      const errData = await res.json().catch(() => ({}));
                      setProjectMsg({ type: "error", text: errData.error || "Failed to create project." });
                    }
                  }}
                >
                  {projectMsg && (
                    <div className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm border",
                      projectMsg.type === "success"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-destructive/10 text-destructive border-destructive/20"
                    )}>
                      {projectMsg.type === "success"
                        ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                        : <AlertCircle className="h-4 w-4 shrink-0" />}
                      {projectMsg.text}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="key">Key</Label>
                      <Input id="key" name="key" placeholder="SHOP" className="uppercase" maxLength={10} required />
                      <p className="text-xs text-muted-foreground">Uppercase, e.g. SHOP</p>
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label htmlFor="name">Project Name</Label>
                      <Input id="name" name="name" placeholder="E-Commerce Shop" required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="description">Description</Label>
                    <Input id="description" name="description" placeholder="Optional description" />
                  </div>
                  <Button type="submit" size="sm" disabled={creatingProject}>
                    {creatingProject
                      ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      : <Plus className="h-4 w-4 mr-1.5" />}
                    Create Project
                  </Button>
                </form>
              </div>
            )}

            {/* ── Workspace Permissions ── */}
            {section === "workspace-permissions" && (
              <div className="max-w-4xl">
                <h2 className="text-base font-semibold mb-1">Workspace Permissions</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Configure default feature access for all workspace members
                </p>

                {permissionsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : permissionFeatures.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">No permissions configured.</div>
                ) : (
                  <div className="space-y-2">
                    {(() => {
                      // Deduplicate features by featureName
                      const seen = new Set<string>();
                      const uniqueFeatures = permissionFeatures.filter((feature: any) => {
                        if (seen.has(feature.featureName)) return false;
                        seen.add(feature.featureName);
                        return true;
                      });

                      const featureDescriptions: Record<string, string> = {
                        TEST_CASE_CREATE: "Create new test cases for your projects",
                        TEST_CASE_READ: "View and browse existing test cases",
                        TEST_CASE_UPDATE: "Edit and modify test case details",
                        TEST_CASE_DELETE: "Permanently remove test cases",
                        TEST_CASE_CLONE: "Duplicate test cases to reuse configurations",
                        TEST_CASE_IMPORT: "Import test cases from external sources",
                        TEST_CASE_EXPORT: "Export test cases for backup or sharing",
                        TEST_CASE_ARCHIVE: "Archive test cases for historical records",
                        TEST_CYCLE_CREATE: "Create new test execution cycles",
                        TEST_CYCLE_READ: "View test cycle details and progress",
                        TEST_CYCLE_UPDATE: "Modify test cycle settings and schedules",
                        TEST_CYCLE_DELETE: "Remove test cycles",
                        TEST_CYCLE_EXECUTE: "Run tests and record results",
                        TEST_CYCLE_CLONE: "Duplicate test cycles with all configurations",
                        TEST_CYCLE_ARCHIVE: "Archive completed test cycles",
                        TEST_PLAN_CREATE: "Create new test plans",
                        TEST_PLAN_READ: "View test plan details and coverage",
                        TEST_PLAN_UPDATE: "Edit test plan configurations",
                        TEST_PLAN_DELETE: "Remove test plans",
                        TEST_PLAN_ARCHIVE: "Archive test plans for reference",
                        PROJECT_SETTINGS_MANAGE: "Manage project configuration and settings",
                        PROJECT_MEMBERS_MANAGE: "Invite and manage project team members",
                        PROJECT_AUTOMATION_SUBMIT: "Submit automated test results",
                        PROJECT_REPORTS_VIEW: "Access test reports and analytics",
                        PROJECT_COMMENTS_CREATE: "Add comments to test cases and cycles",
                        PROJECT_FILTERS_MANAGE: "Create and manage custom filters",
                        JIRA_INTEGRATION: "Connect and sync with JIRA projects",
                      };

                      return uniqueFeatures.map((feature: any) => (
                      <div key={feature.id} className="flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:bg-muted/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground capitalize">{feature.featureName.replace(/_/g, " ")}</p>
                          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{featureDescriptions[feature.featureName] || feature.description}</p>
                        </div>
                        <div className="flex items-center gap-8 ml-4">
                          {["OWNER", "ADMIN", "MEMBER"].map((role) => {
                            const permission = feature.rolePermissions.find((rp: any) => rp.roleName === role);
                            const isEnabled = permission?.isEnabled ?? true;
                            const currentValue = permissionChanges[feature.featureName]?.[role];
                            const displayValue = currentValue !== undefined ? currentValue : isEnabled;

                            const roleDescriptions: Record<string, string> = {
                              OWNER: "Full access to all features",
                              ADMIN: "Administrative access",
                              MEMBER: "Standard member access",
                            };

                            return (
                              <div key={role} className="flex flex-col items-center gap-2 min-w-max">
                                <input
                                  type="checkbox"
                                  checked={displayValue}
                                  onChange={(e) => {
                                    setPermissionChanges((prev) => ({
                                      ...prev,
                                      [feature.featureName]: {
                                        ...(prev[feature.featureName] || {}),
                                        [role]: e.target.checked,
                                      },
                                    }));
                                    setPermissionHasChanges(true);
                                  }}
                                  className="w-5 h-5 rounded border-border text-primary cursor-pointer"
                                />
                                <div className="text-center">
                                  <p className="text-xs font-medium text-foreground">{role}</p>
                                  <p className="text-[10px] text-muted-foreground">{roleDescriptions[role]}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      ));
                    })()}
                  </div>
                )}

                {permissionHasChanges && (
                  <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-border">
                    <Button variant="outline" onClick={() => {
                      setPermissionChanges({});
                      setPermissionHasChanges(false);
                    }} disabled={permissionSaving}>
                      Cancel
                    </Button>
                    <Button onClick={async () => {
                      setPermissionSaving(true);
                      try {
                        const permissions = Object.entries(permissionChanges).map(([featureName, roles]) =>
                          Object.entries(roles).map(([roleName, isEnabled]) => ({
                            featureName,
                            roleName,
                            isEnabled,
                          }))
                        ).flat();

                        const response = await fetch(`/api/tenants/${tenantId}/settings/permissions`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ permissions }),
                        });

                        if (!response.ok) throw new Error("Failed to save");
                        setPermissionChanges({});
                        setPermissionHasChanges(false);
                        console.log("Permissions saved");
                      } catch (error) {
                        console.error("Error saving permissions:", error);
                      } finally {
                        setPermissionSaving(false);
                      }
                    }} disabled={permissionSaving}>
                      {permissionSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      {permissionSaving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* ── Workspace Roles ── */}
            {section === "workspace-roles" && (
              <div className="max-w-4xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-semibold mb-1">Custom Roles</h2>
                    <p className="text-sm text-muted-foreground">
                      Create and manage custom roles for your workspace members
                    </p>
                  </div>
                  {tenantRole === "OWNER" || tenantRole === "ADMIN" ? (
                    <CreateRoleDialog tenantId={tenantId} onRoleCreated={() => {
                      setRolesLoading(true);
                      fetch(`/api/tenants/${tenantId}/roles`)
                        .then((r) => r.json())
                        .then((data) => { setRoles(data.roles || []); setRolesLoading(false); })
                        .catch(() => setRolesLoading(false));
                    }} />
                  ) : null}
                </div>

                {rolesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : roles.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    No custom roles yet. Create one to assign permissions to your team members.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {roles.map((role: any) => (
                      <div key={role.id} className="flex items-center justify-between p-4 bg-card border border-border rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground">{role.name}</p>
                          {role.description && (
                            <p className="text-xs text-muted-foreground mt-1">{role.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/settings?section=workspace-roles&edit=${role.id}`}>
                              Manage Permissions
                            </Link>
                          </Button>
                          {tenantRole === "OWNER" || tenantRole === "ADMIN" ? (
                            <>
                              <EditRoleDialog
                                roleId={role.id}
                                tenantId={tenantId}
                                initialName={role.name}
                                initialDescription={role.description}
                                onRoleUpdated={() => {
                                  setRolesLoading(true);
                                  fetch(`/api/tenants/${tenantId}/roles`)
                                    .then((r) => r.json())
                                    .then((data) => { setRoles(data.roles || []); setRolesLoading(false); })
                                    .catch(() => setRolesLoading(false));
                                }}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  if (confirm(`Delete role "${role.name}"? This will remove the role from all members.`)) {
                                    try {
                                      const res = await fetch(`/api/tenants/${tenantId}/roles/${role.id}`, {
                                        method: "DELETE",
                                      });
                                      if (res.ok) {
                                        setRoles(roles.filter((r: any) => r.id !== role.id));
                                      }
                                    } catch (err) {
                                      console.error("Failed to delete role:", err);
                                    }
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── API Keys ── */}
            {section === "api-keys" && (
              <div className="max-w-xl">
                <h2 className="text-base font-semibold mb-1">API Keys</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Use API keys to submit test results from CI/CD pipelines and automation frameworks.
                </p>

                {revealedKey && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-4 space-y-2 mb-4">
                    <p className="text-sm font-medium text-amber-800">Save this key — it will only be shown once.</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded bg-white border px-3 py-2 text-sm font-mono overflow-auto">
                        {showKey ? revealedKey : revealedKey.slice(0, 12) + "•".repeat(20)}
                      </code>
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setShowKey((v) => !v)}>
                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="outline" onClick={copyKey}>
                        {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                        {copied ? "Copied" : "Copy"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRevealedKey(null)}>Dismiss</Button>
                    </div>
                  </div>
                )}

                <form onSubmit={generateKey} className="flex gap-2 mb-4">
                  <Input
                    placeholder="Key name (e.g. CI/CD Pipeline)"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="flex-1 h-8"
                    required
                  />
                  <Select value={newKeyProject} onValueChange={setNewKeyProject}>
                    <SelectTrigger className="w-40 h-8">
                      <SelectValue placeholder="All projects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">All projects</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="submit" size="sm" disabled={generatingKey || !newKeyName.trim()}>
                    {generatingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                    Generate
                  </Button>
                </form>

                {keysLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : apiKeys.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No API keys yet.</p>
                ) : (
                  <div className="space-y-1">
                    {apiKeys.map((k) => (
                      <div key={k.id} className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-muted/30 group">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{k.name}</span>
                            {k.project && (
                              <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                {k.project.key}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
                            <code>{k.prefix}•••••</code>
                            {" · "}Created {new Date(k.createdAt).toLocaleDateString()}
                            {k.lastUsedAt && ` · Last used ${new Date(k.lastUsedAt).toLocaleDateString()}`}
                            {k.projectId && (
                              <>
                                {" · "}
                                <span className="inline-flex items-center gap-0.5">
                                  Project ID: <code className="text-xs">{k.projectId}</code>
                                  <button
                                    onClick={() => copyProjectId(k.projectId!)}
                                    title="Copy Project ID"
                                    className="inline-flex items-center justify-center w-5 h-5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted/50 transition-opacity"
                                  >
                                    {copiedProjectId === k.projectId ? (
                                      <Check className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </button>
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
                          onClick={() => revokeKey(k.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── JIRA ── */}
            {section === "jira" && (
              <div className="max-w-lg">
                <h2 className="text-base font-semibold mb-1">JIRA Integration</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Connect to JIRA to link defects, search requirements, and sync issue status.
                </p>
                <form onSubmit={saveJira} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="jiraUrl">JIRA Base URL</Label>
                    <Input
                      id="jiraUrl"
                      placeholder="https://yourorg.atlassian.net"
                      value={jiraBaseUrl}
                      onChange={(e) => setJiraBaseUrl(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="jiraEmail">JIRA Email</Label>
                      <Input
                        id="jiraEmail"
                        type="email"
                        placeholder="you@company.com"
                        value={jiraUserEmail}
                        onChange={(e) => setJiraUserEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="jiraProjectKey">JIRA Project Key</Label>
                      <Input
                        id="jiraProjectKey"
                        placeholder="SHOP"
                        value={jiraProjectKey}
                        onChange={(e) => setJiraProjectKey(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="jiraToken">JIRA API Token</Label>
                    <Input
                      id="jiraToken"
                      type="password"
                      placeholder="Your JIRA API token"
                      value={jiraApiToken}
                      onChange={(e) => setJiraApiToken(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Generate at id.atlassian.com/manage-profile/security/api-tokens
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button type="submit" size="sm" disabled={savingJira || !selectedProjectId}>
                      {savingJira
                        ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                        : jiraSuccess
                          ? <Check className="h-4 w-4 mr-1.5" />
                          : null}
                      {jiraSuccess ? "Saved!" : "Save JIRA Config"}
                    </Button>
                    {!selectedProjectId && (
                      <p className="text-xs text-muted-foreground">Select a project to save JIRA config.</p>
                    )}
                  </div>
                </form>
              </div>
            )}

            {/* ── Environments ── */}
            {section === "environments" && selectedProjectId && (
              <div className="max-w-xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-semibold">Environments</h2>
                    <p className="text-sm text-muted-foreground">Configure test environments for {selectedProject?.name}.</p>
                  </div>
                </div>

                <form onSubmit={async e => {
                  e.preventDefault();
                  if (!newEnvName.trim() || !selectedProjectId) return;
                  setAddingEnv(true);
                  const res = await fetch(`/api/projects/${selectedProjectId}/settings/environments`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: newEnvName.trim() })
                  });
                  const data = await res.json();
                  setAddingEnv(false);
                  if (res.ok) { setEnvs(prev => [...prev, data]); setNewEnvName(""); }
                }} className="flex gap-2 mb-4">
                  <Input placeholder="New environment name" value={newEnvName} onChange={e => setNewEnvName(e.target.value)} className="flex-1 h-8" required />
                  <Button type="submit" size="sm" disabled={addingEnv || !newEnvName.trim()}>
                    {addingEnv ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                    Add
                  </Button>
                </form>

                {envsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                ) : envs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No environments yet.</p>
                ) : (
                  <div className="space-y-1">
                    {envs.map(env => (
                      <div key={env.id} className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-muted/30 group">
                        <div className="flex-1">
                          <EditableSettingRow
                            id={env.id}
                            label="Environment"
                            value={env.name}
                            onSave={async (newValue) => {
                              const res = await fetch(`/api/projects/${selectedProjectId}/settings/environments/${env.id}`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ name: newValue })
                              });
                              if (res.ok) {
                                setEnvs(prev => prev.map(e => e.id === env.id ? { ...e, name: newValue } : e));
                              }
                            }}
                            placeholder="e.g. Production"
                          />
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
                          onClick={async () => {
                            if (!confirm("Delete this environment?")) return;
                            const res = await fetch(`/api/projects/${selectedProjectId}/settings/environments/${env.id}`, { method: "DELETE" });
                            if (res.ok) setEnvs(prev => prev.filter(e => e.id !== env.id));
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Builds ── */}
            {section === "builds" && selectedProjectId && (
              <div className="max-w-xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-semibold">Builds</h2>
                    <p className="text-sm text-muted-foreground">Manage build versions for {selectedProject?.name}.</p>
                  </div>
                </div>

                <form onSubmit={async e => {
                  e.preventDefault();
                  if (!newBuildName.trim() || !selectedProjectId) return;
                  setAddingBuild(true);
                  const res = await fetch(`/api/projects/${selectedProjectId}/settings/builds`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: newBuildName.trim() })
                  });
                  const data = await res.json();
                  setAddingBuild(false);
                  if (res.ok) { setBuilds(prev => [...prev, data]); setNewBuildName(""); }
                }} className="flex gap-2 mb-4">
                  <Input placeholder="New build name" value={newBuildName} onChange={e => setNewBuildName(e.target.value)} className="flex-1 h-8" required />
                  <Button type="submit" size="sm" disabled={addingBuild || !newBuildName.trim()}>
                    {addingBuild ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                    Add
                  </Button>
                </form>

                {buildsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                ) : builds.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No builds yet.</p>
                ) : (
                  <div className="space-y-1">
                    {builds.map(build => (
                      <div key={build.id} className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-muted/30 group">
                        <div className="flex-1">
                          <EditableSettingRow
                            id={build.id}
                            label="Build"
                            value={build.name}
                            onSave={async (newValue) => {
                              const res = await fetch(`/api/projects/${selectedProjectId}/settings/builds/${build.id}`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ name: newValue })
                              });
                              if (res.ok) {
                                setBuilds(prev => prev.map(b => b.id === build.id ? { ...b, name: newValue } : b));
                              }
                            }}
                            placeholder="e.g. v2.1.0"
                          />
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
                          onClick={async () => {
                            if (!confirm("Delete this build?")) return;
                            const res = await fetch(`/api/projects/${selectedProjectId}/settings/builds/${build.id}`, { method: "DELETE" });
                            if (res.ok) setBuilds(prev => prev.filter(b => b.id !== build.id));
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Labels ── */}
            {section === "labels" && selectedProjectId && (
              <div className="max-w-xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-semibold">Labels</h2>
                    <p className="text-sm text-muted-foreground">Classify test cases with colored labels for {selectedProject?.name}.</p>
                  </div>
                </div>

                <form onSubmit={async e => {
                  e.preventDefault();
                  if (!newLabelName.trim() || !selectedProjectId) return;
                  setAddingLabel(true);
                  const res = await fetch(`/api/projects/${selectedProjectId}/settings/labels`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: newLabelName.trim(), color: newLabelColor })
                  });
                  const data = await res.json();
                  setAddingLabel(false);
                  if (res.ok) { setLabels(prev => [...prev, data]); setNewLabelName(""); }
                }} className="flex gap-2 mb-4 items-center">
                  <input type="color" value={newLabelColor} onChange={e => setNewLabelColor(e.target.value)} className="h-8 w-9 rounded cursor-pointer border shrink-0" />
                  <Input placeholder="New label name" value={newLabelName} onChange={e => setNewLabelName(e.target.value)} className="flex-1 h-8" required />
                  <Button type="submit" size="sm" disabled={addingLabel || !newLabelName.trim()}>
                    {addingLabel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                    Add
                  </Button>
                </form>

                {labelsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                ) : labels.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No labels yet.</p>
                ) : (
                  <div className="space-y-1">
                    {labels.map(label => (
                      <div key={label.id} className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-muted/30 group">
                        <label className="cursor-pointer shrink-0 relative" title="Change color">
                          <span className="h-5 w-5 rounded-full block border" style={{ backgroundColor: label.color }} />
                          <input
                            type="color"
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                            value={label.color}
                            onChange={async (e) => {
                              const newColor = e.target.value;
                              setLabels(prev => prev.map(l => l.id === label.id ? { ...l, color: newColor } : l));
                              await fetch(`/api/projects/${selectedProjectId}/settings/labels/${label.id}`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ name: label.name, color: newColor })
                              });
                            }}
                          />
                        </label>
                        <div className="flex-1">
                          <EditableSettingRow
                            id={label.id}
                            label="Label"
                            value={label.name}
                            onSave={async (newValue) => {
                              const res = await fetch(`/api/projects/${selectedProjectId}/settings/labels/${label.id}`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ name: newValue, color: label.color })
                              });
                              if (res.ok) {
                                setLabels(prev => prev.map(l => l.id === label.id ? { ...l, name: newValue } : l));
                              }
                            }}
                            placeholder="e.g. Regression"
                          />
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
                          onClick={async () => {
                            if (!confirm("Delete this label?")) return;
                            const res = await fetch(`/api/projects/${selectedProjectId}/settings/labels/${label.id}`, { method: "DELETE" });
                            if (res.ok) setLabels(prev => prev.filter(l => l.id !== label.id));
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Priorities ── */}
            {section === "priorities" && selectedProjectId && (
              <div className="max-w-xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-semibold">Priorities</h2>
                    <p className="text-sm text-muted-foreground">Define priority levels for test cases in {selectedProject?.name}.</p>
                  </div>
                </div>

                <form onSubmit={async e => {
                  e.preventDefault();
                  if (!newPriorityName.trim() || !selectedProjectId) return;
                  setAddingPriority(true);
                  const res = await fetch(`/api/projects/${selectedProjectId}/settings/priorities`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: newPriorityName.trim(), level: parseInt(newPriorityLevel, 10), color: newPriorityColor })
                  });
                  const data = await res.json();
                  setAddingPriority(false);
                  if (res.ok) { setPriorities(prev => [...prev, data].sort((a, b) => a.level - b.level)); setNewPriorityName(""); }
                }} className="flex gap-2 mb-4 items-center">
                  <input type="color" value={newPriorityColor} onChange={e => setNewPriorityColor(e.target.value)} className="h-8 w-9 rounded cursor-pointer border shrink-0" />
                  <Input placeholder="New priority name" value={newPriorityName} onChange={e => setNewPriorityName(e.target.value)} className="flex-1 h-8" required />
                  <Input type="number" min="1" max="10" value={newPriorityLevel} onChange={e => setNewPriorityLevel(e.target.value)} className="w-16 h-8" placeholder="Level" />
                  <Button type="submit" size="sm" disabled={addingPriority || !newPriorityName.trim()}>
                    {addingPriority ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                    Add
                  </Button>
                </form>

                {prioritiesLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                ) : priorities.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No priorities yet.</p>
                ) : (
                  <div className="space-y-1">
                    {priorities.map(priority => (
                      <div key={priority.id} className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-muted/30 group">
                        <label className="cursor-pointer shrink-0 relative" title="Change color">
                          <span className="h-5 w-5 rounded-full block border" style={{ backgroundColor: priority.color }} />
                          <input
                            type="color"
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                            value={priority.color}
                            onChange={async (e) => {
                              const newColor = e.target.value;
                              setPriorities(prev => prev.map(p => p.id === priority.id ? { ...p, color: newColor } : p));
                              await fetch(`/api/projects/${selectedProjectId}/settings/priorities/${priority.id}`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ name: priority.name, level: priority.level, color: newColor })
                              });
                            }}
                          />
                        </label>
                        <div className="flex-1">
                          <EditableSettingRow
                            id={priority.id}
                            label="Priority"
                            value={priority.name}
                            onSave={async (newValue) => {
                              const res = await fetch(`/api/projects/${selectedProjectId}/settings/priorities/${priority.id}`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ name: newValue, level: priority.level, color: priority.color })
                              });
                              if (res.ok) {
                                setPriorities(prev => prev.map(p => p.id === priority.id ? { ...p, name: newValue } : p));
                              }
                            }}
                            placeholder="e.g. Critical"
                          />
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 opacity-0 group-hover:opacity-100">
                          Level {priority.level}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
                          onClick={async () => {
                            if (!confirm("Delete this priority?")) return;
                            const res = await fetch(`/api/projects/${selectedProjectId}/settings/priorities/${priority.id}`, { method: "DELETE" });
                            if (res.ok) setPriorities(prev => prev.filter(p => p.id !== priority.id));
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Components ── */}
            {section === "components" && selectedProjectId && (
              <div className="max-w-xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-semibold">Components</h2>
                    <p className="text-sm text-muted-foreground">Group test cases by component for {selectedProject?.name}.</p>
                  </div>
                </div>

                <form onSubmit={async e => {
                  e.preventDefault();
                  if (!newComponentName.trim() || !selectedProjectId) return;
                  setAddingComponent(true);
                  const res = await fetch(`/api/projects/${selectedProjectId}/settings/components`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: newComponentName.trim() })
                  });
                  const data = await res.json();
                  setAddingComponent(false);
                  if (res.ok) { setComponents(prev => [...prev, data]); setNewComponentName(""); }
                }} className="flex gap-2 mb-4">
                  <Input placeholder="New component name" value={newComponentName} onChange={e => setNewComponentName(e.target.value)} className="flex-1 h-8" required />
                  <Button type="submit" size="sm" disabled={addingComponent || !newComponentName.trim()}>
                    {addingComponent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                    Add
                  </Button>
                </form>

                {componentsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                ) : components.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No components yet.</p>
                ) : (
                  <div className="space-y-1">
                    {components.map(component => (
                      <div key={component.id} className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-muted/30 group">
                        <div className="flex-1">
                          <EditableSettingRow
                            id={component.id}
                            label="Component"
                            value={component.name}
                            onSave={async (newValue) => {
                              const res = await fetch(`/api/projects/${selectedProjectId}/settings/components/${component.id}`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ name: newValue })
                              });
                              if (res.ok) {
                                setComponents(prev => prev.map(c => c.id === component.id ? { ...c, name: newValue } : c));
                              }
                            }}
                            placeholder="e.g. Authentication"
                          />
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
                          onClick={async () => {
                            if (!confirm("Delete this component?")) return;
                            const res = await fetch(`/api/projects/${selectedProjectId}/settings/components/${component.id}`, { method: "DELETE" });
                            if (res.ok) setComponents(prev => prev.filter(c => c.id !== component.id));
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Members ── */}
            {section === "members" && selectedProjectId && (
              <div className="max-w-xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-semibold">Members</h2>
                    <p className="text-sm text-muted-foreground">Manage who has access to {selectedProject?.name}.</p>
                  </div>
                </div>

                <form onSubmit={async e => {
                  e.preventDefault();
                  if (!newMemberEmail.trim() || !selectedProjectId) return;
                  setAddingMember(true);
                  const res = await fetch(`/api/projects/${selectedProjectId}/members`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: newMemberEmail.trim(), role: newMemberRole })
                  });
                  const data = await res.json();
                  setAddingMember(false);
                  if (res.ok) { setMembers(prev => [...prev, data]); setNewMemberEmail(""); }
                }} className="flex gap-2 mb-4">
                  <Input type="email" placeholder="Email address" value={newMemberEmail} onChange={e => setNewMemberEmail(e.target.value)} className="flex-1 h-8" required />
                  <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                    <SelectTrigger className="w-28 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OWNER">Owner</SelectItem>
                      <SelectItem value="LEAD">Lead</SelectItem>
                      <SelectItem value="TESTER">Tester</SelectItem>
                      <SelectItem value="VIEWER">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit" size="sm" disabled={addingMember || !newMemberEmail.trim()}>
                    {addingMember ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                    Invite
                  </Button>
                </form>

                {membersLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                ) : members.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No members yet.</p>
                ) : (
                  <div className="space-y-1">
                    {members.map(member => (
                      <div key={member.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-muted/30 group">
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
                          {(member.user.name ?? member.user.email).slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          {member.user.name && <p className="text-sm font-medium truncate">{member.user.name}</p>}
                          <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs shrink-0">{member.role}</Badge>
                        {member.role !== "OWNER" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
                            onClick={async () => {
                              if (!confirm("Remove this member?")) return;
                              await fetch(`/api/projects/${selectedProjectId}/members/${member.userId}`, { method: "DELETE" });
                              setMembers(prev => prev.filter(m => m.id !== member.id));
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
