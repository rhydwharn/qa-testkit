"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PermissionsMatrix } from "@/components/PermissionsMatrix";
import { toast } from "sonner";

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

export default function WorkspacePermissionsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [changes, setChanges] = useState<Record<string, Record<string, boolean>>>({});

  const roles = ["OWNER", "ADMIN", "MEMBER"];

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const response = await fetch(`/api/tenants/${session?.user?.tenantId}/settings/permissions`);
        if (!response.ok) throw new Error("Failed to fetch permissions");
        const data = await response.json();
        setFeatures(data.featureFlags || []);
      } catch (error) {
        console.error("Error fetching permissions:", error);
        toast.error("Failed to load permissions");
      } finally {
        setIsLoading(false);
      }
    };

    if (session?.user?.tenantId) {
      fetchPermissions();
    }
  }, [session?.user?.tenantId]);

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

      const response = await fetch(
        `/api/tenants/${session?.user?.tenantId}/settings/permissions`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ permissions }),
        }
      );

      if (!response.ok) throw new Error("Failed to save permissions");

      toast.success("Permissions updated successfully");
      setChanges({});
      setHasChanges(false);

      // Refresh permissions
      const refreshResponse = await fetch(
        `/api/tenants/${session?.user?.tenantId}/settings/permissions`
      );
      const data = await refreshResponse.json();
      setFeatures(data.featureFlags || []);
    } catch (error) {
      console.error("Error saving permissions:", error);
      toast.error("Failed to save permissions");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Workspace Permissions</h1>
        <p className="text-gray-600 mt-2">
          Configure default feature permissions for all workspace members and projects
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Permission Matrix</h2>
          <p className="text-sm text-gray-600">
            Manage which features each role can access. These settings apply as defaults to all projects unless overridden at the project level.
          </p>
        </div>

        <PermissionsMatrix
          features={features}
          roles={roles}
          isLoading={isLoading}
          onPermissionChange={handlePermissionChange}
          onSave={handleSave}
          hasChanges={hasChanges}
          isSaving={isSaving}
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">About Workspace Permissions</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• These settings define default permissions for new projects</li>
          <li>• Existing projects can override these defaults with project-specific settings</li>
          <li>• OWNER role always retains full access regardless of permission settings</li>
          <li>• Changes take effect immediately for new projects</li>
        </ul>
      </div>
    </div>
  );
}
