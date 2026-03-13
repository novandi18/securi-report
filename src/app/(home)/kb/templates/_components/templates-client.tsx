"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/use-role";
import { Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteTemplateAction } from "@/lib/actions/template";
import { TablePagination, usePagination } from "@/components/ui/table-pagination";

interface TemplateRow {
  id: string;
  title: string;
  severity: string | null;
  cvssScore: string | null;
  cvssVector: string | null;
  cweId: number | null;
  owaspId: number | null;
  cweTitle: string | null;
  owaspCode: string | null;
  owaspTitle: string | null;
  createdAt: Date | null;
}

interface TemplatesClientProps {
  templates: TemplateRow[];
}

const SEVERITY_COLORS: Record<string, string> = {
  Critical: "bg-red-600 text-white",
  High: "bg-red-500 text-white",
  Medium: "bg-orange-500 text-white",
  Low: "bg-yellow-500 text-dark",
  Info: "bg-blue-500 text-white",
  None: "bg-gray-400 text-white",
};

export default function TemplatesClient({ templates }: TemplatesClientProps) {
  const { isAdmin, isEditor, isViewer } = useRole();
  const canEdit = isAdmin || isEditor;
  const { addToast } = useToast();
  const router = useRouter();

  // ─── Search ───
  const [search, setSearch] = useState("");

  // ─── Delete state ───
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const filtered = templates.filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.cweTitle &&
        t.cweTitle.toLowerCase().includes(search.toLowerCase())) ||
      (t.owaspCode &&
        t.owaspCode.toLowerCase().includes(search.toLowerCase())),
  );

  const { paginatedItems, paginationProps } = usePagination(filtered);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);

    const result = await deleteTemplateAction(deleteTarget.id);
    if (result.success) {
      addToast("Template deleted successfully.", "success");
      router.refresh();
    } else {
      addToast(result.error || "Failed to delete template.", "error");
    }

    setDeleteLoading(false);
    setDeleteTarget(null);
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark dark:text-white">
            Finding Templates
          </h2>
          <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
            Reusable vulnerability finding library
          </p>
        </div>

        {canEdit && (
          <Link
            href="/kb/templates/add"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
          >
            + Add Template
          </Link>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        {/* Search */}
        <div className="border-b border-stroke p-5 dark:border-dark-3">
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded-lg border border-stroke bg-transparent px-4 py-2 text-sm outline-none transition focus:border-primary dark:border-dark-3 dark:focus:border-primary"
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Title</TableHead>
              <TableHead className="w-28">Severity</TableHead>
              <TableHead className="w-24">CVSS</TableHead>
              <TableHead className="hidden lg:table-cell">CWE</TableHead>
              <TableHead className="hidden lg:table-cell">OWASP</TableHead>
              {canEdit && (
                <TableHead className="w-32 pr-5 text-right">
                  Actions
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canEdit ? 6 : 5}
                  className="py-10 text-center text-dark-5 dark:text-dark-6"
                >
                  No templates found.
                  {canEdit &&
                    ' Click "+ Add Template" to create one.'}
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
                  <TableCell className="hidden text-dark-5 dark:text-dark-6 lg:table-cell">
                    {template.cweId
                      ? `CWE-${template.cweId}: ${template.cweTitle || ""}`
                      : "—"}
                  </TableCell>
                  <TableCell className="hidden text-dark-5 dark:text-dark-6 lg:table-cell">
                    {template.owaspCode
                      ? `${template.owaspCode}: ${template.owaspTitle || ""}`
                      : "—"}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="pr-5 text-right">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/kb/templates/${template.id}/edit`}
                          title="Edit"
                          className="rounded-md p-1.5 text-primary transition-colors hover:bg-primary/10"
                        >
                          <Pencil size={16} />
                        </Link>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              id: template.id,
                              title: template.title,
                            })
                          }
                          title="Delete"
                          className="rounded-md p-1.5 text-red-500 transition-colors hover:bg-red-500/10"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {filtered.length > 0 && (
          <TablePagination {...paginationProps} />
        )}
      </div>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.title}"?`}
        message="This will permanently remove this finding template."
        confirmLabel="Delete"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
