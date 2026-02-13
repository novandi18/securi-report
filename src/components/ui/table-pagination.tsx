"use client";

import { useMemo } from "react";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

interface TablePaginationProps {
  /** Total number of items (after filtering) */
  totalItems: number;
  /** Current page (1-based) */
  currentPage: number;
  /** Rows per page */
  pageSize: number;
  /** Called when the page changes */
  onPageChange: (page: number) => void;
  /** Called when rows-per-page changes */
  onPageSizeChange: (size: number) => void;
}

export function TablePagination({
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Clamp current page
  const page = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  // Generate visible page numbers (max 5 visible around current)
  const pageNumbers = useMemo(() => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("ellipsis");
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }
    return pages;
  }, [page, totalPages]);

  return (
    <div className="flex flex-col items-center justify-between gap-4 border-t border-stroke px-5 py-4 dark:border-dark-3 sm:flex-row">
      {/* Left: showing X–Y of Z + page size */}
      <div className="flex items-center gap-4 text-sm text-dark-5 dark:text-dark-6">
        <span>
          Showing {startItem}–{endItem} of {totalItems}
        </span>
        <select
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
            onPageChange(1); // reset to first page
          }}
          className="rounded-md border border-stroke bg-transparent py-1 pl-2 pr-6 text-sm outline-none transition focus:border-primary dark:border-dark-3 dark:focus:border-primary"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </select>
      </div>

      {/* Right: page buttons */}
      <div className="flex items-center gap-1">
        {/* Previous */}
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm text-dark-5 transition-colors hover:bg-gray-2 disabled:pointer-events-none disabled:opacity-40 dark:text-dark-6 dark:hover:bg-dark-3"
          aria-label="Previous page"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="rotate-180"
          >
            <path
              d="M6 12L10 8L6 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Page numbers */}
        {pageNumbers.map((p, i) =>
          p === "ellipsis" ? (
            <span
              key={`ellipsis-${i}`}
              className="inline-flex h-8 w-8 items-center justify-center text-sm text-dark-5 dark:text-dark-6"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors ${
                p === page
                  ? "bg-primary text-white"
                  : "text-dark-5 hover:bg-gray-2 dark:text-dark-6 dark:hover:bg-dark-3"
              }`}
            >
              {p}
            </button>
          ),
        )}

        {/* Next */}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm text-dark-5 transition-colors hover:bg-gray-2 disabled:pointer-events-none disabled:opacity-40 dark:text-dark-6 dark:hover:bg-dark-3"
          aria-label="Next page"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M6 12L10 8L6 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * Hook to manage pagination state.
 * Returns the paginated slice of items + pagination controls.
 */
export function usePagination<T>(items: T[], defaultPageSize = 10) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Clamp page when items/pageSize change
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  if (safePage !== currentPage) {
    // schedule update to avoid setState during render
    queueMicrotask(() => setCurrentPage(safePage));
  }

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  return {
    /** Sliced items for the current page */
    paginatedItems,
    /** Props to spread on <TablePagination /> */
    paginationProps: {
      totalItems,
      currentPage: safePage,
      pageSize,
      onPageChange: setCurrentPage,
      onPageSizeChange: setPageSize,
    },
  };
}

// Need useState import for the hook
import { useState } from "react";
