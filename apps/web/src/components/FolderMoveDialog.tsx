"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronRight, Folder } from "lucide-react";
import { TestIds } from "@/lib/test-ids";

interface FolderNode {
  id: string;
  name: string;
  children?: FolderNode[];
}

interface FolderMoveDialogProps {
  folderId: string;
  projectId: string;
  onMove: (newParentId: string | null) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function FolderMoveDialog({
  folderId,
  projectId,
  onMove,
  open = false,
  onOpenChange,
}: FolderMoveDialogProps) {
  if (!folderId || !projectId) return null;

  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );

  // Fetch folder hierarchy
  useEffect(() => {
    if (!open) return;

    const fetchFolders = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/folders?projectId=${projectId}`);
        if (response.ok) {
          const data = await response.json();
          // Filter out the current folder from the tree
          const filtered = filterFolderTree(Array.isArray(data) ? data : [], folderId);
          setFolders(filtered);
        }
      } catch (error) {
        console.error("Failed to fetch folders:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFolders();
  }, [open, projectId, folderId]);

  const filterFolderTree = (
    folders: FolderNode[],
    excludeId: string
  ): FolderNode[] => {
    return folders
      .filter((f) => f.id !== excludeId)
      .map((f) => ({
        ...f,
        children: f.children
          ? filterFolderTree(f.children, excludeId)
          : undefined,
      }));
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedFolders(newExpanded);
  };

  const handleMove = async () => {
    setIsMoving(true);
    setError(null);
    try {
      const response = await fetch("/api/folders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: folderId,
          parentId: selectedFolderId,
        }),
      });

      if (response.ok) {
        onMove(selectedFolderId || null);
        onOpenChange?.(false);
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "Failed to move folder");
      }
    } catch (error) {
      console.error("Failed to move folder:", error);
      setError("Failed to move folder. Please try again.");
    } finally {
      setIsMoving(false);
    }
  };

  const renderFolderTree = (
    items: FolderNode[],
    depth: number = 0
  ): React.ReactNode => {
    return (
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.id}>
            <button
              onClick={() => {
                setSelectedFolderId(
                  selectedFolderId === item.id ? null : item.id
                );
                if (item.children?.length) {
                  toggleExpand(item.id);
                }
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                selectedFolderId === item.id
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted"
              }`}
              style={{ paddingLeft: `${depth * 20 + 12}px` }}
            >
              {item.children?.length ? (
                <ChevronRight
                  className={`h-4 w-4 transition-transform ${
                    expandedFolders.has(item.id) ? "rotate-90" : ""
                  }`}
                />
              ) : (
                <div className="w-4" />
              )}
              <Folder className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{item.name}</span>
            </button>

            {item.children?.length && expandedFolders.has(item.id) && (
              renderFolderTree(item.children, depth + 1)
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-folder-move-content">
        <DialogHeader data-testid="dialog-folder-move-header">
          <DialogTitle data-testid="dialog-folder-move-title">Move Folder</DialogTitle>
          <DialogDescription>
            Select a destination folder for this folder
          </DialogDescription>
        </DialogHeader>

        <div className="border rounded-lg p-3 max-h-80 overflow-y-auto bg-muted/30">
          {isLoading ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              Loading folders...
            </div>
          ) : folders.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              No folders available
            </div>
          ) : (
            <>
              {/* Root (No parent) option */}
              <button
                onClick={() => setSelectedFolderId(null)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors mb-2 ${
                  selectedFolderId === null
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <Folder className="h-4 w-4 flex-shrink-0" />
                <span>Root Level</span>
              </button>
              {renderFolderTree(folders)}
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            data-testid="dialog-folder-move-cancel"
            onClick={() => onOpenChange?.(false)}
            disabled={isMoving}
          >
            Cancel
          </Button>
          <Button
            data-testid="dialog-folder-move-submit"
            onClick={handleMove} disabled={isMoving || isLoading}>
            {isMoving ? "Moving..." : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FolderMoveDialog;
