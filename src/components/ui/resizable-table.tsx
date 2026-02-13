"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

/* ═══════════════════════════════════════════════════
   Resizable Table Components
   ═══════════════════════════════════════════════════ */

export function ResizableTable({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-auto">
      <table
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

export function ResizableTableHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("[&_tr]:border-b", className)} {...props} />;
}

export function ResizableTableBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  );
}

export function ResizableTableFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={cn(
        "border-t bg-neutral-100/50 font-medium dark:bg-neutral-800/50 [&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

export function ResizableTableRow({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b transition-colors hover:bg-neutral-100/50 data-[state=selected]:bg-neutral-100 dark:border-dark-3 dark:hover:bg-dark-2 dark:data-[state=selected]:bg-neutral-800",
        className,
      )}
      {...props}
    />
  );
}

export function ResizableTableCell({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "p-4 align-middle [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

/* ─── Sort Direction ──────────────────────────────── */

export type SortDirection = "asc" | "desc" | null;

/* ─── Resizable + Sortable Table Head ─────────────── */

interface ResizableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  /** Enable drag-to-resize handle on the right edge */
  resizable?: boolean;
  /** Minimum width in px (default: 60) */
  minWidth?: number;
  /** Sort direction for this column */
  sortDirection?: SortDirection;
  /** Callback when sort header is clicked */
  onSort?: () => void;
  /** Whether sorting is enabled for this column */
  sortable?: boolean;
}

export function ResizableTableHead({
  className,
  resizable = true,
  minWidth = 60,
  sortDirection,
  onSort,
  sortable = false,
  children,
  style,
  ...props
}: ResizableTableHeadProps) {
  const thRef = React.useRef<HTMLTableCellElement>(null);
  const [width, setWidth] = React.useState<number | null>(null);
  const [isResizing, setIsResizing] = React.useState(false);

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);

      const th = thRef.current;
      if (!th) return;

      const startX = e.clientX;
      const startWidth = th.getBoundingClientRect().width;

      const handleMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        const next = Math.max(minWidth, startWidth + delta);
        setWidth(next);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [minWidth],
  );

  const mergedStyle: React.CSSProperties = {
    ...style,
    ...(width ? { width: `${width}px`, minWidth: `${width}px` } : {}),
    position: "relative",
  };

  return (
    <th
      ref={thRef}
      className={cn(
        "h-12 px-4 text-left align-middle font-medium text-neutral-500 dark:text-neutral-400 [&:has([role=checkbox])]:pr-0",
        sortable && "cursor-pointer select-none",
        isResizing && "bg-gray-100 dark:bg-dark-3",
        className,
      )}
      style={mergedStyle}
      onClick={sortable ? onSort : undefined}
      {...props}
    >
      <div className="flex items-center gap-1">
        <span className="truncate">{children}</span>
        {/* Sort indicator */}
        {sortable && (
          <span className="ml-auto shrink-0 text-xs">
            {sortDirection === "asc" ? (
              <ChevronUp size={14} className="text-primary" />
            ) : sortDirection === "desc" ? (
              <ChevronDown size={14} className="text-primary" />
            ) : (
              <ChevronsUpDown size={14} className="opacity-30" />
            )}
          </span>
        )}
      </div>

      {/* Resize handle */}
      {resizable && (
        <div
          onMouseDown={handleMouseDown}
          className={cn(
            "absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize",
            "hover:bg-primary/40 active:bg-primary/60 transition-colors",
            isResizing && "bg-primary/60",
          )}
          role="separator"
          aria-orientation="vertical"
        />
      )}
    </th>
  );
}

/* ─── Sort Hook ───────────────────────────────────── */

export function useTableSort<T extends object>(
  data: T[],
  defaultSortKey?: keyof T,
  defaultDirection: SortDirection = null,
) {
  const [sortKey, setSortKey] = React.useState<keyof T | null>(
    defaultSortKey ?? null,
  );
  const [sortDirection, setSortDirection] =
    React.useState<SortDirection>(defaultDirection);

  const handleSort = React.useCallback(
    (key: keyof T) => {
      if (sortKey === key) {
        // Cycle: asc -> desc -> null
        if (sortDirection === "asc") setSortDirection("desc");
        else if (sortDirection === "desc") {
          setSortDirection(null);
          setSortKey(null);
        } else {
          setSortDirection("asc");
        }
      } else {
        setSortKey(key);
        setSortDirection("asc");
      }
    },
    [sortKey, sortDirection],
  );

  const sortedData = React.useMemo(() => {
    if (!sortKey || !sortDirection) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDirection === "asc" ? 1 : -1;
      if (bVal == null) return sortDirection === "asc" ? -1 : 1;

      // String comparison
      if (typeof aVal === "string" && typeof bVal === "string") {
        const cmp = aVal.localeCompare(bVal, undefined, { sensitivity: "base" });
        return sortDirection === "asc" ? cmp : -cmp;
      }

      // Number comparison
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      // Date comparison
      if (aVal instanceof Date && bVal instanceof Date) {
        return sortDirection === "asc"
          ? aVal.getTime() - bVal.getTime()
          : bVal.getTime() - aVal.getTime();
      }

      // Fallback string comparison
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDirection]);

  const getSortDirection = React.useCallback(
    (key: keyof T): SortDirection => {
      return sortKey === key ? sortDirection : null;
    },
    [sortKey, sortDirection],
  );

  return {
    sortedData,
    sortKey,
    sortDirection,
    handleSort,
    getSortDirection,
  };
}
