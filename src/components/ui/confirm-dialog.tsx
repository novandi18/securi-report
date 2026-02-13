"use client";

import { useRef, useEffect } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-[9999] m-auto w-full max-w-md rounded-xl border border-stroke bg-white p-6 shadow-2xl backdrop:bg-black/50 dark:border-dark-3 dark:bg-dark-2"
      onClose={onCancel}
    >
      <h3 className="mb-2 text-lg font-semibold text-dark dark:text-white">
        {title}
      </h3>
      <p className="mb-6 text-sm text-dark-5 dark:text-dark-6">{message}</p>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="rounded-lg border border-stroke px-5 py-2.5 text-sm font-medium text-dark transition-colors hover:bg-gray-2 disabled:opacity-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
            variant === "danger"
              ? "bg-red-500 hover:bg-red-600"
              : "bg-primary hover:bg-primary/90"
          }`}
        >
          {loading ? "Processing..." : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
