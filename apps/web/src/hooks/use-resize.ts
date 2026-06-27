"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Drag-to-resize a panel. Returns the current width and a mousedown handler
 * to attach to the resize divider element.
 *
 * Widths are persisted to localStorage when a storageKey is provided.
 */
export function useResizablePanel(
  defaultWidth: number,
  options?: { min?: number; max?: number; storageKey?: string }
) {
  const { min = 120, max = 800, storageKey } = options ?? {};

  const [width, setWidth] = useState<number>(() => {
    if (storageKey && typeof window !== "undefined") {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const n = parseInt(stored, 10);
        if (!isNaN(n)) return Math.min(max, Math.max(min, n));
      }
    }
    return defaultWidth;
  });

  const widthRef = useRef(width);
  widthRef.current = width;

  // Persist whenever width changes.
  useEffect(() => {
    if (storageKey) localStorage.setItem(storageKey, String(width));
  }, [width, storageKey]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = widthRef.current;

      const onMove = (ev: MouseEvent) => {
        const next = Math.min(max, Math.max(min, startW + (ev.clientX - startX)));
        setWidth(next);
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [min, max]
  );

  return { width, onMouseDown };
}

/**
 * Drag-to-resize individual table columns.
 *
 * Usage:
 *   const { colWidths, startColResize } = useResizableColumns(defaults, { storageKey });
 *
 *   <th style={{ width: colWidths.key }} className="relative group/col">
 *     Key
 *     <ColResizeHandle onMouseDown={(e) => startColResize(e, 'key')} />
 *   </th>
 */
export function useResizableColumns<K extends string>(
  defaults: Record<K, number>,
  options?: { storageKey?: string; min?: number }
) {
  const { storageKey, min = 48 } = options ?? {};

  const [colWidths, setColWidths] = useState<Record<K, number>>(() => {
    if (storageKey && typeof window !== "undefined") {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          return { ...defaults, ...JSON.parse(stored) };
        } catch { /* ignore */ }
      }
    }
    return defaults;
  });

  const colWidthsRef = useRef(colWidths);
  colWidthsRef.current = colWidths;

  useEffect(() => {
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(colWidths));
  }, [colWidths, storageKey]);

  const startColResize = useCallback(
    (e: React.MouseEvent, col: K) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = colWidthsRef.current[col];

      const onMove = (ev: MouseEvent) => {
        const next = Math.max(min, startW + (ev.clientX - startX));
        setColWidths((prev) => ({ ...prev, [col]: next }));
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [min]
  );

  return { colWidths, startColResize };
}
