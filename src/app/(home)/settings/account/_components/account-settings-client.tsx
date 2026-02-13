"use client";

import { useState, useTransition, useMemo } from "react";
import {
  changePasswordAction,
  setup2FAAction,
  verify2FAAction,
  disable2FAAction,
  regenerateBackupCodesAction,
} from "@/lib/actions/settings";
import { useToast } from "@/components/ui/toast";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Profile = {
  id: string;
  username: string;
  fullName: string | null;
  email: string;
  role: "administrator" | "editor" | "viewer" | null;
  avatarUrl: string | null;
  twoFactorEnabled: boolean | null;
  preferredLanguage: string | null;
  lastLogin: Date | null;
  createdAt: Date | null;
};

type AuditLog = {
  id: string;
  action: string;
  ipAddress: string | null;
  createdAt: Date | null;
};

type Props = {
  profile: Profile;
  auditLogs: AuditLog[];
};

export default function AccountSettingsClient({ profile, auditLogs }: Props) {
  return (
    <div className="space-y-6">
      <ChangePasswordSection />
      <TwoFactorSection initialEnabled={profile.twoFactorEnabled ?? false} />
      {auditLogs.length > 0 && <AuditLogSection logs={auditLogs} />}
    </div>
  );
}

// ─── Change Password ─────────────────────────────────────
function ChangePasswordSection() {
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const { addToast } = useToast();

  const handleSubmit = (formData: FormData) => {
    setFieldErrors({});
    startTransition(async () => {
      const result = await changePasswordAction(formData);
      if (result.success) {
        addToast("Password changed successfully.", "success");
        // Reset form
        const form = document.querySelector<HTMLFormElement>("#change-password-form");
        form?.reset();
      } else {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        addToast(result.error || "Failed to change password.", "error");
      }
    });
  };

  return (
    <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
      <h4 className="mb-5 text-lg font-bold text-dark dark:text-white">Change Password</h4>

      <form id="change-password-form" action={handleSubmit} className="max-w-lg space-y-4">
        <PasswordField
          name="currentPassword"
          label="Current Password"
          error={fieldErrors.currentPassword?.[0]}
        />
        <PasswordField
          name="newPassword"
          label="New Password"
          error={fieldErrors.newPassword?.[0]}
          hint="Min 8 chars, with uppercase, lowercase, number, and special character."
        />
        <PasswordField
          name="confirmPassword"
          label="Confirm New Password"
          error={fieldErrors.confirmPassword?.[0]}
        />

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Updating…" : "Update Password"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PasswordField({
  name,
  label,
  error,
  hint,
}: {
  name: string;
  label: string;
  error?: string;
  hint?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <label className="text-body-sm font-medium text-dark dark:text-white">
        {label} <span className="ml-1 text-red">*</span>
      </label>
      <div className="relative mt-2">
        <input
          name={name}
          type={show ? "text" : "password"}
          required
          placeholder={`Enter ${label.toLowerCase()}`}
          className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 pr-12 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-4 hover:text-dark dark:text-dark-6 dark:hover:text-white"
          tabIndex={-1}
        >
          {show ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          )}
        </button>
      </div>
      {hint && !error && (
        <p className="mt-1 text-xs text-dark-4 dark:text-dark-6">{hint}</p>
      )}
      {error && <p className="mt-1 text-xs text-red">{error}</p>}
    </div>
  );
}

