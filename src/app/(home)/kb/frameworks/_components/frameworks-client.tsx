"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/use-role";
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
import InputGroup from "@/components/FormElements/InputGroup";
import { Select } from "@/components/FormElements/select";
import { TablePagination, usePagination } from "@/components/ui/table-pagination";
import {
  createCweEntryAction,
  createOwaspEntryAction,
  deleteCweEntryAction,
  deleteOwaspEntryAction,
  seedFrameworksAction,
} from "@/lib/actions/framework";
import type { CweEntry, OwaspEntry } from "@/lib/db/schema";
import type { ActionResult } from "@/lib/actions/framework";

interface FrameworksClientProps {
  cweEntries: CweEntry[];
  owaspEntries: OwaspEntry[];
}

export default function FrameworksClient({
  cweEntries,
  owaspEntries,
}: FrameworksClientProps) {
  const { isAdmin } = useRole();
  const { addToast } = useToast();
  const router = useRouter();

  // ─── Tab state ───
  const [activeTab, setActiveTab] = useState<"cwe" | "owasp">("cwe");

  // ─── CWE Modal ───
  const [cweModalOpen, setCweModalOpen] = useState(false);

  // ─── OWASP Modal ───
  const [owaspModalOpen, setOwaspModalOpen] = useState(false);

  // ─── Delete state ───
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "cwe" | "owasp";
    id: number;
    label: string;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ─── Seed state ───
  const [seedLoading, setSeedLoading] = useState(false);

  // ─── CWE create action ───
  const [cweState, cweAction, cwePending] = useActionState<
    ActionResult | null,
    FormData
  >(createCweEntryAction, null);

  // ─── OWASP create action ───
  const [owaspState, owaspAction, owaspPending] = useActionState<
    ActionResult | null,
    FormData
  >(createOwaspEntryAction, null);

  // Handle CWE create
  useEffect(() => {
    if (cweState?.success) {
      addToast("CWE entry created successfully.", "success");
      setCweModalOpen(false);
      router.refresh();
    } else if (cweState?.error) {
      addToast(cweState.error, "error");
    }
  }, [cweState, addToast, router]);

  // Handle OWASP create
  useEffect(() => {
    if (owaspState?.success) {
      addToast("OWASP entry created successfully.", "success");
      setOwaspModalOpen(false);
      router.refresh();
    } else if (owaspState?.error) {
      addToast(owaspState.error, "error");
    }
  }, [owaspState, addToast, router]);

  // ─── Delete handler ───
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);

    const result =
      deleteTarget.type === "cwe"
        ? await deleteCweEntryAction(deleteTarget.id)
        : await deleteOwaspEntryAction(deleteTarget.id);

    if (result.success) {
      addToast(`${deleteTarget.label} deleted successfully.`, "success");
      router.refresh();
    } else {
      addToast(result.error || "Failed to delete entry.", "error");
    }

    setDeleteLoading(false);
    setDeleteTarget(null);
  }

  // ─── Seed handler ───
  async function handleSeed() {
    setSeedLoading(true);
    const result = await seedFrameworksAction();

    if (result.success) {
      addToast(
        "Standard CWE & OWASP data imported successfully.",
        "success",
      );
      router.refresh();
    } else {
      addToast(result.error || "Failed to import data.", "error");
    }
    setSeedLoading(false);
  }

  // ─── Search ───
  const [cweSearch, setCweSearch] = useState("");
  const [owaspSearch, setOwaspSearch] = useState("");

  const filteredCwe = cweEntries.filter(
    (e) =>
      String(e.id).includes(cweSearch) ||
      e.title.toLowerCase().includes(cweSearch.toLowerCase()),
  );

  const filteredOwasp = owaspEntries.filter(
    (e) =>
      e.code.toLowerCase().includes(owaspSearch.toLowerCase()) ||
      e.title.toLowerCase().includes(owaspSearch.toLowerCase()),
  );

  const { paginatedItems: paginatedCwe, paginationProps: cwePaginationProps } = usePagination(filteredCwe);
  const { paginatedItems: paginatedOwasp, paginationProps: owaspPaginationProps } = usePagination(filteredOwasp);

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark dark:text-white">
            Security Frameworks
          </h2>
          <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
            Manage CWE and OWASP Top 10 master data
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={handleSeed}
            disabled={seedLoading}
            className="rounded-lg border border-primary px-5 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-white disabled:opacity-50"
          >
            {seedLoading ? "Importing..." : "Import Standard Data"}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("cwe")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "cwe"
              ? "bg-primary text-white"
              : "bg-white text-dark-5 hover:bg-gray-2 dark:bg-dark-2 dark:text-dark-6 dark:hover:bg-dark-3"
          }`}
        >
          CWE ({cweEntries.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("owasp")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "owasp"
              ? "bg-primary text-white"
              : "bg-white text-dark-5 hover:bg-gray-2 dark:bg-dark-2 dark:text-dark-6 dark:hover:bg-dark-3"
          }`}
        >
          OWASP ({owaspEntries.length})
        </button>
      </div>

      {/* ═══ CWE Tab ═══ */}
      {activeTab === "cwe" && (
        <div className="rounded-xl border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          {/* CWE Header */}
          <div className="flex items-center justify-between border-b border-stroke p-5 dark:border-dark-3">
            <input
              type="text"
              placeholder="Search CWE..."
              value={cweSearch}
              onChange={(e) => setCweSearch(e.target.value)}
              className="w-64 rounded-lg border border-stroke bg-transparent px-4 py-2 text-sm outline-none transition focus:border-primary dark:border-dark-3 dark:focus:border-primary"
            />
            {isAdmin && (
              <button
                type="button"
                onClick={() => setCweModalOpen(true)}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
              >
                + Add CWE
              </button>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24 pl-5">CWE ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="hidden md:table-cell">
                  Description
                </TableHead>
                {isAdmin && (
                  <TableHead className="w-24 pr-5 text-right">
                    Actions
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedCwe.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 4 : 3}
                    className="py-10 text-center text-dark-5 dark:text-dark-6"
                  >
                    No CWE entries found.
                    {isAdmin &&
                      ' Click "Import Standard Data" to populate.'}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCwe.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="pl-5 font-mono font-medium text-primary">
                      CWE-{entry.id}
                    </TableCell>
                    <TableCell className="font-medium text-dark dark:text-white">
                      {entry.title}
                    </TableCell>
                    <TableCell
                      className="hidden max-w-sm truncate text-dark-5 dark:text-dark-6 md:table-cell"
                      title={entry.description || undefined}
                    >
                      {entry.description || "—"}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="pr-5 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              type: "cwe",
                              id: entry.id,
                              label: `CWE-${entry.id}`,
                            })
                          }
                          className="rounded-md px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {filteredCwe.length > 0 && (
            <TablePagination {...cwePaginationProps} />
          )}
        </div>
      )}

      {/* ═══ OWASP Tab ═══ */}
      {activeTab === "owasp" && (
        <div className="rounded-xl border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          {/* OWASP Header */}
          <div className="flex items-center justify-between border-b border-stroke p-5 dark:border-dark-3">
            <input
              type="text"
              placeholder="Search OWASP..."
              value={owaspSearch}
              onChange={(e) => setOwaspSearch(e.target.value)}
              className="w-64 rounded-lg border border-stroke bg-transparent px-4 py-2 text-sm outline-none transition focus:border-primary dark:border-dark-3 dark:focus:border-primary"
            />
            {isAdmin && (
              <button
                type="button"
                onClick={() => setOwaspModalOpen(true)}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
              >
                + Add OWASP
              </button>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32 pl-5">Code</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-24">Version</TableHead>
                {isAdmin && (
                  <TableHead className="w-24 pr-5 text-right">
                    Actions
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedOwasp.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 4 : 3}
                    className="py-10 text-center text-dark-5 dark:text-dark-6"
                  >
                    No OWASP entries found.
                    {isAdmin &&
                      ' Click "Import Standard Data" to populate.'}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedOwasp.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="pl-5 font-mono font-medium text-primary">
                      {entry.code}
                    </TableCell>
                    <TableCell className="font-medium text-dark dark:text-white">
                      {entry.title}
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {entry.version}
                      </span>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="pr-5 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              type: "owasp",
                              id: entry.id,
                              label: entry.code,
                            })
                          }
                          className="rounded-md px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {filteredOwasp.length > 0 && (
            <TablePagination {...owaspPaginationProps} />
          )}
        </div>
      )}

      {/* ═══ CWE Add Modal ═══ */}
      {cweModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-gray-dark">
            <h3 className="mb-4 text-lg font-semibold text-dark dark:text-white">
              Add CWE Entry
            </h3>
            <form action={cweAction} className="space-y-4">
              <InputGroup
                label="CWE ID"
                name="id"
                type="number"
                placeholder="e.g. 79"
                required
              />
              <InputGroup
                label="Title"
                name="title"
                type="text"
                placeholder="e.g. Cross-site Scripting"
                required
              />
              <div>
                <label className="mb-2 block text-body-sm font-medium text-dark dark:text-white">
                  Description
                </label>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Optional description..."
                  className="w-full rounded-lg border border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:focus:border-primary"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCweModalOpen(false)}
                  className="rounded-lg border border-stroke px-5 py-2.5 text-sm font-medium text-dark transition-colors hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cwePending}
                  className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {cwePending ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ OWASP Add Modal ═══ */}
      {owaspModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-gray-dark">
            <h3 className="mb-4 text-lg font-semibold text-dark dark:text-white">
              Add OWASP Entry
            </h3>
            <form action={owaspAction} className="space-y-4">
              <InputGroup
                label="Code"
                name="code"
                type="text"
                placeholder="e.g. A01:2021"
                required
              />
              <InputGroup
                label="Title"
                name="title"
                type="text"
                placeholder="e.g. Broken Access Control"
                required
              />
              <Select
                label="Version"
                name="version"
                placeholder="Select version"
                items={[
                  { value: "2021", label: "2021" },
                  { value: "2025", label: "2025" },
                ]}
                required
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOwaspModalOpen(false)}
                  className="rounded-lg border border-stroke px-5 py-2.5 text-sm font-medium text-dark transition-colors hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={owaspPending}
                  className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {owaspPending ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Delete Confirm ═══ */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.label}?`}
        message="This will permanently remove this entry. Any templates linked to it will have their reference cleared."
        confirmLabel="Delete"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
