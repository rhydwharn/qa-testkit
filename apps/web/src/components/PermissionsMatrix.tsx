"use client";

import React, { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

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

interface PermissionsMatrixProps {
  features: FeatureRow[];
  roles: string[];
  isLoading?: boolean;
  onPermissionChange: (
    featureName: string,
    roleName: string,
    isEnabled: boolean
  ) => void;
  onSave?: () => void;
  hasChanges?: boolean;
  isSaving?: boolean;
}

export function PermissionsMatrix({
  features,
  roles,
  isLoading = false,
  onPermissionChange,
  onSave,
  hasChanges = false,
  isSaving = false,
}: PermissionsMatrixProps) {
  const getPermissionForRole = (feature: FeatureRow, roleName: string) => {
    return feature.rolePermissions.find((rp) => rp.roleName === roleName);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4 font-semibold text-sm">
                Feature
              </th>
              {roles.map((role) => (
                <th key={role} className="text-center py-3 px-4 font-semibold text-sm">
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map((feature) => (
              <tr key={feature.id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4">
                  <div>
                    <div className="font-medium text-sm text-gray-900">
                      {feature.featureName.replace(/_/g, " ")}
                    </div>
                    {feature.description && (
                      <div className="text-xs text-gray-500 mt-1">
                        {feature.description}
                      </div>
                    )}
                  </div>
                </td>
                {roles.map((role) => {
                  const permission = getPermissionForRole(feature, role);
                  const isEnabled = permission?.isEnabled ?? true;

                  return (
                    <td key={`${feature.id}-${role}`} className="text-center py-3 px-4">
                      <Checkbox
                        checked={isEnabled && feature.isEnabled}
                        onCheckedChange={(checked) => {
                          onPermissionChange(feature.featureName, role, !!checked);
                        }}
                        disabled={!feature.isEnabled}
                        aria-label={`${feature.featureName} for ${role}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {onSave && (
        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={onSave}
            disabled={!hasChanges || isSaving}
            className="gap-2"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSaving ? "Saving..." : "Save Permissions"}
          </Button>
        </div>
      )}
    </div>
  );
}