// ─── Two-Factor Authentication ───────────────────────────
function TwoFactorSection({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupData, setSetupData] = useState<{
    secret: string;
    qrCodeDataUrl: string;
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);
  const { addToast } = useToast();

  // Password confirmation state
  const [passwordPrompt, setPasswordPrompt] = useState<{
    action: "disable" | "regenerate" | "enable";
  } | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  const handleEnableClick = () => {
    openPasswordPrompt("enable");
  };

  const handleVerifySetup = () => {
    setVerifyError("");
    startTransition(async () => {
      const result = await verify2FAAction(verifyCode);
      if (result.success) {
        setEnabled(true);
        setShowSetupModal(false);
        setSetupData(null);
        // Show backup codes
        if (result.backupCodes) {
          setBackupCodes(result.backupCodes);
          setShowBackupCodesModal(true);
        }
        addToast("Two-factor authentication enabled successfully!", "success");
      } else {
        setVerifyError(result.error || "Invalid code.");
      }
    });
  };

  const openPasswordPrompt = (action: "disable" | "regenerate" | "enable") => {
    setConfirmPassword("");
    setConfirmPasswordError("");
    setPasswordPrompt({ action });
  };

  const handlePasswordConfirm = () => {
    if (!confirmPassword.trim()) {
      setConfirmPasswordError("Password is required.");
      return;
    }

    setConfirmPasswordError("");

    if (passwordPrompt?.action === "enable") {
      startTransition(async () => {
        const result = await setup2FAAction(confirmPassword);
        if (result.success && result.data) {
          setSetupData(result.data);
          setShowSetupModal(true);
          setVerifyCode("");
          setVerifyError("");
          setPasswordPrompt(null);
          setConfirmPassword("");
        } else {
          setConfirmPasswordError(result.error || "Failed to start 2FA setup.");
        }
      });
    } else if (passwordPrompt?.action === "disable") {
      startTransition(async () => {
        const result = await disable2FAAction(confirmPassword);
        if (result.success) {
          setEnabled(false);
          setBackupCodes(null);
          setPasswordPrompt(null);
          setConfirmPassword("");
          addToast("Two-factor authentication disabled.", "success");
        } else {
          setConfirmPasswordError(result.error || "Failed to disable 2FA.");
        }
      });
    } else if (passwordPrompt?.action === "regenerate") {
      startTransition(async () => {
        const result = await regenerateBackupCodesAction(confirmPassword);
        if (result.success && result.backupCodes) {
          setBackupCodes(result.backupCodes);
          setShowBackupCodesModal(true);
          setPasswordPrompt(null);
          setConfirmPassword("");
          addToast("New backup codes generated. Save them now!", "success");
        } else {
          setConfirmPasswordError(result.error || "Failed to regenerate backup codes.");
        }
      });
    }
  };

  return (
    <>
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h4 className="mb-5 text-lg font-bold text-dark dark:text-white">
          Two-Factor Authentication
        </h4>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-dark dark:text-white">
              {enabled
                ? "2FA is currently enabled on your account."
                : "Add an extra layer of security to your account."}
            </p>
            <p className="mt-1 text-xs text-dark-4 dark:text-dark-6">
              {enabled
                ? "You will need your authenticator app to sign in."
                : "Use an authenticator app like Google Authenticator or Authy."}
            </p>
          </div>

          {enabled ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => openPasswordPrompt("regenerate")}
                disabled={isPending}
                className="shrink-0 rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-dark transition hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2 disabled:opacity-50"
              >
                Regenerate Backup Codes
              </button>
              <button
                type="button"
                onClick={() => openPasswordPrompt("disable")}
                disabled={isPending}
                className="shrink-0 rounded-lg border border-red-light px-4 py-2 text-sm font-medium text-red-light transition hover:bg-red-light hover:text-white disabled:opacity-50"
              >
                Disable 2FA
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleEnableClick}
              disabled={isPending}
              className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "Setting up…" : "Enable 2FA"}
            </button>
          )}
        </div>
      </div>

      {/* Setup Modal */}
      {showSetupModal && setupData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-[10px] bg-white p-6 shadow-xl dark:bg-gray-dark">
            <h3 className="mb-1 text-lg font-bold text-dark dark:text-white">
              Set Up Two-Factor Authentication
            </h3>
            <p className="mb-5 text-sm text-dark-4 dark:text-dark-6">
              Scan the QR code below with your authenticator app, then enter the
              6-digit verification code.
            </p>

            {/* QR Code */}
            <div className="mb-5 flex justify-center">
              <div className="rounded-lg border border-stroke bg-white p-3 dark:border-dark-3">
                <img
                  src={setupData.qrCodeDataUrl}
                  alt="2FA QR Code"
                  width={200}
                  height={200}
                  className="block"
                />
              </div>
            </div>

            {/* Manual Secret */}
            <div className="mb-5">
              <p className="mb-1.5 text-xs font-medium text-dark-4 dark:text-dark-6">
                Can&apos;t scan? Enter this key manually:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-gray-2 px-3 py-2 font-mono text-sm text-dark dark:bg-dark-2 dark:text-white">
                  {setupData.secret}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(setupData.secret);
                    addToast("Secret key copied to clipboard.", "info");
                  }}
                  className="shrink-0 rounded-md p-2 text-dark-4 transition hover:bg-gray-2 hover:text-dark dark:text-dark-6 dark:hover:bg-dark-2 dark:hover:text-white"
                  title="Copy to clipboard"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Verification input */}
            <div className="mb-2">
              <label className="text-body-sm font-medium text-dark dark:text-white">
                Verification Code <span className="ml-1 text-red">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setVerifyCode(v);
                  setVerifyError("");
                }}
                placeholder="000000"
                className="mt-2 w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 text-center font-mono text-lg tracking-[0.5em] text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
                autoFocus
              />
            </div>

            {verifyError && (
              <p className="mb-4 text-sm text-red">{verifyError}</p>
            )}

            {/* Actions */}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowSetupModal(false);
                  setSetupData(null);
                }}
                disabled={isPending}
                className="rounded-lg border border-stroke px-4 py-2.5 text-sm font-medium text-dark transition hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVerifySetup}
                disabled={isPending || verifyCode.length !== 6}
                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? "Verifying…" : "Verify & Enable"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backup Codes Modal */}
      {showBackupCodesModal && backupCodes && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-[10px] bg-white p-6 shadow-xl dark:bg-gray-dark">
            <div className="mb-1 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v4" /><path d="M12 17h.01" />
                  <path d="M3.586 15.414A2 2 0 0 0 3 16.828V21a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-4.172a2 2 0 0 0-.586-1.414l-6.828-6.828a2 2 0 0 0-2.172 0z" />
                  <path d="m9.5 2.5 5 5" /><path d="m14.5 2.5-5 5" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-dark dark:text-white">
                Save Your Backup Codes
              </h3>
            </div>
            <p className="mb-4 text-sm text-dark-4 dark:text-dark-6">
              Store these codes somewhere safe. Each code can only be used <strong>once</strong> to sign in if you lose access to your authenticator app.
            </p>

            <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-stroke bg-gray-2 p-4 dark:border-dark-3 dark:bg-dark-2">
              {backupCodes.map((code, i) => (
                <code key={i} className="rounded bg-white px-3 py-1.5 text-center font-mono text-sm font-semibold text-dark dark:bg-dark-3 dark:text-white">
                  {code}
                </code>
              ))}
            </div>

            <div className="mb-5 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(backupCodes.join("\n"));
                  addToast("Backup codes copied to clipboard.", "info");
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-dark transition hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
                Copy All
              </button>
              <button
                type="button"
                onClick={() => {
                  const text = `DEIT-Reporting Backup Codes\n${"=".repeat(30)}\n\n${backupCodes.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\nEach code can only be used once.`;
                  const blob = new Blob([text], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "backup-codes.txt";
                  a.click();
                  URL.revokeObjectURL(url);
                  addToast("Backup codes downloaded.", "info");
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-dark transition hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download
              </button>
            </div>

            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              <strong>Warning:</strong> These codes won&apos;t be shown again. If you lose them, you can regenerate new ones from Account Settings, which will invalidate the old codes.
            </p>

            <button
              type="button"
              onClick={() => {
                setShowBackupCodesModal(false);
                setBackupCodes(null);
              }}
              className="w-full rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90"
            >
              I&apos;ve Saved My Codes
            </button>
          </div>
        </div>
      )}

      {/* Password Confirmation Modal */}
      {passwordPrompt && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-[10px] bg-white p-6 shadow-xl dark:bg-gray-dark">
            <h3 className="mb-1 text-lg font-bold text-dark dark:text-white">
              {passwordPrompt.action === "disable"
                ? "Disable Two-Factor Authentication"
                : passwordPrompt.action === "enable"
                  ? "Enable Two-Factor Authentication"
                  : "Regenerate Backup Codes"}
            </h3>
            <p className="mb-5 text-sm text-dark-4 dark:text-dark-6">
              Enter your current password to confirm this action.
            </p>

            <div className="mb-2">
              <label className="text-body-sm font-medium text-dark dark:text-white">
                Current Password <span className="ml-1 text-red">*</span>
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setConfirmPasswordError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handlePasswordConfirm();
                  }
                }}
                placeholder="Enter your password"
                className="mt-2 w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
                autoFocus
              />
            </div>

            {confirmPasswordError && (
              <p className="mb-4 text-sm text-red">{confirmPasswordError}</p>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setPasswordPrompt(null);
                  setConfirmPassword("");
                  setConfirmPasswordError("");
                }}
                disabled={isPending}
                className="rounded-lg border border-stroke px-4 py-2.5 text-sm font-medium text-dark transition hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePasswordConfirm}
                disabled={isPending || !confirmPassword.trim()}
                className={`rounded-lg px-6 py-2.5 text-sm font-medium text-white transition disabled:opacity-50 ${
                  passwordPrompt.action === "disable"
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-primary hover:bg-primary/90"
                }`}
              >
                {isPending ? "Verifying…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Audit Logs ──────────────────────────────────────────
const AUDIT_PAGE_SIZE = 10;

function AuditLogSection({ logs }: { logs: AuditLog[] }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(logs.length / AUDIT_PAGE_SIZE));
  const paginatedLogs = useMemo(
    () => logs.slice((page - 1) * AUDIT_PAGE_SIZE, page * AUDIT_PAGE_SIZE),
    [logs, page],
  );

  const actionLabels: Record<string, string> = {
    "profile.update": "Updated profile",
    "password.change": "Changed password",
    "2fa.enabled": "Enabled 2FA",
    "2fa.disabled": "Disabled 2FA",
    "app_settings.update": "Updated app settings",
    "report.create": "Created report",
    "report.update": "Updated report",
    "report.delete": "Deleted report",
    "report.merge": "Merged reports",
    "report.merged_closed": "Report closed (merged)",
  };

  return (
    <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
      <h4 className="mb-5 text-lg font-bold text-dark dark:text-white">Recent Activity</h4>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stroke text-left dark:border-dark-3">
              <th className="pb-3 font-medium text-dark-4 dark:text-dark-6">Action</th>
              <th className="pb-3 font-medium text-dark-4 dark:text-dark-6">Date</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLogs.map((log) => (
              <tr
                key={log.id}
                className="border-b border-stroke last:border-0 dark:border-dark-3"
              >
                <td className="py-3 text-dark dark:text-white">
                  {actionLabels[log.action] || log.action}
                </td>
                <td className="py-3 text-dark-4 dark:text-dark-6">
                  {log.createdAt
                    ? new Date(log.createdAt).toLocaleString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between border-t border-stroke pt-4 dark:border-dark-3">
          <p className="text-xs text-dark-4 dark:text-dark-6">
            Showing {(page - 1) * AUDIT_PAGE_SIZE + 1}–
            {Math.min(page * AUDIT_PAGE_SIZE, logs.length)} of {logs.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-md p-1.5 text-dark-4 transition hover:bg-gray-2 disabled:opacity-30 dark:text-dark-6 dark:hover:bg-dark-2"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[3rem] text-center text-xs font-medium text-dark dark:text-white">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md p-1.5 text-dark-4 transition hover:bg-gray-2 disabled:opacity-30 dark:text-dark-6 dark:hover:bg-dark-2"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
