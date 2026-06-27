"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

interface Version {
  versionNo: number;
  createdAt: string;
  isLatest: boolean;
}

interface VersionSelectorProps {
  testCaseId: string;
  currentVersionNo: number;
  onVersionChange: (versionNo: number) => void;
}

export function VersionSelector({
  testCaseId,
  currentVersionNo,
  onVersionChange,
}: VersionSelectorProps) {
  if (!testCaseId) return null;

  const [versions, setVersions] = useState<Version[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch versions
  useEffect(() => {
    const fetchVersions = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/testcases/${testCaseId}/versions`
        );
        if (response.ok) {
          const data = await response.json();
          setVersions(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Failed to fetch versions:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchVersions();
  }, [testCaseId]);

  const handleCreateVersion = async () => {
    setIsCreating(true);
    try {
      const response = await fetch(`/api/testcases/${testCaseId}/versions`, {
        method: "POST",
      });

      if (response.ok) {
        const newVersion = await response.json();
        if (newVersion?.versionNo != null) {
          setVersions((prev) => [...prev, newVersion]);
          onVersionChange(newVersion.versionNo);
        }
      }
    } catch (error) {
      console.error("Failed to create version:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleVersionChange = (versionNo: string) => {
    onVersionChange(parseInt(versionNo));
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading versions...</div>;
  }

  const sortedVersions = versions.filter((v) => v?.versionNo != null).sort((a, b) => b.versionNo - a.versionNo);

  return (
    <div className="space-y-2">
      <Select value={currentVersionNo.toString()} onValueChange={handleVersionChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a version" />
        </SelectTrigger>
        <SelectContent>
          {sortedVersions.map((version) => (
            <SelectItem key={version.versionNo} value={version.versionNo.toString()}>
              <div className="flex items-center gap-2">
                <span>Version {version.versionNo}</span>
                {version.isLatest && <Badge variant="secondary">Latest</Badge>}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {sortedVersions.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Created:{" "}
          {new Date(
            sortedVersions.find((v) => v.versionNo === currentVersionNo)
              ?.createdAt || ""
          ).toLocaleDateString()}
        </p>
      )}

      <Button
        onClick={handleCreateVersion}
        disabled={isCreating}
        variant="outline"
        size="sm"
        className="w-full gap-2"
      >
        <Plus className="h-4 w-4" />
        Create New Version
      </Button>
    </div>
  );
}

export default VersionSelector;
