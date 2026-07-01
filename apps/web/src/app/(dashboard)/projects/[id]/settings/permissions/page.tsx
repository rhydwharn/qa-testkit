"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

interface FeatureRow {
  id: string;
  featureName: string;
  description: string;
  isEnabled: boolean;
  rolePermissions: Array<{
    id: string;
    roleName: string;
    isEnabled: boolean;
  }>;
}

export default function ProjectPermissionsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [projectFeatures, setProjectFeatures] = useState<FeatureRow[]>([]);
  const [workspaceDefaults, setWorkspaceDefaults] = useState<FeatureRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [useWorkspaceDefaults, setUseWorkspaceDefaults] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [changes, setChanges] = useState<Record<string, Record<string, boolean>>>({});

  const roles = ["OWNER", "LEAD", "TESTER", "VIEWER"];

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/settings/permissions`);
        if (!response.ok) throw new Error("Failed to fetch permissions");
        const data = await response.json();
        setProjectFeatures(data.projectFeatures || []);
        setWorkspaceDefaults(data.workspaceDefaults || []);
        setUseWorkspaceDefaults((data.projectFeatures || []).length === 0);
      } catch (error) {
        console.error("Error fetching permissions:", error);
        setError(error instanceof Error ? error.message : "Failed to load permissions");
      } finally {
        setIsLoading(false);
      }
    };

    if (projectId) {
      fetchPermissions();
    }
  }, [projectId]);

  const handlePermissionChange = useCallback(
    (featureName: string, roleName: string, isEnabled: boolean) => {
      setChanges((prev) => ({
        ...prev,
        [featureName]: {
          ...(prev[featureName] || {}),
          [roleName]: isEnabled,
        },
      }));
      setHasChanges(true);
      setUseWorkspaceDefaults(false);
    },
    []
  );

  const handleSave = async () => {
    setIsSaving(true);
    setSuccessMessage(null);
    try {
      const permissions = Object.entries(changes).map(([featureName, roles]) => {
        return Object.entries(roles).map(([roleName, isEnabled]) => ({
          featureName,
          roleName,
          isEnabled,
        }));
      }).flat();

      const response = await fetch(`/api/projects/${projectId}/settings/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      });

      if (!response.ok) throw new Error("Failed to save permissions");

      console.log("Permissions updated successfully");
      setChanges({});
      setHasChanges(false);
      setError(null);
      setSuccessMessage("Permissions updated successfully!");

      // Refresh permissions
      const refreshResponse = await fetch(`/api/projects/${projectId}/settings/permissions`);
      const data = await refreshResponse.json();
      setProjectFeatures(data.projectFeatures || []);
      setWorkspaceDefaults(data.workspaceDefaults || []);

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error("Error saving permissions:", error);
      setError(error instanceof Error ? error.message : "Failed to save permissions");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevertToWorkspaceDefaults = async () => {
    if (!confirm("This will remove all project-specific permissions and revert to workspace defaults. Continue?")) {
      return;
    }

    setIsSaving(true);
    setSuccessMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/settings/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useWorkspaceDefaults: true }),
      });

      if (!response.ok) throw new Error("Failed to revert permissions");

      console.log("Reverted to workspace defaults");
      setProjectFeatures([]);
      setUseWorkspaceDefaults(true);
      setChanges({});
      setHasChanges(false);
      setSuccessMessage("Reverted to workspace defaults");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error("Error reverting permissions:", error);
      setError(error instanceof Error ? error.message : "Failed to revert permissions");
    } finally {
      setIsSaving(false);
    }
  };

  const allFeatures = useWorkspaceDefaults
    ? workspaceDefaults
    : [...projectFeatures, ...workspaceDefaults];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Project Permissions</h1>
          <p className="text-gray-600 mt-2">Configure feature access for this project</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Loading permissions...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Project Permissions</h1>
        <p className="text-gray-600 mt-2">
          Configure feature permissions for this project. Override workspace defaults or use them as-is.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-sm text-red-800 mt-1">{error}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-green-900">Success</h3>
            <p className="text-sm text-green-800 mt-1">{successMessage}</p>
          </div>
        </div>
      )}

      {useWorkspaceDefaults && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900">Using Workspace Defaults</h3>
          <p className="text-sm text-blue-800 mt-1">
            This project is currently using workspace-level permissions. Click "Customize Permissions" below to override for this project only.
          </p>
        </div>
      )}

      {allFeatures.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200 flex justify-between items-start">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {useWorkspaceDefaults ? "Workspace Defaults" : "Project Permissions"}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {useWorkspaceDefaults
                  ? "These are the default permissions from your workspace"
                  : "Customize permissions for this project"}
              </p>
            </div>
            {!useWorkspaceDefaults && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRevertToWorkspaceDefaults}
                disabled={isSaving}
              >
                Revert to Workspace Defaults
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {allFeatures.map((feature) => (
              <div
                key={feature.id}
                className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium text-sm text-gray-900">{feature.featureName.replace(/_/g, " ")}</p>
                  <p className="text-xs text-gray-500 mt-1">{feature.description}</p>
                </div>

                <div className="flex items-center gap-6 ml-4">
                  {roles.map((role) => {
                    const permission = feature.rolePermissions.find((rp) => rp.roleName === role);
                    const isEnabled = permission?.isEnabled ?? true;
                    const currentValue = changes[feature.featureName]?.[role];
                    const displayValue = currentValue !== undefined ? currentValue : isEnabled;

                    return (
                      <div key={role} className="flex flex-col items-center gap-1">
                        <input
                          type="checkbox"
                          checked={displayValue}
                          onChange={(e) =>
                            handlePermissionChange(feature.featureName, role, e.target.checked)
                          }
                          disabled={useWorkspaceDefaults}
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span className="text-xs text-gray-500 whitespace-nowrap">{role}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {!useWorkspaceDefaults && hasChanges && (
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setChanges({});
                  setHasChanges(false);
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}

          {useWorkspaceDefaults && (
            <div className="p-6 border-t border-gray-200">
              <Button onClick={() => setUseWorkspaceDefaults(false)}>
                Customize Permissions for This Project
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900">About Project Permissions</h3>
        <ul className="text-sm text-blue-800 space-y-1 mt-2">
          <li>• Project-specific permissions override workspace defaults</li>
          <li>• You can use workspace defaults or customize for this project</li>
          <li>• OWNER and LEAD roles can modify project permissions</li>
          <li>• Changes take effect immediately for all project members</li>
        </ul>
      </div>
    </div>
  );
}
