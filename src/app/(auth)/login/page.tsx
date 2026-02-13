"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginAction, type AuthActionResult } from "@/lib/actions/auth";
import { EmailIcon, PasswordIcon } from "@/assets/icons";
import InputGroup from "@/components/FormElements/InputGroup";

export default function LoginPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    AuthActionResult | null,
    FormData
  >(loginAction, null);

  const [lastFormData, setLastFormData] = useState<{ identifier: string; password: string } | null>(null);
  const [showError, setShowError] = useState(false);

  const wrappedAction = (formData: FormData) => {
    // Capture credentials before sending to server action
    setLastFormData({
      identifier: formData.get("identifier") as string,
      password: formData.get("password") as string,
    });
    return formAction(formData);
  };

  useEffect(() => {
    if (state?.success) {
      // Full page navigation to ensure SessionProvider gets fresh session
      window.location.href = "/";
    }
    if (state?.requires2FA && state.userId && lastFormData) {
      // Store credentials temporarily for 2FA verification
      sessionStorage.setItem(
        "2fa_pending",
        JSON.stringify({
          userId: state.userId,
          identifier: lastFormData.identifier,
          password: lastFormData.password,
        }),
      );
      router.push("/verify-2fa");
      return;
    }
    if (state?.error) {
      setShowError(true);
      const timer = setTimeout(() => setShowError(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [state, router, lastFormData]);

  return (
    <div className="w-full max-w-[500px] mx-4">
      <div className="rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="w-full p-4 sm:p-12.5 xl:p-15">
          <div className="mb-9">
            <h2 className="mb-1.5 text-2xl font-bold text-dark dark:text-white sm:text-heading-3">
              Sign In
            </h2>
            <p className="font-medium text-dark-4 dark:text-dark-6">
              Enter your credentials to access DEIT REPORTING
            </p>
          </div>

          {/* Error Alert */}
          {showError && state?.error && (
            <div
              role="alert"
              className="mb-6 flex items-center gap-3 rounded-lg border border-red-light bg-red-light-5 px-4 py-3 text-sm text-red-light dark:bg-[#1B1B24] dark:border-red-light/30"
            >
              <svg
                className="h-5 w-5 shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{state.error}</span>
            </div>
          )}

          <form action={wrappedAction}>
            <InputGroup
              key={`id-${state?.identifier ?? ""}`}
              type="text"
              label="Username or Email"
              className="mb-4 [&_input]:py-[15px]"
              placeholder="Enter your username or email"
              name="identifier"
              defaultValue={state?.identifier ?? ""}
              icon={<EmailIcon />}
              required
            />

            {state?.fieldErrors?.identifier && (
              <p className="-mt-2 mb-4 text-sm text-red-light">
                {state.fieldErrors.identifier[0]}
              </p>
            )}

            <InputGroup
              key={state ? String(Date.now()) : "pw"}
              type="password"
              label="Password"
              className="mb-6 [&_input]:py-[15px]"
              placeholder="Enter your password"
              name="password"
              icon={<PasswordIcon />}
              required
            />

            {state?.fieldErrors?.password && (
              <p className="-mt-4 mb-6 text-sm text-red-light">
                {state.fieldErrors.password[0]}
              </p>
            )}

            <div className="mb-4.5">
              <button
                type="submit"
                disabled={isPending}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary p-4 font-medium text-white transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isPending ? "Signing in..." : "Sign In"}
                {isPending && (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent" />
                )}
              </button>
            </div>

            <p className="text-center text-sm text-dark-4 dark:text-dark-6">
              <Link
                href="/forgot-password"
                className="font-medium text-primary hover:underline"
              >
                Forgot your password?
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
