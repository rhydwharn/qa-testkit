"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Lock, Users, Cog } from "lucide-react";

export default function ProjectSettingsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const settings = [
    {
      title: "Permissions",
      description: "Manage feature access by role. Set project-specific permissions or use workspace defaults.",
      icon: Lock,
      href: `/projects/${projectId}/settings/permissions`,
    },
    {
      title: "Members",
      description: "Invite team members and manage their project roles.",
      icon: Users,
      href: `/projects/${projectId}/settings/members`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Project Settings</h1>
        <p className="text-gray-600 mt-2">Manage your project configuration</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {settings.map((setting) => {
          const Icon = setting.icon;
          return (
            <Link key={setting.title} href={setting.href}>
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
                <div className="flex items-start gap-4">
                  <Icon className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {setting.title}
                    </h2>
                    <p className="text-sm text-gray-600 mt-2">
                      {setting.description}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
