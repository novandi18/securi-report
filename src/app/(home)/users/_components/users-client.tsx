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
  createUserAction,
  updateUserAction,
  deleteUserAction,
  resetUserPasswordAction,
} from "@/lib/actions/user";
import { TablePagination, usePagination } from "@/components/ui/table-pagination";
import { isDevClient } from "@/lib/env";
import { seedUsersAction } from "@/lib/actions/seed-actions";
import type { ActionResult } from "@/lib/actions/user";
import UserFormModal from "./user-form-modal";

interface UserData {
  id: string;
  username: string;
  email: string;
  role: "administrator" | "editor" | "viewer" | null;
  lastLogin: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  mustChangePassword: boolean | null;
  resetRequestPending: boolean | null;
}

interface UsersClientProps {
  users: UserData[];
  currentUserId: string;
}

export default function UsersClient({
  users,
  currentUserId,
}: UsersClientProps) {
  const { isAdmin } = useRole();
  const { addToast } = useToast();
  const router = useRouter();

  // ─── Modal state ───
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);

  // ─── Delete state ───
  const [deleteTarget, setDeleteTarget] = useState<UserData | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ─── Reset password state ───
  const [resetTarget, setResetTarget] = useState<UserData | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  // ─── Generated credentials dialog ───
  const [credentialsInfo, setCredentialsInfo] = useState<{
    username: string;
    email: string;
    password: string;
    emailSent: boolean;
  } | null>(null);

  // ─── Create action ───
  const [createState, createAction, createPending] = useActionState<
    ActionResult | null,
    FormData
  >(createUserAction, null);

  // ─── Update action ───
  const [updateState, updateAction, updatePending] = useActionState<
    ActionResult | null,
    FormData
  >(updateUserAction, null);

  // Handle create success/error
  useEffect(() => {
    if (createState?.success) {
      setModalOpen(false);
      if (createState.generatedPassword) {
        setCredentialsInfo({
          username: createState.values?.username || "(unknown)",
          email: createState.values?.email || "",
          password: createState.generatedPassword,
          emailSent: createState.emailSent ?? false,
        });
      }
      addToast("User created successfully.", "success");
      router.refresh();
    } else if (createState?.error) {
      addToast(createState.error, "error");
    }
  }, [createState, addToast, router]);

  // Handle update success/error
  useEffect(() => {
    if (updateState?.success) {
      addToast("User updated successfully.", "success");
      setModalOpen(false);
      setEditingUser(null);
      router.refresh();
    } else if (updateState?.error) {
      addToast(updateState.error, "error");
    }
  }, [updateState, addToast, router]);

  // ─── Handlers ───
  function handleCreate() {
    setEditingUser(null);
    setModalOpen(true);
  }

  function handleEdit(user: UserData) {
    setEditingUser(user);
    setModalOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);

    const result = await deleteUserAction(deleteTarget.id);

    if (result.success) {
      addToast("User deleted successfully.", "success");
      router.refresh();
    } else {
      addToast(result.error || "Failed to delete user.", "error");
    }

    setDeleteLoading(false);
    setDeleteTarget(null);
  }

  async function handleResetPassword() {
    if (!resetTarget) return;
    setResetLoading(true);

    const result = await resetUserPasswordAction(resetTarget.id);

    if (result.success) {
      if (result.generatedPassword) {
        setCredentialsInfo({
          username: resetTarget.username,
          email: resetTarget.email,
          password: result.generatedPassword,
          emailSent: result.emailSent ?? false,
        });
      }
      addToast(`Password reset for "${resetTarget.username}".`, "success");
      router.refresh();
    } else {
      addToast(result.error || "Failed to reset password.", "error");
    }

    setResetLoading(false);
    setResetTarget(null);
  }

  // Check if there's already an admin (for disabling admin role in create)
  const hasAdmin = users.some((u) => u.role === "administrator");

  const isPending = createPending || updatePending;

  const [seedLoading, setSeedLoading] = useState(false);

  async function handleSeedUsers() {
    setSeedLoading(true);
    try {
      const result = await seedUsersAction();
      if (result.success) {
        addToast(`Seeded ${result.count ?? 0} dummy users (password: password123).`, "success");
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
  const [roleFilter, setRoleFilter] = useState<"" | "administrator" | "editor" | "viewer">("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name-asc" | "name-desc">("newest");

  const filteredUsers = useMemo(() => {
    let filtered = users;

    // Search by username or email
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      );
    }

    // Filter by role
    if (roleFilter) {
      filtered = filtered.filter((u) => u.role === roleFilter);
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.username.localeCompare(b.username);
        case "name-desc":
          return b.username.localeCompare(a.username);
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
  }, [users, searchQuery, roleFilter, sortBy]);

  const { paginatedItems, paginationProps } = usePagination(filteredUsers);

  const activeFilterCount = (searchQuery.trim() ? 1 : 0) + (roleFilter ? 1 : 0);

  function handleClearFilters() {
    setSearchQuery("");
    setRoleFilter("");
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark dark:text-white">
            Users
          </h2>
          <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
            Manage team access with Single Administrator constraint
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isDevClient && isAdmin && (
            <button
              type="button"
              onClick={handleSeedUsers}
              disabled={seedLoading}
              className="rounded-lg border border-dashed border-amber-500/50 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-400/30 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/40"
            >
              {seedLoading ? "Seeding..." : "Seed Users"}
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={handleCreate}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              + Add User
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
            placeholder="Search by username or email…"
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

        {/* Role filter */}
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
          className="rounded-lg border border-stroke bg-white px-3 py-2.5 text-sm text-dark outline-none transition-colors focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
        >
          <option value="">All roles</option>
          <option value="administrator">Administrator</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>

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

        {/* Active filter info & clear */}
        {activeFilterCount > 0 && (
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-dark-5 dark:text-dark-6">
              {filteredUsers.length} result{filteredUsers.length !== 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded-md px-2 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="pr-5 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-dark-5 dark:text-dark-6"
                >
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="pl-5 font-medium text-dark dark:text-white">
                    <div className="flex items-center gap-2">
                      {user.username}
                      {user.id === currentUserId && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          You
                        </span>
                      )}
                      {user.resetRequestPending && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          Reset Requested
                        </span>
                      )}
                      {user.mustChangePassword && (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                          Must Change PW
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-dark-5 dark:text-dark-6">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        user.role === "administrator"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : user.role === "editor"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-400"
                      }`}
                    >
                      {user.role}
                    </span>
                  </TableCell>
                  <TableCell className="text-dark-5 dark:text-dark-6">
                    {user.lastLogin
                      ? new Date(user.lastLogin).toLocaleString()
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-dark-5 dark:text-dark-6">
                    {user.createdAt
                      ? new Date(user.createdAt).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(user)}
                        className="rounded-md px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                      >
                        Edit
                      </button>
                      {user.id !== currentUserId && user.role !== "administrator" && (
                        <button
                          type="button"
                          onClick={() => setResetTarget(user)}
                          className="rounded-md px-3 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-500/10 dark:text-amber-400"
                        >
                          Reset PW
                        </button>
                      )}
                      {user.id !== currentUserId && user.role !== "administrator" && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(user)}
                          className="rounded-md px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {filteredUsers.length > 0 && (
          <TablePagination {...paginationProps} />
        )}
      </div>

      {/* Create/Edit Modal */}
      <UserFormModal
        open={modalOpen}
        user={editingUser}
        onClose={() => {
          setModalOpen(false);
          setEditingUser(null);
        }}
        action={editingUser ? updateAction : createAction}
        pending={isPending}
        state={editingUser ? updateState : createState}
        hasAdmin={hasAdmin}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete User"
        message={`Are you sure you want to delete "${deleteTarget?.username}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Reset Password Confirmation */}
      <ConfirmDialog
        open={!!resetTarget}
        title="Reset Password"
        message={`Reset password for "${resetTarget?.username}"? A new auto-generated password will be sent to their email.`}
        confirmLabel="Reset Password"
        variant="danger"
        loading={resetLoading}
        onConfirm={handleResetPassword}
        onCancel={() => setResetTarget(null)}
      />

      {/* Generated Credentials Dialog */}
      {credentialsInfo && (
        <dialog
          open
          className="fixed inset-0 z-[9999] m-auto w-full max-w-md rounded-xl border border-stroke bg-white p-0 shadow-2xl backdrop:bg-black/50 dark:border-dark-3 dark:bg-dark-2"
        >
          <div className="border-b border-stroke px-6 py-4 dark:border-dark-3">
            <h3 className="text-lg font-semibold text-dark dark:text-white">
              Generated Credentials
            </h3>
          </div>
          <div className="p-6">
            {!credentialsInfo.emailSent && (
              <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-600/50 dark:bg-amber-900/20">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  ⚠️ Email delivery failed. Please share the credentials below manually with the user.
                </p>
              </div>
            )}
            {credentialsInfo.emailSent && (
              <div className="mb-4 rounded-lg border border-green-300 bg-green-50 p-3 dark:border-green-600/50 dark:bg-green-900/20">
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  ✓ Credentials sent via email. You can also copy them below.
                </p>
              </div>
            )}

            <div className="space-y-3 rounded-lg border border-stroke bg-gray-1 p-4 dark:border-dark-3 dark:bg-dark-3">
              <div>
                <span className="text-xs font-medium text-dark-5 dark:text-dark-6">Username</span>
                <p className="font-mono text-sm text-dark dark:text-white">{credentialsInfo.username}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-dark-5 dark:text-dark-6">Email</span>
                <p className="font-mono text-sm text-dark dark:text-white">{credentialsInfo.email}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-dark-5 dark:text-dark-6">Password</span>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-white px-3 py-1.5 font-mono text-sm text-dark dark:bg-dark-2 dark:text-white">
                    {credentialsInfo.password}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(credentialsInfo.password);
                      addToast("Password copied to clipboard.", "success");
                    }}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>

            <p className="mt-3 text-xs text-dark-5 dark:text-dark-6">
              The user will be required to change this password on first login.
            </p>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setCredentialsInfo(null)}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
              >
                Done
              </button>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
