"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TestIds } from "@/lib/test-ids";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FolderRenameDialogProps {
  folderId: string;
  currentName: string;
  onRename: (newName: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function FolderRenameDialog({
  folderId,
  currentName,
  onRename,
  open = false,
  onOpenChange,
}: FolderRenameDialogProps) {
  if (!folderId || !currentName) return null;

  const [newName, setNewName] = useState(currentName);
  const [isLoading, setIsLoading] = useState(false);

  const handleRename = async () => {
    if (!newName.trim() || newName === currentName) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/folders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: folderId,
          name: newName,
        }),
      });

      if (response.ok) {
        onRename(newName);
        onOpenChange?.(false);
      }
    } catch (error) {
      console.error("Failed to rename folder:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setNewName(currentName);
    }
    onOpenChange?.(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="dialog-folder-rename-content">
        <DialogHeader data-testid="dialog-folder-rename-header">
          <DialogTitle data-testid="dialog-folder-rename-title">Rename Folder</DialogTitle>
          <DialogDescription>
            Enter a new name for this folder
          </DialogDescription>
        </DialogHeader>

        <Input
            data-testid="form-input-folder-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          placeholder="Folder name"
          disabled={isLoading}
          autoFocus
        />

        <DialogFooter>
          <Button
            variant="outline"
            data-testid="dialog-folder-rename-cancel"
            onClick={() => onOpenChange?.(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            data-testid="dialog-folder-rename-submit"
            onClick={handleRename}
            disabled={isLoading || !newName.trim() || newName === currentName}
          >
            {isLoading ? "Renaming..." : "Rename"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FolderRenameDialog;
