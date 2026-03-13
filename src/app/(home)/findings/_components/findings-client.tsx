"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRole } from "@/hooks/use-role";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { parseVector, calculateScore, getSeverityColor } from "@/lib/cvss4";
import {
  ResizableTable,
  ResizableTableBody,
  ResizableTableCell,
  ResizableTableHead,
  ResizableTableHeader,
  ResizableTableRow,
  useTableSort,
} from "@/components/ui/resizable-table";
import { deleteReportAction } from "@/lib/actions/report";
import { TablePagination, usePagination } from "@/components/ui/table-pagination";

export interface FindingRow {
  id: string;
  customerId: string;
  reportIdCustom: string | null;
  title: string;
  status: "Open" | "Closed" | "Draft" | null;
  cvssVector: string | null;
  auditDate: string | null;
  createdBy: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  customerName: string;
  creatorUsername: string | null;
  pdfUrl: string | null;
}

interface FindingsClientProps {
  findings: FindingRow[];
}

const STATUS_OPTIONS = ["Draft", "Open", "Closed"] as const;

const STATUS_BADGE: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  Open: {
    bg: "bg-green-100 dark:bg-green-500/20",
    text: "text-green-700 dark:text-green-400",
    label: "Open",
  },
  Closed: {
    bg: "bg-red-100 dark:bg-red-500/20",
    text: "text-red-600 dark:text-red-400",
    label: "Closed",
  },
  Draft: {
    bg: "bg-amber-100 dark:bg-amber-500/20",
    text: "text-amber-700 dark:text-amber-400",
    label: "Draft",
  },
};

