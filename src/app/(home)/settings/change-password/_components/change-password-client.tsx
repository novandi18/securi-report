"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changePasswordAction } from "@/lib/actions/settings";
import { useToast } from "@/components/ui/toast";
import { useSession } from "next-auth/react";

interface ChangePasswordClientProps {
  mustChangePassword: boolean;
}

export default function ChangePasswordClient({
  mustChangePassword,
}: ChangePasswordClientProps) {
  const { addToast } = useToast();
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const result = await changePasswordAction(formData);

    if (result.success) {
      addToast("Password changed successfully.", "success");
      if (mustChangePassword) {
        // Pass explicit data so the JWT callback updates the token,
        // then hard-redirect so middleware sees the fresh cookie
        await updateSession({ mustChangePassword: false });
        window.location.href = "/";
        return;
      }
      router.push("/settings/account");
      router.refresh();
    } else {
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
      }
      addToast(result.error || "Failed to change password.", "error");
    }

    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-lg">
      {mustChangePassword && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-600/50 dark:bg-amber-900/20">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-amber-600 dark:text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              You must change your password before accessing the application.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="mb-6 text-lg font-semibold text-dark dark:text-white">
          Change Password
        </h3>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showPasswords.current ? "text" : "password"}
                  name="currentPassword"
                  placeholder="Enter current password"
                  required
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 pr-12 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:text-white dark:focus:border-primary"
                />
                <PasswordToggle
                  show={showPasswords.current}
                  onToggle={() => setShowPasswords((s) => ({ ...s, current: !s.current }))}
                />
              </div>
              {fieldErrors.currentPassword && (
                <p className="mt-1 text-xs text-red-500">
                  {fieldErrors.currentPassword[0]}
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPasswords.new ? "text" : "password"}
                  name="newPassword"
                  placeholder="Enter new password"
                  required
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 pr-12 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:text-white dark:focus:border-primary"
                />
                <PasswordToggle
                  show={showPasswords.new}
                  onToggle={() => setShowPasswords((s) => ({ ...s, new: !s.new }))}
                />
              </div>
              {fieldErrors.newPassword && (
                <p className="mt-1 text-xs text-red-500">
                  {fieldErrors.newPassword[0]}
                </p>
              )}
              <p className="mt-1 text-xs text-dark-5 dark:text-dark-6">
                Min 8 characters, must include uppercase, lowercase, number, and
                special character.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showPasswords.confirm ? "text" : "password"}
                  name="confirmPassword"
                  placeholder="Confirm new password"
                  required
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 pr-12 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:text-white dark:focus:border-primary"
                />
                <PasswordToggle
                  show={showPasswords.confirm}
                  onToggle={() => setShowPasswords((s) => ({ ...s, confirm: !s.confirm }))}
                />
              </div>
              {fieldErrors.confirmPassword && (
                <p className="mt-1 text-xs text-red-500">
                  {fieldErrors.confirmPassword[0]}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            {!mustChangePassword && (
              <button
                type="button"
                onClick={() => router.back()}
                disabled={loading}
                className="rounded-lg border border-stroke px-5 py-2.5 text-sm font-medium text-dark transition-colors hover:bg-gray-2 disabled:opacity-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Change Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PasswordToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-4 hover:text-dark dark:text-dark-6 dark:hover:text-white"
      tabIndex={-1}
      aria-label={show ? "Hide password" : "Show password"}
    >
      {show ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      )}
    </button>
  );
}
