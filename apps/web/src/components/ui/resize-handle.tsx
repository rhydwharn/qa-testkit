"use client";

/**
 * Vertical drag handle rendered between two panels.
 * Place it between the two sibling panel elements.
 */
export function PanelResizeHandle({
  onMouseDown,
}: {
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      role="separator"
      aria-orientation="vertical"
      className="relative w-1 shrink-0 cursor-col-resize select-none group"
    >
      {/* Visual bar */}
      <div className="absolute inset-0 bg-border group-hover:bg-primary/50 group-active:bg-primary transition-colors duration-100" />
      {/* Wider invisible hit area */}
      <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
    </div>
  );
}

/**
 * Drag handle placed at the right edge of a <th> to resize that column.
 * The parent <th> needs `position: relative` and `overflow: visible`.
 */
export function ColResizeHandle({
  onMouseDown,
}: {
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize select-none group/handle z-10"
      aria-hidden="true"
    >
      <div className="absolute inset-0 opacity-0 group-hover/handle:opacity-100 bg-primary/40 transition-opacity duration-100" />
      {/* Wider invisible hit area */}
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  );
}
