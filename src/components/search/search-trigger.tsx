"use client";

import { useCallback, useEffect, useState } from "react";
import { SearchModal } from "./search-modal";
import { useRole } from "@/hooks/use-role";
import { useToast } from "@/components/ui/toast";
import { reindexAllAction } from "@/lib/actions/search";

/**
 * SearchTrigger replaces the standard navbar search input.
 * Displays a "fake input" button that opens the SearchModal on click or ⌘K / Ctrl+K.
 * Also exposes a re-index button for admins.
 */
export function SearchTrigger() {
  const [open, setOpen] = useState(false);
  const { isAdmin } = useRole();
  const { addToast } = useToast();
  const [reindexing, setReindexing] = useState(false);

  // ─── Global keyboard shortcut ─────────────────────────
  const handleGlobalKey = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    },
    [],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleGlobalKey);
    return () => document.removeEventListener("keydown", handleGlobalKey);
  }, [handleGlobalKey]);

  // ─── Re-index handler ─────────────────────────────────
  async function handleReindex() {
    setReindexing(true);
    const result = await reindexAllAction();
    if (result.success && result.counts) {
      addToast(
        `Search re-indexed: ${result.counts.customers} customers, ${result.counts.reports} reports, ${result.counts.templates} templates.`,
        "success",
      );
    } else {
      addToast(result.error || "Failed to re-index.", "error");
    }
    setReindexing(false);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Fake search input button */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full max-w-[300px] items-center gap-3 rounded-full border bg-gray-2 px-4 py-2 text-sm text-dark-5 outline-none transition-colors hover:border-primary/50 dark:border-dark-3 dark:bg-dark-2 dark:text-dark-6 dark:hover:border-dark-4"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 18 18"
            fill="currentColor"
          >
            <g clipPath="url(#st-icon)">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M8.625 2.0625C5.00063 2.0625 2.0625 5.00063 2.0625 8.625C2.0625 12.2494 5.00063 15.1875 8.625 15.1875C12.2494 15.1875 15.1875 12.2494 15.1875 8.625C15.1875 5.00063 12.2494 2.0625 8.625 2.0625ZM0.9375 8.625C0.9375 4.37931 4.37931 0.9375 8.625 0.9375C12.8707 0.9375 16.3125 4.37931 16.3125 8.625C16.3125 10.5454 15.6083 12.3013 14.4441 13.6487L16.8977 16.1023C17.1174 16.3219 17.1174 16.6781 16.8977 16.8977C16.6781 17.1174 16.3219 17.1174 16.1023 16.8977L13.6487 14.4441C12.3013 15.6083 10.5454 16.3125 8.625 16.3125C4.37931 16.3125 0.9375 12.8707 0.9375 8.625Z"
              />
            </g>
            <defs>
              <clipPath id="st-icon">
                <rect width="18" height="18" fill="white" />
              </clipPath>
            </defs>
          </svg>
          <span className="flex-1 text-left">Search…</span>
          <kbd className="hidden rounded border border-stroke px-1.5 py-0.5 text-[10px] font-medium dark:border-dark-3 sm:inline-block">
            ⌘K
          </kbd>
        </button>

        {/* Admin: Re-index button */}
        {isAdmin && (
          <button
            type="button"
            onClick={handleReindex}
            disabled={reindexing}
            title="Re-index all search data"
            className="shrink-0 rounded-lg border border-stroke p-2 text-dark-5 transition-colors hover:bg-gray-2 hover:text-dark disabled:opacity-50 dark:border-dark-3 dark:text-dark-6 dark:hover:bg-dark-3 dark:hover:text-white"
          >
            {reindexing ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            )}
          </button>
        )}
      </div>

      <SearchModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
