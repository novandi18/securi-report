"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TablePagination,
  usePagination,
} from "@/components/ui/table-pagination";

export interface PickableTemplate {
  id: string;
  title: string;
  severity: string | null;
  cvssScore: string | null;
  cvssVector: string | null;
  description: string | null;
  impact: string | null;
  recommendation: string | null;
  referencesLink: string | null;
  cweId: number | null;
  owaspId: number | null;
  cweTitle: string | null;
  owaspCode: string | null;
  owaspTitle: string | null;
}

interface TemplatePickerModalProps {
  open: boolean;
  templates: PickableTemplate[];
  onSelect: (template: PickableTemplate) => void;
  onClose: () => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  Critical: "bg-red-600 text-white",
  High: "bg-red-500 text-white",
  Medium: "bg-orange-500 text-white",
  Low: "bg-yellow-500 text-dark",
  Info: "bg-blue-500 text-white",
  None: "bg-gray-400 text-white",
};

export default function TemplatePickerModal({
  open,
  templates,
  onSelect,
  onClose,
}: TemplatePickerModalProps) {
  const [search, setSearch] = useState("");

  const filtered = templates.filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.cweTitle &&
        t.cweTitle.toLowerCase().includes(search.toLowerCase())) ||
      (t.owaspCode &&
        t.owaspCode.toLowerCase().includes(search.toLowerCase())) ||
      (t.severity &&
        t.severity.toLowerCase().includes(search.toLowerCase())),
  );

  const { paginatedItems, paginationProps } = usePagination(filtered, 10);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[10vh]">
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-xl dark:bg-gray-dark">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stroke p-5 dark:border-dark-3">
          <div>
            <h3 className="text-lg font-semibold text-dark dark:text-white">
              Import from Finding Template
            </h3>
            <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
              Select a template to auto-fill report fields
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-dark-5 transition-colors hover:bg-gray-2 hover:text-dark dark:text-dark-6 dark:hover:bg-dark-3 dark:hover:text-white"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 5L5 15M5 5l10 10" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-stroke px-5 py-3 dark:border-dark-3">
          <input
            type="text"
            placeholder="Search templates by title, severity, CWE, OWASP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm outline-none transition focus:border-primary dark:border-dark-3 dark:focus:border-primary"
            autoFocus
          />
        </div>

        {/* Table */}
        <div className="max-h-[50vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Title</TableHead>
                <TableHead className="w-28">Severity</TableHead>
                <TableHead className="w-20">CVSS</TableHead>
                <TableHead className="hidden md:table-cell">CWE</TableHead>
                <TableHead className="hidden md:table-cell">OWASP</TableHead>
                <TableHead className="w-24 pr-5 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-dark-5 dark:text-dark-6"
                  >
                    {templates.length === 0
                      ? "No finding templates available. Create some in Knowledge Base first."
                      : "No templates match your search."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="pl-5 font-medium text-dark dark:text-white">
                      {template.title}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${SEVERITY_COLORS[template.severity || "None"]}`}
                      >
                        {template.severity || "None"}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {template.cvssScore ?? "0.0"}
                    </TableCell>
                    <TableCell className="hidden text-dark-5 dark:text-dark-6 md:table-cell">
                      {template.cweId
                        ? `CWE-${template.cweId}`
                        : "—"}
                    </TableCell>
                    <TableCell className="hidden text-dark-5 dark:text-dark-6 md:table-cell">
                      {template.owaspCode ?? "—"}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <button
                        type="button"
                        onClick={() => onSelect(template)}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90"
                      >
                        Use
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {filtered.length > 0 && <TablePagination {...paginationProps} />}

        {/* Footer */}
        <div className="flex justify-end border-t border-stroke px-5 py-3 dark:border-dark-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-stroke px-5 py-2 text-sm font-medium text-dark transition-colors hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
