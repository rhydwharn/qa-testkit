"use client";

import React, { useState, useEffect } from "react";
import { TestIds } from "@/lib/test-ids";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";

interface Folder {
  id: string;
  name: string;
}

interface CloneCycleDialogProps {
  cycleId: string;
  cycleSummary: string;
  onClone: (newCycle: { id: string; summary: string }) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CloneCycleDialog({
  cycleId,
  cycleSummary,
  onClone,
  open = false,
  onOpenChange,
}: CloneCycleDialogProps) {
  if (!cycleId || !cycleSummary) return null;

  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCloning, setIsCloning] = useState(false);

  // Fetch folders
  useEffect(() => {
    if (!open) return;

    const fetchFolders = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/folders");
        if (response.ok) {
          const data = await response.json();
          setFolders(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Failed to fetch folders:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFolders();
  }, [open]);

  const handleClone = async () => {
    setIsCloning(true);
    try {
      const response = await fetch(`/api/testcycles/${cycleId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId: selectedFolderId || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        onClone(data);
        onOpenChange?.(false);
        setSelectedFolderId("");
      }
    } catch (error) {
      console.error("Failed to clone cycle:", error);
    } finally {
      setIsCloning(false);
    }
  };

  const clonedSummary = `${cycleSummary} (Clone)`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-clone-cycle-content">
        <DialogHeader data-testid="dialog-clone-cycle-header">
          <DialogTitle data-testid="dialog-clone-cycle-title">Clone Test Cycle</DialogTitle>
          <DialogDescription>
            Create a copy of this test cycle with all its contents
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Folder Selection */}
          <div className="space-y-2" data-testid="dialog-clone-cycle-folder-select">
            <label className="text-sm font-medium">Clone to folder (optional)</label>
            {isLoading ? (
              <div className="text-sm text-muted-foreground py-2">
                Loading folders...
              </div>
            ) : (
              <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
                <SelectTrigger data-testid="form-select-folder">
                  <SelectValue placeholder="Default (same location)" />
                </SelectTrigger>
                <SelectContent>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Summary Preview */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Summary preview</label>
            <Card className="p-3 bg-muted/30">
              <p className="text-sm text-foreground">{clonedSummary}</p>
            </Card>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            data-testid="dialog-clone-cycle-cancel"
            onClick={() => onOpenChange?.(false)}
            disabled={isCloning}
          >
            Cancel
          </Button>
          <Button
            data-testid="dialog-clone-cycle-submit"
            onClick={handleClone}
            disabled={isCloning || isLoading}
          >
            {isCloning ? "Cloning..." : "Clone Cycle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CloneCycleDialog;
