"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Archive, ArchiveRestore } from "lucide-react";

type EntityType = "TEST_CASE" | "TEST_CYCLE" | "TEST_PLAN";

interface ArchiveButtonProps {
  entityType: EntityType;
  entityId: string;
  isArchived: boolean;
  onArchiveChange?: (isArchived: boolean) => void;
}

export function ArchiveButton({
  entityType,
  entityId,
  isArchived,
  onArchiveChange,
}: ArchiveButtonProps) {
  if (!entityType || !entityId) return null;

  const [isLoading, setIsLoading] = useState(false);
  const [archived, setArchived] = useState(isArchived);
  const [error, setError] = useState<string | null>(null);

  const handleToggleArchive = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const endpoint = archived ? "unarchive" : "archive";
      const ENTITY_PATH: Record<string, string> = {
        TEST_CASE: "testcases",
        TEST_CYCLE: "testcycles",
        TEST_PLAN: "testplans",
      };
      const url = `/api/${ENTITY_PATH[entityType]}/${entityId}/${endpoint}`;
      const response = await fetch(url, {
        method: "PUT",
      });

      if (response.ok) {
        const newArchivedState = !archived;
        setArchived(newArchivedState);
        onArchiveChange?.(newArchivedState);
      } else {
        const data = await response.json().catch(() => ({}));
        const errorMsg = data.error || `Failed to ${endpoint} item`;
        setError(errorMsg);
        console.error("Archive toggle failed:", errorMsg);
      }
    } catch (error) {
      console.error("Failed to toggle archive:", error);
      setError("Failed to update archive status. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {error && (
        <p className="text-xs text-destructive mb-2" role="alert">
          {error}
        </p>
      )}
      <Button
        onClick={handleToggleArchive}
        disabled={isLoading}
        variant="outline"
        size="sm"
        className="gap-2"
        title={error || (archived ? "Unarchive this item" : "Archive this item")}
      >
      {archived ? (
        <>
          <ArchiveRestore className="h-4 w-4" />
          Unarchive
        </>
      ) : (
        <>
          <Archive className="h-4 w-4" />
          Archive
        </>
      )}
    </Button>
    </>
  );
}

export default ArchiveButton;
