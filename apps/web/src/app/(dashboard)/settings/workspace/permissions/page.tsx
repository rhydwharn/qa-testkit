"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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

export default function WorkspacePermissionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [changes, setChanges] = useState<Record<string, Record<string, boolean>>>({});

  const roles = ["OWNER", "ADMIN", "MEMBER"];

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
        console.log("🟢 Feature flags count:", data.featureFlags?.length || 0);
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
    setSuccessMessage(null);
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
      setSuccessMessage("Permissions updated successfully!");

      // Refresh permissions
      const refreshResponse = await fetch(
        `/api/tenants/${session?.user?.tenantId}/settings/permissions`
      );
      const data = await refreshResponse.json();
      setFeatures(data.featureFlags || []);

      setTimeout(() => setSuccessMessage(null), 3000);
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
          <p className="text-gray-600 mt-2">Configure feature access for your workspace</p>
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
        <h1 className="text-3xl font-bold">Workspace Permissions</h1>
        <p className="text-gray-600 mt-2">Configure default feature access for all workspace members</p>
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

      {features.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Permission Matrix</h2>
            <p className="text-sm text-gray-600 mt-1">Grant or revoke access to features for each role</p>
          </div>

          <div className="space-y-2">
            {features.map((feature) => (
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
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 cursor-pointer"
                        />
                        <span className="text-xs text-gray-500 whitespace-nowrap">{role}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {hasChanges && (
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
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900">About Workspace Permissions</h3>
        <ul className="text-sm text-blue-800 space-y-1 mt-2">
          <li>• These settings define default permissions for your entire workspace</li>
          <li>• Projects can override these defaults with project-specific settings</li>
          <li>• Only workspace OWNER and ADMIN roles can modify these settings</li>
          <li>• Changes take effect immediately for new projects</li>
        </ul>
      </div>
    </div>
  );
}
