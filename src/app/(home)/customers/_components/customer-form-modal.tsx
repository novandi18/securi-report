"use client";

import { useEffect, useRef, useState } from "react";
import InputGroup from "@/components/FormElements/InputGroup";
import { LogoUpload } from "@/components/FormElements/logo-upload";
import type { Customer } from "@/lib/db/schema";
import type { ActionResult } from "@/lib/actions/customer";

interface CustomerFormModalProps {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
  action: (formData: FormData) => void;
  pending: boolean;
  state: ActionResult | null;
}

export default function CustomerFormModal({
  open,
  customer,
  onClose,
  action,
  pending,
  state,
}: CustomerFormModalProps) {
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

  const isEditing = !!customer;
  const fieldErrors = state?.fieldErrors;

  // Use returned values on error, otherwise fall back to entity prop
  const v = state?.values;
  const val = {
    name: v?.name ?? customer?.name ?? "",
    email: v?.email ?? customer?.email ?? "",
    description: v?.description ?? customer?.description ?? "",
    logoUrl: v?.logoUrl ?? customer?.logoUrl ?? "",
  };

  const [logoUrl, setLogoUrl] = useState(val.logoUrl);

  // Sync logoUrl when modal opens with different customer or after error
  useEffect(() => {
    setLogoUrl(val.logoUrl);
  }, [val.logoUrl]);

  // Key forces React to re-mount form inputs with updated defaultValue
  const formKey = state && !state.success ? `err-${Date.now()}` : `clean-${customer?.id ?? "new"}`;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-[9999] m-auto w-full max-w-lg rounded-xl border border-stroke bg-white p-0 shadow-2xl backdrop:bg-black/50 dark:border-dark-3 dark:bg-dark-2"
      onClose={onClose}
    >
      <div className="border-b border-stroke px-6 py-4 dark:border-dark-3">
        <h3 className="text-lg font-semibold text-dark dark:text-white">
          {isEditing ? "Edit Customer" : "Add Customer"}
        </h3>
      </div>

      <form key={formKey} action={action} className="p-6">
        {isEditing && <input type="hidden" name="id" value={customer.id} />}

        <div className="space-y-4">
          <div>
            <InputGroup
              label="Name"
              name="name"
              type="text"
              placeholder="Customer name"
              required
              defaultValue={val.name}
            />
            {fieldErrors?.name && (
              <p className="mt-1 text-xs text-red-500">
                {fieldErrors.name[0]}
              </p>
            )}
          </div>

          <div>
            <InputGroup
              label="Email"
              name="email"
              type="email"
              placeholder="customer@example.com"
              defaultValue={val.email}
            />
            {fieldErrors?.email && (
              <p className="mt-1 text-xs text-red-500">
                {fieldErrors.email[0]}
              </p>
            )}
          </div>

          <div>
            <label className="text-body-sm font-medium text-dark dark:text-white">
              Description
            </label>
            <textarea
              name="description"
              placeholder="Brief description of the customer..."
              defaultValue={val.description}
              rows={3}
              className="mt-3 w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5.5 py-3 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
            />
            {fieldErrors?.description && (
              <p className="mt-1 text-xs text-red-500">
                {fieldErrors.description[0]}
              </p>
            )}
          </div>

          <div>
            <LogoUpload
              value={logoUrl}
              onChange={setLogoUrl}
              error={fieldErrors?.logoUrl?.[0]}
            />
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
                ? "Update Customer"
                : "Create Customer"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
