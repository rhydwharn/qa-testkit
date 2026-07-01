"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Check, AlertCircle } from "lucide-react";

interface RolePermissionsEditorProps {
  roleId: string;
  tenantId: string | null;
}

interface Permission {
  featureName: string;
  featureDescription?: string;
  isEnabled: boolean;
}

export function RolePermissionsEditor({ roleId, tenantId }: RolePermissionsEditorProps) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [changes, setChanges] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!tenantId || !roleId) return;

    const fetchPermissions = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/tenants/${tenantId}/roles/${roleId}/permissions`);
        if (!res.ok) throw new Error("Failed to fetch permissions");

        const data = await res.json();
        setPermissions(data.permissions || []);
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load permissions");
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [roleId, tenantId]);

  const handleToggle = (featureName: string) => {
    const current = permissions.find((p) => p.featureName === featureName)?.isEnabled ?? false;
    setChanges((prev) => ({
      ...prev,
      [featureName]: !current,
    }));
  };

  const handleSave = async () => {
    if (!tenantId || !roleId || Object.keys(changes).length === 0) return;

    try {
      setSaving(true);
      setError("");

      const updatedPermissions = permissions.map((p) => ({
        featureName: p.featureName,
        isEnabled: changes[p.featureName] !== undefined ? changes[p.featureName] : p.isEnabled,
      }));

      const res = await fetch(`/api/tenants/${tenantId}/roles/${roleId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: updatedPermissions }),
      });

      if (!res.ok) throw new Error("Failed to save permissions");

      setPermissions(updatedPermissions);
      setChanges({});
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (permissions.length === 0) {
    return (
      <div className="rounded-lg bg-muted/50 p-6 text-center">
        <p className="text-sm text-muted-foreground">No permissions available for this role.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-500/10 px-4 py-3 text-sm text-green-700 flex items-center gap-2">
          <Check className="h-4 w-4" />
          Permissions saved successfully
        </div>
      )}

      <div className="space-y-2">
        {permissions.map((permission) => {
          const isChanged = permission.featureName in changes;
          const isEnabled = isChanged ? changes[permission.featureName] : permission.isEnabled;

          return (
            <div
              key={permission.featureName}
              className="flex items-start justify-between p-4 bg-card border border-border rounded-lg hover:bg-muted/30 transition-colors"
            >
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground cursor-pointer">
                  {permission.featureName.replace(/_/g, " ")}
                </label>
                {permission.featureDescription && (
                  <p className="text-xs text-muted-foreground mt-1">{permission.featureDescription}</p>
                )}
              </div>
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={() => handleToggle(permission.featureName)}
                className="w-5 h-5 rounded border-border text-primary cursor-pointer mt-0.5"
              />
            </div>
          );
        })}
      </div>

      {Object.keys(changes).length > 0 && (
        <div className="flex justify-end gap-3 pt-6 border-t border-border">
          <Button
            variant="outline"
            onClick={() => setChanges({})}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      )}
    </div>
  );
}
