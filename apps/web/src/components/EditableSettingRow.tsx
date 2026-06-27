"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit2, Check, X } from "lucide-react";

interface EditableSettingRowProps {
  id: string;
  label: string;
  value: string;
  onSave: (newValue: string) => void;
  placeholder?: string;
  isLoading?: boolean;
}

export function EditableSettingRow({
  id,
  label,
  value,
  onSave,
  placeholder = "Enter value",
  isLoading = false,
}: EditableSettingRowProps) {
  if (!id || !label) return null;

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    if (editValue.trim() && editValue !== value) {
      onSave(editValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 py-3 px-4 border rounded-lg bg-card hover:bg-muted/30 transition-colors">
      <div className="flex-1">
        <label className="text-sm font-medium text-muted-foreground">
          {label}
        </label>
        {!isEditing && (
          <p className="text-base font-medium text-foreground mt-1">
            {value || <span className="text-muted-foreground italic">Not set</span>}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={placeholder}
              disabled={isLoading}
              onKeyDown={handleKeyDown}
              className="w-48"
              autoFocus
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={handleSave}
              disabled={isLoading || !editValue.trim() || editValue === value}
              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleCancel}
              disabled={isLoading}
              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsEditing(true)}
            disabled={isLoading}
            className="h-8 w-8"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default EditableSettingRow;
