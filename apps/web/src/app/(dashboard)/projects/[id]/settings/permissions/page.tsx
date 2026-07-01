"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PermissionsMatrix } from "@/components/PermissionsMatrix";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";

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
        toast.error("Failed to load permissions");
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

      toast.success("Permissions updated successfully");
      setChanges({});
      setHasChanges(false);

      // Refresh permissions
      const refreshResponse = await fetch(`/api/projects/${projectId}/settings/permissions`);
      const data = await refreshResponse.json();
      setProjectFeatures(data.projectFeatures || []);
      setWorkspaceDefaults(data.workspaceDefaults || []);
    } catch (error) {
      console.error("Error saving permissions:", error);
      toast.error("Failed to save permissions");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevertToWorkspaceDefaults = async () => {
    if (!confirm("This will remove all project-specific permissions and revert to workspace defaults. Continue?")) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/settings/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useWorkspaceDefaults: true }),
      });

      if (!response.ok) throw new Error("Failed to revert permissions");

      toast.success("Reverted to workspace defaults");
      setProjectFeatures([]);
      setUseWorkspaceDefaults(true);
      setChanges({});
      setHasChanges(false);
    } catch (error) {
      console.error("Error reverting permissions:", error);
      toast.error("Failed to revert permissions");
    } finally {
      setIsSaving(false);
    }
  };

  const allFeatures = useWorkspaceDefaults
    ? workspaceDefaults
    : [...projectFeatures, ...workspaceDefaults];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Project Permissions</h1>
        <p className="text-gray-600 mt-2">
          Configure feature permissions for this project. You can override workspace defaults or use them as-is.
        </p>
      </div>

      {useWorkspaceDefaults && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900">Using Workspace Defaults</h3>
            <p className="text-sm text-blue-800 mt-1">
              This project is currently using workspace-level permissions. Click "Customize Permissions" below to override for this project only.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h2 className="text-lg font-semibold mb-2">
              {useWorkspaceDefaults ? "Workspace Defaults" : "Project Permissions"}
            </h2>
            <p className="text-sm text-gray-600">
              {useWorkspaceDefaults
                ? "These are the default permissions from your workspace"
                : "Customize permissions for this project"}
            </p>
          </div>
          {!useWorkspaceDefaults && (
            <Button
              variant="outline"
              onClick={handleRevertToWorkspaceDefaults}
              disabled={isSaving}
            >
              Revert to Workspace Defaults
            </Button>
          )}
        </div>

        <PermissionsMatrix
          features={allFeatures}
          roles={roles}
          isLoading={isLoading}
          onPermissionChange={handlePermissionChange}
          onSave={useWorkspaceDefaults ? undefined : handleSave}
          hasChanges={hasChanges}
          isSaving={isSaving}
        />

        {useWorkspaceDefaults && (
          <div className="mt-6 pt-6 border-t">
            <Button
              onClick={() => {
                setUseWorkspaceDefaults(false);
                setProjectFeatures([]);
                setHasChanges(false);
              }}
            >
              Customize Permissions for This Project
            </Button>
          </div>
        )}
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2">About Project Permissions</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Project-specific permissions override workspace defaults</li>
          <li>• You can use workspace defaults or customize for this project</li>
          <li>• OWNER and LEAD roles can modify project permissions</li>
          <li>• Changes take effect immediately for all project members</li>
          <li>• New projects automatically inherit workspace defaults</li>
        </ul>
      </div>
    </div>
  );
}
