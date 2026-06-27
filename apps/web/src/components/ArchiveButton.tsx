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

  const handleToggleArchive = async () => {
    setIsLoading(true);
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
      }
    } catch (error) {
      console.error("Failed to toggle archive:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleToggleArchive}
      disabled={isLoading}
      variant="outline"
      size="sm"
      className="gap-2"
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
  );
}

export default ArchiveButton;
