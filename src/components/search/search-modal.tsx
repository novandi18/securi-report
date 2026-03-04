"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { searchClient, INDEX } from "@/lib/meilisearch";
import { useRole } from "@/hooks/use-role";

// ─── Types ────────────────────────────────────────────────

interface SearchHit {
  id: string;
  [key: string]: unknown;
}

interface CategoryResult {
  category: string;
  icon: React.ReactNode;
  hits: SearchHit[];
  getTitle: (hit: SearchHit) => string;
  getSubtitle?: (hit: SearchHit) => string | undefined;
  getHref: (hit: SearchHit) => string;
}

// ─── Icons ────────────────────────────────────────────────

function CustomersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function TemplatesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  );
}

function ReturnIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 10 4 15 9 20" />
      <path d="M20 4v7a4 4 0 0 1-4 4H4" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

const RECENT_KEY = "securi-search-recent";
const MAX_RECENT = 5;

interface RecentItem {
  title: string;
  href: string;
  category: string;
}

function getRecentSearches(): RecentItem[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function addRecentSearch(item: RecentItem) {
  try {
    const existing = getRecentSearches().filter((r) => r.href !== item.href);
    const updated = [item, ...existing].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

function removeRecentSearch(href: string) {
  try {
    const updated = getRecentSearches().filter((r) => r.href !== href);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

function clearAllRecentSearches() {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    // ignore
  }
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const router = useRouter();
  const { isViewer } = useRole();

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CategoryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<RecentItem[]>([]);
  const [visible, setVisible] = useState(false);
  const [removing, setRemoving] = useState<Set<string>>(new Set());

  // ─── Flatten results for arrow navigation ───
  const flatItems = useMemo(() => {
    const items: { title: string; subtitle?: string; href: string; category: string }[] = [];
    for (const cat of results) {
      for (const hit of cat.hits) {
        items.push({
          title: cat.getTitle(hit),
          subtitle: cat.getSubtitle?.(hit),
          href: cat.getHref(hit),
          category: cat.category,
        });
      }
    }
    return items;
  }, [results]);

  // ─── Focus input on open ───
  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches());
      // Trigger enter animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setVisible(false);
      setQuery("");
      setResults([]);
      setActiveIndex(0);
    }
  }, [open]);

  // ─── Close with exit animation ───
  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  // ─── Delete single recent item ───
  function handleRemoveRecent(e: React.MouseEvent, href: string) {
    e.stopPropagation();
    setRemoving((prev) => new Set(prev).add(href));
    setTimeout(() => {
      removeRecentSearch(href);
      setRecentSearches(getRecentSearches());
      setRemoving((prev) => {
        const next = new Set(prev);
        next.delete(href);
        return next;
      });
      setActiveIndex(0);
    }, 200);
  }

  // ─── Clear all recent searches ───
  function handleClearAll() {
    const allHrefs = recentSearches.map((r) => r.href);
    setRemoving(new Set(allHrefs));
    setTimeout(() => {
      clearAllRecentSearches();
      setRecentSearches([]);
      setRemoving(new Set());
      setActiveIndex(0);
    }, 200);
  }

  // ─── Multi-index search ───
  const search = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const client = searchClient();

        // Build queries — viewer sees only Open reports
        const queries = [
          { indexUid: INDEX.CUSTOMERS, q, limit: 5 },
          {
            indexUid: INDEX.REPORTS,
            q,
            limit: 5,
            ...(isViewer ? { filter: "status = Open" } : {}),
          },
          { indexUid: INDEX.TEMPLATES, q, limit: 5 },
        ];

        const { results: multiResults } = await client.multiSearch({ queries });

        const categories: CategoryResult[] = [];

        // Customers
        const custResult = multiResults[0];
        if (custResult && custResult.hits.length > 0) {
          categories.push({
            category: "Customers",
            icon: <CustomersIcon />,
            hits: custResult.hits as SearchHit[],
            getTitle: (h) => (h.name as string) || "Untitled",
            getSubtitle: (h) => (h.email as string) || undefined,
            getHref: (h) => `/customers`,
          });
        }

        // Reports
        const repResult = multiResults[1];
        if (repResult && repResult.hits.length > 0) {
          categories.push({
            category: "Reports",
            icon: <ReportsIcon />,
            hits: repResult.hits as SearchHit[],
            getTitle: (h) => (h.title as string) || "Untitled",
            getSubtitle: (h) => {
              const parts: string[] = [];
              if (h.reportIdCustom) parts.push(h.reportIdCustom as string);
              if (h.customerName) parts.push(h.customerName as string);
              return parts.join(" · ") || undefined;
            },
            getHref: (h) => `/reports/${h.id}/edit`,
          });
        }

        // Templates
        const tplResult = multiResults[2];
        if (tplResult && tplResult.hits.length > 0) {
          categories.push({
            category: "Templates",
            icon: <TemplatesIcon />,
            hits: tplResult.hits as SearchHit[],
            getTitle: (h) => (h.title as string) || "Untitled",
            getSubtitle: (h) => {
              const parts: string[] = [];
              if (h.severity) parts.push(h.severity as string);
              if (h.cvssScore) parts.push(`CVSS ${h.cvssScore}`);
              return parts.join(" · ") || undefined;
            },
            getHref: (h) => `/kb/templates/${h.id}/edit`,
          });
        }

        setResults(categories);
        setActiveIndex(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [isViewer],
  );

  // ─── Debounced search on query change ───
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => search(query), 200);
    return () => clearTimeout(timer);
  }, [query, search, open]);

  // ─── Navigate to item ───
  function navigateTo(item: { title: string; href: string; category: string }) {
    addRecentSearch({ title: item.title, href: item.href, category: item.category });
    router.push(item.href);
    onClose();
  }

  // ─── Keyboard navigation ───
  function handleKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    const totalItems = query.trim() ? flatItems.length : recentSearches.length;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % Math.max(totalItems, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + Math.max(totalItems, 1)) % Math.max(totalItems, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (query.trim() && flatItems[activeIndex]) {
        navigateTo(flatItems[activeIndex]);
      } else if (!query.trim() && recentSearches[activeIndex]) {
        navigateTo(recentSearches[activeIndex]);
      }
    } else if (e.key === "Escape") {
      handleClose();
    }
  }

  // ─── Scroll active item into view ───
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const activeEl = container.querySelector(`[data-index="${activeIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  if (!open) return null;

  // ─── Render ─────────────────────────────────────────────
  let flatIndex = -1;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh]">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ease-out ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div className={`relative z-10 mx-4 w-full max-w-xl overflow-hidden rounded-xl border border-stroke bg-white shadow-2xl transition-all duration-200 ease-out dark:border-dark-3 dark:bg-dark-2 ${
        visible
          ? "translate-y-0 scale-100 opacity-100"
          : "-translate-y-4 scale-95 opacity-0"
      }`}>
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-stroke px-4 dark:border-dark-3">
          <svg
            className="shrink-0 text-dark-5 dark:text-dark-6"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
          >
            <path
              d="M9.16667 15.8333C12.8486 15.8333 15.8333 12.8486 15.8333 9.16667C15.8333 5.48477 12.8486 2.5 9.16667 2.5C5.48477 2.5 2.5 5.48477 2.5 9.16667C2.5 12.8486 5.48477 15.8333 9.16667 15.8333Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M17.5 17.5L13.875 13.875"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search customers, reports, templates…"
            className="flex-1 bg-transparent py-3.5 text-sm text-dark outline-none placeholder:text-dark-5 dark:text-white dark:placeholder:text-dark-6"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="rounded p-1 text-dark-5 hover:text-dark dark:text-dark-6 dark:hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
          <kbd className="hidden rounded border border-stroke px-1.5 py-0.5 text-[10px] font-medium text-dark-5 dark:border-dark-3 dark:text-dark-6 sm:inline-block">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto overscroll-contain">
          {/* Loading */}
          {loading && query.trim() && (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {/* Results list */}
          {!loading && query.trim() && results.length > 0 && (
            <div className="py-2">
              {results.map((cat, catIdx) => (
                <div
                  key={cat.category}
                  className="animate-fade-slide-up"
                  style={{ animationDelay: `${catIdx * 60}ms` }}
                >
                  {/* Category header */}
                  <div className="flex items-center gap-2 px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-dark-5 dark:text-dark-6">
                    {cat.icon}
                    {cat.category}
                  </div>

                  {/* Hits */}
                  {cat.hits.map((hit) => {
                    flatIndex++;
                    const idx = flatIndex;
                    const isActive = idx === activeIndex;

                    return (
                      <button
                        key={hit.id}
                        data-index={idx}
                        type="button"
                        onClick={() =>
                          navigateTo({
                            title: cat.getTitle(hit),
                            href: cat.getHref(hit),
                            category: cat.category,
                          })
                        }
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-all duration-150 ${
                          isActive
                            ? "bg-primary/10 text-primary dark:bg-primary/20"
                            : "text-dark hover:bg-gray-2 dark:text-white dark:hover:bg-dark-3"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">
                            {cat.getTitle(hit)}
                          </div>
                          {cat.getSubtitle?.(hit) && (
                            <div className="truncate text-xs text-dark-5 dark:text-dark-6">
                              {cat.getSubtitle(hit)}
                            </div>
                          )}
                        </div>
                        {isActive && (
                          <span className="shrink-0 text-dark-5 dark:text-dark-6">
                            <ReturnIcon />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* No results */}
          {!loading && query.trim() && results.length === 0 && (
            <div className="py-10 text-center text-sm text-dark-5 dark:text-dark-6 animate-fade-in">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Empty state: recent searches */}
          {!query.trim() && !loading && (
            <div className="py-2">
              {recentSearches.length > 0 ? (
                <>
                  <div className="flex items-center justify-between px-4 pb-1 pt-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-dark-5 dark:text-dark-6">
                      Recent
                    </span>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="rounded px-1.5 py-0.5 text-[11px] font-medium text-dark-5 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-dark-6 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                    >
                      Clear all
                    </button>
                  </div>
                  {recentSearches.map((item, i) => {
                    const isActive = i === activeIndex;
                    const isRemoving = removing.has(item.href);
                    return (
                      <div
                        key={item.href + i}
                        className={`transition-all duration-200 ease-out ${
                          isRemoving
                            ? "max-h-0 opacity-0 -translate-x-4 overflow-hidden"
                            : "max-h-20 opacity-100 translate-x-0"
                        }`}
                      >
                        <button
                          data-index={i}
                          type="button"
                          onClick={() => navigateTo(item)}
                          onMouseEnter={() => setActiveIndex(i)}
                          className={`group flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-all duration-150 ${
                            isActive
                              ? "bg-primary/10 text-primary dark:bg-primary/20"
                              : "text-dark hover:bg-gray-2 dark:text-white dark:hover:bg-dark-3"
                          }`}
                        >
                          <svg className="shrink-0 text-dark-5 dark:text-dark-6" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{item.title}</div>
                            <div className="text-xs text-dark-5 dark:text-dark-6">
                              {item.category}
                            </div>
                          </div>
                          <span
                            role="button"
                            tabIndex={-1}
                            onClick={(e) => handleRemoveRecent(e, item.href)}
                            className="shrink-0 rounded p-1 text-dark-5 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:text-dark-6 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                            title="Remove from recent"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </span>
                          {isActive && !removing.has(item.href) && (
                            <span className="shrink-0 text-dark-5 dark:text-dark-6">
                              <ReturnIcon />
                            </span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="py-10 text-center text-sm text-dark-5 dark:text-dark-6 animate-fade-in">
                  Start typing to search…
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-stroke px-4 py-2.5 dark:border-dark-3">
          <div className="flex items-center gap-3 text-xs text-dark-5 dark:text-dark-6">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-stroke px-1 py-0.5 text-[10px] dark:border-dark-3">↑</kbd>
              <kbd className="rounded border border-stroke px-1 py-0.5 text-[10px] dark:border-dark-3">↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-stroke px-1 py-0.5 text-[10px] dark:border-dark-3">↵</kbd>
              open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-stroke px-1 py-0.5 text-[10px] dark:border-dark-3">esc</kbd>
              close
            </span>
          </div>
          <span className="text-[10px] text-dark-5/50 dark:text-dark-6/50">
            Powered by Meilisearch
          </span>
        </div>
      </div>
    </div>
  );
}
