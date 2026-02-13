"use client";

import { useEffect, useCallback, useRef } from "react";

const CONFIRM_MESSAGE =
  "You have unsaved changes. Are you sure you want to leave this page?";

/**
 * Hook that warns users before navigating away from a page with unsaved form changes.
 *
 * Handles:
 * - Browser tab close / refresh (`beforeunload`)
 * - Browser back/forward (`popstate`)
 * - Next.js client-side navigation (`pushState` / `replaceState` interception)
 *
 * @param isDirty - Whether the form has unsaved changes.
 */
export function useUnsavedChanges(isDirty: boolean) {
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // ─── beforeunload: tab close / refresh ───
  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (!isDirtyRef.current) return;
    e.preventDefault();
    // Legacy browsers
    e.returnValue = CONFIRM_MESSAGE;
    return CONFIRM_MESSAGE;
  }, []);

  useEffect(() => {
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [handleBeforeUnload]);

  // ─── Intercept client-side navigation (pushState / popstate) ───
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Patch pushState to intercept Next.js Link / router.push
    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    const interceptNavigation = (
      original: typeof history.pushState,
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ) => {
      if (isDirtyRef.current) {
        const confirmed = window.confirm(CONFIRM_MESSAGE);
        if (!confirmed) return; // block navigation
      }
      original(data, unused, url);
    };

    history.pushState = function (data, unused, url) {
      interceptNavigation(originalPushState, data, unused, url);
    };

    history.replaceState = function (data, unused, url) {
      // Don't intercept replaceState — Next.js uses it for scroll restoration  
      originalReplaceState(data, unused, url);
    };

    // Intercept browser back/forward
    const handlePopState = () => {
      if (isDirtyRef.current) {
        const confirmed = window.confirm(CONFIRM_MESSAGE);
        if (!confirmed) {
          // Push current state back to undo the back/forward
          history.pushState(null, "", window.location.href);
        }
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      history.pushState = originalPushState;
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);
}
