"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PermissionsMatrix } from "@/components/PermissionsMatrix";
import { Loader2, AlertCircle } from "lucide-react";

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
  const { data: session, status } = useSession();
  const router = useRouter();
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changes, setChanges] = useState<Record<string, Record<string, boolean>>>({});

  const roles = ["OWNER", "ADMIN", "MEMBER"];

  // Debug: Log session status
  useEffect(() => {
    console.log("Session status:", status);
    console.log("Session data:", session);
    console.log("TenantId:", session?.user?.tenantId);
  }, [session, status]);

  useEffect(() => {
    console.log("useEffect triggered - status:", status, "tenantId:", session?.user?.tenantId);
    
    if (status === "loading") {
      console.log("Session still loading, returning early");
      return;
    }
    
    if (!session?.user?.tenantId) {
      const errorMsg = "No workspace ID found. Please log in again.";
      console.error(errorMsg, { session, tenantId: session?.user?.tenantId });
      setError(errorMsg);
      setIsLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      try {
        const url = `/api/tenants/${session.user.tenantId}/settings/permissions`;
        console.log("🟢 Fetching permissions from:", url);
        
        const response = await fetch(url);
        console.log("🟢 Response status:", response.status);
        
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Failed to fetch permissions: ${response.status} ${errText}`);
        }
        
        const data = await response.json();
        console.log("🟢 Permissions data:", data);
        setFeatures(data.featureFlags || []);
        setError(null);
      } catch (error) {
        console.error("❌ Error fetching permissions:", error);
        setError(error instanceof Error ? error.message : "Failed to load permissions");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPermissions();
  }, [session?.user?.tenantId, status]);

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

      const url = `/api/tenants/${session?.user?.tenantId}/settings/permissions`;
      console.log("Saving to:", url);
      
      const response = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to save: ${response.status} ${errText}`);
      }

      console.log("Permissions saved successfully");
      setChanges({});
      setHasChanges(false);
      setError(null);

      // Refresh permissions
      const refreshResponse = await fetch(
        `/api/tenants/${session?.user?.tenantId}/settings/permissions`
      );
      const data = await refreshResponse.json();
      setFeatures(data.featureFlags || []);
    } catch (error) {
      console.error("Error saving permissions:", error);
      setError(error instanceof Error ? error.message : "Failed to save permissions");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Workspace Permissions</h1>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Loading permissions...</p>
              <p className="text-xs text-gray-500 mt-4">
                Status: {status} | TenantId: {session?.user?.tenantId || "Not loaded"}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Workspace Permissions</h1>
        <p className="text-gray-600 mt-2">
          Configure default feature permissions for all workspace members and projects
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-sm text-red-800 mt-1">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-red-700 underline mt-2 hover:text-red-900"
            >
              Reload Page
            </button>
          </div>
        </div>
      )}

      {features.length === 0 && !error && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800">
            No permissions configured yet. All features are enabled by default for all roles.
          </p>
        </div>
      )}

      {features.length > 0 && (
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
            isLoading={false}
            onPermissionChange={handlePermissionChange}
            onSave={handleSave}
            hasChanges={hasChanges}
            isSaving={isSaving}
          />
        </div>
      )}

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
