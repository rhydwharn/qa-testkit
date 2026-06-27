"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReportType =
  | "overview"
  | "tc-by-status"
  | "tc-by-priority"
  | "tc-by-component"
  | "tc-by-label"
  | "tc-by-assignee"
  | "tc-by-timeframe"
  | "tc-manual-vs-automated"
  | "tc-planned-vs-not"
  | "exec-by-cycle"
  | "exec-by-environment"
  | "exec-by-build"
  | "exec-by-assignee"
  | "exec-by-requirement"
  | "exec-by-timeframe";

interface SidebarProps {
  selected: ReportType;
  onSelect: (type: ReportType) => void;
}

interface GroupItem {
  id: ReportType;
  label: string;
}

interface Section {
  label: string;
  group?: { label: string; items: GroupItem[] };
  standalone: GroupItem[];
}

const SECTIONS: Section[] = [
  {
    label: "Test Case Reports",
    group: {
      label: "Test Case Summary",
      items: [
        { id: "tc-by-status",    label: "By Workflow Status" },
        { id: "tc-by-priority",  label: "By Priority" },
        { id: "tc-by-component", label: "By Component" },
        { id: "tc-by-label",     label: "By Label" },
        { id: "tc-by-assignee",  label: "By Assignee" },
        { id: "tc-by-timeframe", label: "By Time Frame" },
      ],
    },
    standalone: [
      { id: "tc-manual-vs-automated", label: "Manual Vs Automated" },
      { id: "tc-planned-vs-not",      label: "Planned Vs Not-planned" },
    ],
  },
  {
    label: "Test Execution Reports",
    group: {
      label: "Test Case Execution Summary",
      items: [
        { id: "exec-by-cycle",        label: "By Test Cycle" },
        { id: "exec-by-environment",  label: "By Environment" },
        { id: "exec-by-build",        label: "By Build" },
        { id: "exec-by-assignee",     label: "By Execution Assignee" },
        { id: "exec-by-requirement",  label: "By Requirement" },
        { id: "exec-by-timeframe",    label: "By Time Frame" },
      ],
    },
    standalone: [
      { id: "overview", label: "Overview" },
    ],
  },
];

export function ReportSidebar({ selected, onSelect }: SidebarProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "Test Case Summary": true,
    "Test Case Execution Summary": true,
  });

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <nav className="w-56 flex-shrink-0 border-r overflow-y-auto py-3 text-sm">
      {SECTIONS.map((section) => (
        <div key={section.label} className="mb-4">
          <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {section.label}
          </p>

          {/* Collapsible group */}
          {section.group && (
            <div>
              <button
                onClick={() => toggleGroup(section.group!.label)}
                className="flex items-center w-full px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50 rounded-sm mx-1"
              >
                {openGroups[section.group.label]
                  ? <ChevronDown className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                  : <ChevronRight className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />}
                {section.group.label}
              </button>
              {openGroups[section.group.label] && (
                <div className="ml-3">
                  {section.group.items.map((item) => (
                    <SidebarItem
                      key={item.id}
                      item={item}
                      selected={selected}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Standalone items */}
          {section.standalone.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              selected={selected}
              onSelect={onSelect}
              className="mx-1"
            />
          ))}
        </div>
      ))}
    </nav>
  );
}

function SidebarItem({
  item,
  selected,
  onSelect,
  className,
}: {
  item: GroupItem;
  selected: ReportType;
  onSelect: (t: ReportType) => void;
  className?: string;
}) {
  return (
    <button
      onClick={() => onSelect(item.id)}
      className={cn(
        "w-full text-left px-3 py-1.5 rounded-sm text-sm transition-colors",
        selected === item.id
          ? "bg-brand-50 text-brand-700 font-medium dark:bg-brand-900/20 dark:text-brand-400"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        className
      )}
    >
      {item.label}
    </button>
  );
}
