"use client";

import { useEffect, useRef } from "react";
import InputGroup from "@/components/FormElements/InputGroup";
import type { ActionResult } from "@/lib/actions/user";

interface UserData {
  id: string;
  username: string;
  email: string;
  role: "administrator" | "editor" | "viewer" | null;
  lastLogin: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface UserFormModalProps {
  open: boolean;
  user: UserData | null;
  onClose: () => void;
  action: (formData: FormData) => void;
  pending: boolean;
  state: ActionResult | null;
  hasAdmin: boolean;
}

export default function UserFormModal({
  open,
  user,
  onClose,
  action,
  pending,
  state,
  hasAdmin,
}: UserFormModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  const isEditing = !!user;
  const fieldErrors = state?.fieldErrors;

  // Use returned values on error, otherwise fall back to entity prop
  // Password fields are NEVER returned for security
  const v = state?.values;
  const val = {
    username: v?.username ?? user?.username ?? "",
    email: v?.email ?? user?.email ?? "",
    role: v?.role ?? user?.role ?? "viewer",
  };

  // Key forces React to re-mount form inputs with updated defaultValue
  const formKey = state && !state.success ? `err-${Date.now()}` : `clean-${user?.id ?? "new"}`;

  // Determine if admin role option should be disabled
  // - Creating: disable if admin already exists
  // - Editing: disable if the user is NOT already the admin AND an admin exists
  const adminRoleDisabled = isEditing
    ? user.role !== "administrator" && hasAdmin
    : hasAdmin;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-[9999] m-auto w-full max-w-lg rounded-xl border border-stroke bg-white p-0 shadow-2xl backdrop:bg-black/50 dark:border-dark-3 dark:bg-dark-2"
      onClose={onClose}
    >
      <div className="border-b border-stroke px-6 py-4 dark:border-dark-3">
        <h3 className="text-lg font-semibold text-dark dark:text-white">
          {isEditing ? "Edit User" : "Add User"}
        </h3>
      </div>

      <form key={formKey} action={action} className="p-6">
        {isEditing && <input type="hidden" name="id" value={user.id} />}

        <div className="space-y-4">
          <div>
            <InputGroup
              label="Username"
              name="username"
              type="text"
              placeholder="Enter username"
              required
              defaultValue={val.username}
            />
            {fieldErrors?.username && (
              <p className="mt-1 text-xs text-red-500">
                {fieldErrors.username[0]}
              </p>
            )}
          </div>

          <div>
            <InputGroup
              label="Email"
              name="email"
              type="email"
              placeholder="user@example.com"
              required
              defaultValue={val.email}
            />
            {fieldErrors?.email && (
              <p className="mt-1 text-xs text-red-500">
                {fieldErrors.email[0]}
              </p>
            )}
          </div>

          {isEditing && (
            <>
              <div>
                <InputGroup
                  label="Password (leave blank to keep current)"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                />
                {fieldErrors?.password && (
                  <p className="mt-1 text-xs text-red-500">
                    {fieldErrors.password[0]}
                  </p>
                )}
              </div>

              <div>
                <InputGroup
                  label="Confirm Password"
                  name="confirmPassword"
                  type="password"
                  placeholder="Confirm password"
                />
                {fieldErrors?.confirmPassword && (
                  <p className="mt-1 text-xs text-red-500">
                    {fieldErrors.confirmPassword[0]}
                  </p>
                )}
              </div>
            </>
          )}

          {!isEditing && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800/50 dark:bg-blue-900/20">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>Auto-generated password:</strong> A secure password will
                be automatically generated and sent to the user&apos;s email. The
                user will be required to change it on first login.
              </p>
            </div>
          )}

          <div>
            <label className="text-body-sm font-medium text-dark dark:text-white">
              Role <span className="ml-1 select-none text-red">*</span>
            </label>
            <select
              name="role"
              defaultValue={val.role}
              className="mt-3 w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5.5 py-3 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor (Pentester)</option>
              <option value="administrator" disabled={adminRoleDisabled}>
                Administrator{adminRoleDisabled ? " (already assigned)" : ""}
              </option>
            </select>
            {adminRoleDisabled && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Only one administrator is allowed in the system.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg border border-stroke px-5 py-2.5 text-sm font-medium text-dark transition-colors hover:bg-gray-2 disabled:opacity-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {pending
              ? "Saving..."
              : isEditing
                ? "Update User"
                : "Create User"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
