"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
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
import {
  createCustomerAction,
  updateCustomerAction,
  deleteCustomerAction,
} from "@/lib/actions/customer";
import { TablePagination, usePagination } from "@/components/ui/table-pagination";
import { isDevClient } from "@/lib/env";
import { seedCustomersAction } from "@/lib/actions/seed-actions";
import type { Customer } from "@/lib/db/schema";
import type { ActionResult } from "@/lib/actions/customer";
import CustomerFormModal from "./customer-form-modal";

interface CustomersClientProps {
  customers: Customer[];
}

export default function CustomersClient({ customers }: CustomersClientProps) {
  const { canEditCustomers } = useRole();
  const { addToast } = useToast();
  const router = useRouter();

  // ─── Modal state ───
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // ─── Delete state ───
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ─── Create action ───
  const [createState, createAction, createPending] = useActionState<
    ActionResult | null,
    FormData
  >(createCustomerAction, null);

  // ─── Update action ───
  const [updateState, updateAction, updatePending] = useActionState<
    ActionResult | null,
    FormData
  >(updateCustomerAction, null);

  // Handle create success/error
  useEffect(() => {
    if (createState?.success) {
      addToast("Customer created successfully.", "success");
      setModalOpen(false);
      router.refresh();
    } else if (createState?.error) {
      addToast(createState.error, "error");
    }
  }, [createState, addToast, router]);

  // Handle update success/error
  useEffect(() => {
    if (updateState?.success) {
      addToast("Customer updated successfully.", "success");
      setModalOpen(false);
      setEditingCustomer(null);
      router.refresh();
    } else if (updateState?.error) {
      addToast(updateState.error, "error");
    }
  }, [updateState, addToast, router]);

  // ─── Handlers ───
  function handleCreate() {
    setEditingCustomer(null);
    setModalOpen(true);
  }

  function handleEdit(customer: Customer) {
    setEditingCustomer(customer);
    setModalOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);

    const result = await deleteCustomerAction(deleteTarget.id);

    if (result.success) {
      addToast("Customer deleted successfully.", "success");
      router.refresh();
    } else {
      addToast(result.error || "Failed to delete customer.", "error");
    }

    setDeleteLoading(false);
    setDeleteTarget(null);
  }

  const isPending = createPending || updatePending;

  const [seedLoading, setSeedLoading] = useState(false);

  async function handleSeedCustomers() {
    setSeedLoading(true);
    try {
      const result = await seedCustomersAction();
      if (result.success) {
        addToast(`Seeded ${result.count ?? 0} dummy customers.`, "success");
        router.refresh();
      } else {
        addToast(result.error ?? "Seed failed", "error");
      }
    } catch {
      addToast("Unexpected error while seeding.", "error");
    } finally {
      setSeedLoading(false);
    }
  }

  // ─── Search & filter ───
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name-asc" | "name-desc">("newest");

  const filteredCustomers = useMemo(() => {
    let filtered = customers;

    // Search by name or email
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
      );
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "oldest":
          return (
            new Date(a.createdAt || 0).getTime() -
            new Date(b.createdAt || 0).getTime()
          );
        case "newest":
        default:
          return (
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
          );
      }
    });

    return filtered;
  }, [customers, searchQuery, sortBy]);

  const { paginatedItems, paginationProps } = usePagination(filteredCustomers);

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark dark:text-white">
            Customers
          </h2>
          <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
            Manage client data for pentest reports
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isDevClient && canEditCustomers && (
            <button
              type="button"
              onClick={handleSeedCustomers}
              disabled={seedLoading}
              className="rounded-lg border border-dashed border-amber-500/50 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-400/30 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/40"
            >
              {seedLoading ? "Seeding..." : "Seed Customers"}
            </button>
          )}
          {canEditCustomers && (
            <button
              type="button"
              onClick={handleCreate}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              + Add Customer
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-5 dark:text-dark-6"
            width="16"
            height="16"
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
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or code…"
            className="w-full rounded-lg border border-stroke bg-white py-2.5 pl-10 pr-4 text-sm text-dark outline-none transition-colors placeholder:text-dark-5 focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:placeholder:text-dark-6 dark:focus:border-primary"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-dark-5 transition-colors hover:text-dark dark:text-dark-6 dark:hover:text-white"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="rounded-lg border border-stroke bg-white px-3 py-2.5 text-sm text-dark outline-none transition-colors focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name-asc">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
        </select>

        {/* Result count */}
        {searchQuery.trim() && (
          <span className="shrink-0 text-xs text-dark-5 dark:text-dark-6">
            {filteredCustomers.length} result{filteredCustomers.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Created</TableHead>
              {canEditCustomers && (
                <TableHead className="pr-5 text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canEditCustomers ? 4 : 3}
                  className="py-10 text-center text-dark-5 dark:text-dark-6"
                >
                  No customers yet.{" "}
                  {canEditCustomers && "Click \"+ Add Customer\" to create one."}
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="pl-5 font-medium text-dark dark:text-white">
                    {customer.name}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-dark-5 dark:text-dark-6">
                    {customer.code}
                  </TableCell>
                  <TableCell className="text-dark-5 dark:text-dark-6">
                    {customer.createdAt
                      ? new Date(customer.createdAt).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  {canEditCustomers && (
                    <TableCell className="pr-5 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(customer)}
                          className="rounded-md px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(customer)}
                          className="rounded-md px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {filteredCustomers.length > 0 && (
          <TablePagination {...paginationProps} />
        )}
      </div>

      {/* Create/Edit Modal */}
      <CustomerFormModal
        open={modalOpen}
        customer={editingCustomer}
        onClose={() => {
          setModalOpen(false);
          setEditingCustomer(null);
        }}
        action={editingCustomer ? updateAction : createAction}
        pending={isPending}
        state={editingCustomer ? updateState : createState}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Customer"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
