"use client";

import { useEffect, useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loginWith2FAAction, loginWithBackupCodeAction } from "@/lib/actions/auth";

type PendingData = {
  userId: string;
  identifier: string;
  password: string;
};

export default function Verify2FAPage() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingData | null>(null);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const stored = sessionStorage.getItem("2fa_pending");
    if (!stored) {
      router.replace("/login");
      return;
    }

    try {
      const data = JSON.parse(stored) as PendingData;
      if (!data.userId || !data.identifier || !data.password) {
        throw new Error("Invalid");
      }
      setPending(data);
    } catch {
      sessionStorage.removeItem("2fa_pending");
      router.replace("/login");
    }
  }, [router]);

  const handleInput = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, "").slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setError("");

    // Auto-focus next
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 filled
    const fullCode = newCode.join("");
    if (fullCode.length === 6 && newCode.every((d) => d !== "")) {
      handleVerify(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 0) return;

    const newCode = [...code];
    for (let i = 0; i < 6; i++) {
      newCode[i] = pasted[i] || "";
    }
    setCode(newCode);

    // Focus last filled or next empty
    const nextEmpty = newCode.findIndex((d) => d === "");
    inputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();

    if (pasted.length === 6) {
      handleVerify(pasted);
    }
  };

  const handleVerify = (fullCode: string) => {
    if (!pending) return;

    startTransition(async () => {
      const result = await loginWith2FAAction(
        pending.identifier,
        pending.password,
        fullCode,
      );

      if (result.success) {
        // Clean up and redirect
        sessionStorage.removeItem("2fa_pending");
        window.location.href = "/";
      } else {
        setError(result.error || "Verification failed.");
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    });
  };

  const handleBackupVerify = () => {
    if (!pending || !backupCode.trim()) return;

    startTransition(async () => {
      const result = await loginWithBackupCodeAction(
        pending.identifier,
        pending.password,
        backupCode.trim(),
      );

      if (result.success) {
        sessionStorage.removeItem("2fa_pending");
        window.location.href = "/";
      } else {
        setError(result.error || "Invalid backup code.");
        setBackupCode("");
      }
    });
  };

  const handleCancel = () => {
    sessionStorage.removeItem("2fa_pending");
    router.replace("/login");
  };

  if (!pending) {
    return (
      <div className="flex items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[440px] mx-4">
      <div className="rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="w-full p-6 sm:p-10">
          {/* Icon */}
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary"
              >
                <rect width="7" height="9" x="8.5" y="2" rx="1" />
                <path d="M15.5 11V2H12l-3.5 9" />
                <path d="M3 15h18" />
                <path d="M3 19h18" />
                <rect width="18" height="12" x="3" y="11" rx="2" />
              </svg>
            </div>
          </div>

          <div className="mb-6 text-center">
            <h2 className="mb-2 text-xl font-bold text-dark dark:text-white sm:text-2xl">
              Two-Factor Authentication
            </h2>
            <p className="text-sm text-dark-4 dark:text-dark-6">
              {useBackupCode
                ? "Enter one of your 8-digit backup codes"
                : "Enter the 6-digit code from your authenticator app"}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              role="alert"
              className="mb-5 flex items-center gap-3 rounded-lg border border-red-light bg-red-light-5 px-4 py-3 text-sm text-red-light dark:bg-[#1B1B24] dark:border-red-light/30"
            >
              <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {useBackupCode ? (
            <>
              {/* Backup code input */}
              <div className="mb-6">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  value={backupCode}
                  onChange={(e) => {
                    setBackupCode(e.target.value.replace(/\D/g, "").slice(0, 8));
                    setError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && backupCode.length === 8) {
                      handleBackupVerify();
                    }
                  }}
                  placeholder="12345678"
                  disabled={isPending}
                  className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-4 text-center font-mono text-xl tracking-[0.3em] text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary disabled:opacity-50"
                  autoFocus
                />
              </div>

              {/* Verify backup button */}
              <button
                type="button"
                onClick={handleBackupVerify}
                disabled={isPending || backupCode.length !== 8}
                className="mb-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary p-3.5 font-medium text-white transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isPending ? "Verifying..." : "Verify Backup Code"}
                {isPending && (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent" />
                )}
              </button>

              {/* Switch to TOTP */}
              <button
                type="button"
                onClick={() => { setUseBackupCode(false); setError(""); }}
                disabled={isPending}
                className="mb-4 flex w-full items-center justify-center gap-1 text-sm text-primary transition hover:text-primary/80"
              >
                Use authenticator app instead
              </button>
            </>
          ) : (
            <>
              {/* 6-digit code inputs */}
              <div className="mb-6 flex justify-center gap-2.5" onPaste={handlePaste}>
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleInput(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    disabled={isPending}
                    className="h-14 w-11 rounded-lg border-[1.5px] border-stroke bg-transparent text-center text-xl font-bold text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary disabled:opacity-50"
                    autoFocus={i === 0}
                  />
                ))}
              </div>

              {/* Verify button */}
              <button
                type="button"
                onClick={() => handleVerify(code.join(""))}
                disabled={isPending || code.some((d) => d === "")}
                className="mb-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary p-3.5 font-medium text-white transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isPending ? "Verifying..." : "Verify"}
                {isPending && (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent" />
                )}
              </button>

              {/* Switch to backup code */}
              <button
                type="button"
                onClick={() => { setUseBackupCode(true); setError(""); }}
                disabled={isPending}
                className="mb-4 flex w-full items-center justify-center gap-1 text-sm text-primary transition hover:text-primary/80"
              >
                Use a backup code instead
              </button>
            </>
          )}

          {/* Back to login */}
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="flex w-full items-center justify-center gap-1 text-sm text-dark-4 transition hover:text-primary dark:text-dark-6 dark:hover:text-primary"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
            Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
