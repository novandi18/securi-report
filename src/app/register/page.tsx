"use client";

import { useActionState, useEffect, useState } from "react";
import { registerAction, type AuthActionResult } from "@/lib/actions/auth";
import { EmailIcon, PasswordIcon, UserIcon } from "@/assets/icons";
import InputGroup from "@/components/FormElements/InputGroup";

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState<
    AuthActionResult | null,
    FormData
  >(registerAction, null);

  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    if (state?.success || state?.error) {
      setShowMessage(true);
      const timer = setTimeout(() => setShowMessage(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [state]);

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-dark dark:text-white">
          Register New User
        </h2>
        <p className="mt-1 font-medium text-dark-4 dark:text-dark-6">
          Create a new account for your team member
        </p>
      </div>

      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card sm:p-10">
        <div className="max-w-[600px]">
          {/* Success Alert */}
          {showMessage && state?.success && (
            <div
              role="alert"
              className="mb-6 flex items-center gap-3 rounded-lg border border-green bg-green-light-7 px-4 py-3 text-sm text-green dark:bg-[#1B1B24] dark:border-green/30"
            >
              <svg
                className="h-5 w-5 shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>User registered successfully!</span>
            </div>
          )}

          {/* Error Alert */}
          {showMessage && state?.error && (
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

          <form action={formAction}>
            <InputGroup
              type="text"
              label="Username"
              className="mb-4 [&_input]:py-[15px]"
              placeholder="Enter username"
              name="username"
              icon={<UserIcon />}
              required
            />
            {state?.fieldErrors?.username && (
              <p className="-mt-2 mb-4 text-sm text-red-light">
                {state.fieldErrors.username[0]}
              </p>
            )}

            <InputGroup
              type="email"
              label="Email"
              className="mb-4 [&_input]:py-[15px]"
              placeholder="Enter email address"
              name="email"
              icon={<EmailIcon />}
              required
            />
            {state?.fieldErrors?.email && (
              <p className="-mt-2 mb-4 text-sm text-red-light">
                {state.fieldErrors.email[0]}
              </p>
            )}

            <InputGroup
              type="password"
              label="Password"
              className="mb-4 [&_input]:py-[15px]"
              placeholder="Minimum 8 characters"
              name="password"
              icon={<PasswordIcon />}
              required
            />
            {state?.fieldErrors?.password && (
              <p className="-mt-2 mb-4 text-sm text-red-light">
                {state.fieldErrors.password[0]}
              </p>
            )}

            <InputGroup
              type="password"
              label="Confirm Password"
              className="mb-4 [&_input]:py-[15px]"
              placeholder="Re-enter password"
              name="confirmPassword"
              icon={<PasswordIcon />}
              required
            />
            {state?.fieldErrors?.confirmPassword && (
              <p className="-mt-2 mb-4 text-sm text-red-light">
                {state.fieldErrors.confirmPassword[0]}
              </p>
            )}

            {/* Role Select */}
            <div className="mb-6">
              <label
                htmlFor="role"
                className="text-body-sm font-medium text-dark dark:text-white"
              >
                Role <span className="ml-1 select-none text-red">*</span>
              </label>
              <div className="relative mt-3">
                <select
                  id="role"
                  name="role"
                  defaultValue="viewer"
                  className="w-full appearance-none rounded-lg border-[1.5px] border-stroke bg-transparent px-5.5 py-[15px] text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
                  required
                >
                  <option value="viewer">Viewer</option>
                  <option value="administrator">Administrator</option>
                </select>
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
                  <svg
                    className="fill-current text-dark-4 dark:text-dark-6"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                  >
                    <path d="M2.293 5.293a1 1 0 011.414 0L8 9.586l4.293-4.293a1 1 0 111.414 1.414l-5 5a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414z" />
                  </svg>
                </span>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isPending}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary p-4 font-medium text-white transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isPending ? "Registering..." : "Register User"}
                {isPending && (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent" />
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
