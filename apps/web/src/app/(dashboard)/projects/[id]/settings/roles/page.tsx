"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { CreateProjectRoleDialog } from "@/components/CreateProjectRoleDialog";
import { EditProjectRoleDialog } from "@/components/EditProjectRoleDialog";

export default function ProjectRolesPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [roles, setRoles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/roles`);
        if (!response.ok) throw new Error("Failed to fetch roles");
        const data = await response.json();
        setRoles(data.roles || []);
      } catch (error) {
        console.error("Error fetching roles:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (projectId) {
      fetchRoles();
    }
  }, [projectId]);

  const handleRoleCreated = () => {
    setIsLoading(true);
    fetch(`/api/projects/${projectId}/roles`)
      .then((r) => r.json())
      .then((data) => {
        setRoles(data.roles || []);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  };

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (!confirm(`Delete role "${roleName}"? This will remove the role from all project members.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/roles/${roleId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setRoles(roles.filter((r: any) => r.id !== roleId));
      }
    } catch (err) {
      console.error("Failed to delete role:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Project Roles</h1>
        <p className="text-gray-600 mt-2">
          Create and manage custom roles for this project
        </p>
      </div>

      <div className="flex justify-between items-center">
        <div></div>
        {<CreateProjectRoleDialog projectId={projectId} onRoleCreated={handleRoleCreated} />}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : roles.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <p className="text-center text-gray-600">
            No custom roles yet. Create one to assign different permissions to project members.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {roles.map((role: any) => (
            <div
              key={role.id}
              className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1">
                <p className="font-semibold text-sm text-gray-900">{role.name}</p>
                {role.description && (
                  <p className="text-xs text-gray-500 mt-1">{role.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Button variant="outline" size="sm" asChild>
                  <a href={`/projects/${projectId}/settings/roles/${role.id}/permissions`}>
                    Manage Permissions
                  </a>
                </Button>
                <EditProjectRoleDialog
                  roleId={role.id}
                  projectId={projectId}
                  initialName={role.name}
                  initialDescription={role.description}
                  onRoleUpdated={handleRoleCreated}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteRole(role.id, role.name)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
