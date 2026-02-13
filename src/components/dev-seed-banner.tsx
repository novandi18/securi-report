"use client";

import { useState } from "react";
import { isDevClient } from "@/lib/env";
import { useRole } from "@/hooks/use-role";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  seedAllAction,
  clearAllDummyDataAction,
  type SeedResult,
} from "@/lib/actions/seed-actions";
import { useRouter } from "next/navigation";

export function DevSeedBanner() {
  const { isAdmin } = useRole();
  const { addToast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);

  // Only render in development + admin
  if (!isDevClient || !isAdmin) return null;

  async function handleSeedAll() {
    setLoading(true);
    try {
      const result: SeedResult = await seedAllAction();
      if (result.success) {
        addToast(
          `Seeded ${result.count ?? 0} records (users, customers, KB templates, reports).`,
          "success",
        );
        router.refresh();
      } else {
        addToast(result.error ?? "Seed failed", "error");
      }
    } catch {
      addToast("Unexpected error while seeding.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleClearAll() {
    setLoading(true);
    try {
      const result: SeedResult = await clearAllDummyDataAction();
      if (result.success) {
        addToast("All dummy data cleared (admin account preserved).", "success");
        router.refresh();
      } else {
        addToast(result.error ?? "Clear failed", "error");
      }
    } catch {
      addToast("Unexpected error while clearing.", "error");
    } finally {
      setLoading(false);
      setClearConfirm(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-amber-500/50 bg-amber-50 px-4 py-2 dark:border-amber-400/30 dark:bg-amber-900/20">
        <span className="shrink-0 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          DEV
        </span>
        <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
          Development Mode
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSeedAll}
            disabled={loading}
            className="rounded border border-amber-500/50 bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-200 disabled:opacity-50 dark:border-amber-400/30 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60"
          >
            {loading ? "Seeding..." : "Seed All Data"}
          </button>
          <button
            type="button"
            onClick={() => setClearConfirm(true)}
            disabled={loading}
            className="rounded border border-red-300 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-500/30 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
          >
            Clear All Data
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={clearConfirm}
        title="Clear ALL Dummy Data?"
        message="This will delete ALL customers, reports, deliverables, finding templates, and non-admin users. Only the admin account and CWE/OWASP reference data will be kept. This cannot be undone."
        confirmLabel="Delete Everything"
        variant="danger"
        loading={loading}
        onConfirm={handleClearAll}
        onCancel={() => setClearConfirm(false)}
      />
    </>
  );
}