export default function FindingsClient({ findings }: FindingsClientProps) {
  const { canEditReports, isAdmin, isEditor, user } = useRole();
  const { addToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // ─── Highlight newly created finding ───
  const highlightId = searchParams.get("highlight");
  const highlightRef = useRef<HTMLTableRowElement>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(highlightId);

  useEffect(() => {
    if (highlightId) {
      // Scroll to highlighted row
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
      // Clear highlight after animation
      const timer = setTimeout(() => setHighlightedId(null), 3000);
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete("highlight");
      window.history.replaceState({}, "", url.pathname + url.search);
      return () => clearTimeout(timer);
    }
  }, [highlightId]);

  // ─── Filters ───
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");

  const uniqueCustomers = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of findings) {
      map.set(f.customerId, f.customerName);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [findings]);

  const hasActiveFilters = !!(searchQuery || filterStatus || filterCustomer);

  const filteredFindings = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return findings.filter((f) => {
      if (query && !f.title.toLowerCase().includes(query)) return false;
      if (filterStatus && f.status !== filterStatus) return false;
      if (filterCustomer && f.customerId !== filterCustomer) return false;
      return true;
    });
  }, [findings, searchQuery, filterStatus, filterCustomer]);

  const { sortedData, handleSort, getSortDirection } = useTableSort(filteredFindings);
  const { paginatedItems, paginationProps } = usePagination(sortedData);

  // ─── Delete state ───
  const [deleteTarget, setDeleteTarget] = useState<FindingRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);

    const result = await deleteReportAction(deleteTarget.id);

    if (result.success) {
      addToast("Finding deleted successfully.", "success");
      router.refresh();
    } else {
      addToast(result.error || "Failed to delete finding.", "error");
    }

    setDeleteLoading(false);
    setDeleteTarget(null);
  }

  function canDelete(finding: FindingRow) {
    if (isAdmin) return true;
    if (isEditor) {
      return finding.status === "Draft" && finding.createdBy === user?.id;
    }
    return false;
  }

  function canEdit(finding: FindingRow) {
    if (isAdmin) return true;
    if (isEditor) return finding.status === "Draft";
    return false;
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark dark:text-white">
            Findings
          </h2>
          <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
            Manage security findings across all customers
          </p>
        </div>

        {canEditReports && (
          <div className="flex gap-2">
            <Link
              href="/findings/new-with-ai"
              className="rounded-lg border border-primary bg-transparent px-5 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              + New Finding with AI
            </Link>
            <Link
              href="/findings/new"
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              + New Finding
            </Link>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 space-y-3">
        <div className="relative max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title…"
            className="w-full rounded-lg border border-stroke bg-white py-2.5 pl-10 pr-4 text-sm text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-5 dark:text-dark-6"
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
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
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-stroke bg-white px-4 py-2.5 text-sm text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
            className="rounded-lg border border-stroke bg-white px-4 py-2.5 text-sm text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
          >
            <option value="">All Customers</option>
            {uniqueCustomers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setFilterStatus("");
                setFilterCustomer("");
              }}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-dark-5 transition-colors hover:text-dark dark:text-dark-6 dark:hover:text-white"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <ResizableTable>
          <ResizableTableHeader>
            <ResizableTableRow>
              <ResizableTableHead className="pl-5" sortable sortDirection={getSortDirection("reportIdCustom")} onSort={() => handleSort("reportIdCustom")}>Finding ID</ResizableTableHead>
              <ResizableTableHead sortable sortDirection={getSortDirection("title")} onSort={() => handleSort("title")}>Title</ResizableTableHead>
              <ResizableTableHead sortable sortDirection={getSortDirection("customerName")} onSort={() => handleSort("customerName")}>Customer</ResizableTableHead>
              <ResizableTableHead>Severity</ResizableTableHead>
              <ResizableTableHead sortable sortDirection={getSortDirection("status")} onSort={() => handleSort("status")}>Status</ResizableTableHead>
              <ResizableTableHead sortable sortDirection={getSortDirection("creatorUsername")} onSort={() => handleSort("creatorUsername")}>Pentester</ResizableTableHead>
              <ResizableTableHead sortable sortDirection={getSortDirection("createdAt")} onSort={() => handleSort("createdAt")}>Created</ResizableTableHead>
              {canEditReports && (
                <ResizableTableHead resizable={false} className="pr-5 text-right">Actions</ResizableTableHead>
              )}
            </ResizableTableRow>
          </ResizableTableHeader>
          <ResizableTableBody>
            {paginatedItems.length === 0 ? (
              <ResizableTableRow>
                <ResizableTableCell
                  colSpan={canEditReports ? 8 : 7}
                  className="py-10 text-center text-dark-5 dark:text-dark-6"
                >
                  {findings.length === 0
                    ? <>No findings yet. {canEditReports && 'Click "+ New Finding" to create one.'}</>
                    : "No findings match the current search or filters."}
                </ResizableTableCell>
              </ResizableTableRow>
            ) : (
              paginatedItems.map((finding) => {
                const status = finding.status ?? "Draft";
                const badge = STATUS_BADGE[status] ?? STATUS_BADGE.Draft;

                return (
                  <ResizableTableRow
                    key={finding.id}
                    ref={finding.id === highlightId ? highlightRef : undefined}
                    className={finding.id === highlightedId ? "animate-highlight-fade bg-primary/10 dark:bg-primary/20" : ""}
                  >
                    <ResizableTableCell className="pl-5 font-mono text-sm text-dark dark:text-white">
                      {finding.reportIdCustom || "\u2014"}
                    </ResizableTableCell>
                    <ResizableTableCell className="font-medium text-dark dark:text-white">
                      {finding.title}
                    </ResizableTableCell>
                    <ResizableTableCell className="text-dark-5 dark:text-dark-6">
                      {finding.customerName}
                    </ResizableTableCell>
                    <ResizableTableCell>
                      {(() => {
                        if (!finding.cvssVector) return <span className="text-dark-5 dark:text-dark-6">—</span>;
                        const metrics = parseVector(finding.cvssVector);
                        const { score, severity } = calculateScore(metrics);
                        const colorClass = getSeverityColor(severity);
                        return (
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${colorClass}`}
                            title={`CVSS 4.0: ${score.toFixed(1)}`}
                          >
                            {severity}
                          </span>
                        );
                      })()}
                    </ResizableTableCell>
                    <ResizableTableCell>
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}
                      >
                        {badge.label}
                      </span>
                    </ResizableTableCell>
                    <ResizableTableCell className="text-dark-5 dark:text-dark-6">
                      {finding.creatorUsername || "\u2014"}
                    </ResizableTableCell>
                    <ResizableTableCell className="text-dark-5 dark:text-dark-6">
                      {finding.createdAt
                        ? new Date(finding.createdAt).toLocaleDateString()
                        : "\u2014"}
                    </ResizableTableCell>
                    {canEditReports && (
                      <ResizableTableCell className="pr-5 text-right">
                        <div className="flex justify-end gap-2">
                          {finding.pdfUrl && (
                            <a
                              href={finding.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-md px-3 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-emerald-400"
                            >
                              View PDF
                            </a>
                          )}
                          {canEdit(finding) && (
                            <Link
                              href={`/reports/${finding.id}/edit`}
                              className="rounded-md px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                            >
                              Edit
                            </Link>
                          )}
                          {canDelete(finding) && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(finding)}
                              className="rounded-md px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </ResizableTableCell>
                    )}
                  </ResizableTableRow>
                );
              })
            )}
          </ResizableTableBody>
        </ResizableTable>
        {filteredFindings.length > 0 && (
          <TablePagination {...paginationProps} />
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Finding"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
