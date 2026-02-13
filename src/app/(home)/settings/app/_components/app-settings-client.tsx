"use client";

import { useTransition, useState, useCallback } from "react";
import { updateAppSettingsAction } from "@/lib/actions/settings";
import { useToast } from "@/components/ui/toast";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";

type Settings = {
  id: number;
  companyName: string | null;
  companyLogo: string | null;
  reportIdPrefix: string | null;
  latexEngine: string | null;
  titlePageColor: string | null;
  updatedAt: Date | null;
};

type Props = {
  settings: Settings;
};

export default function AppSettingsClient({ settings }: Props) {
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isDirty, setIsDirty] = useState(false);
  const { addToast } = useToast();
  useUnsavedChanges(isDirty);

  const markDirty = useCallback(() => {
    if (!isDirty) setIsDirty(true);
  }, [isDirty]);

  const handleSubmit = (formData: FormData) => {
    setFieldErrors({});
    startTransition(async () => {
      const result = await updateAppSettingsAction(formData);
      if (result.success) {
        addToast("Application settings updated.", "success");
        setIsDirty(false);
      } else {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        addToast(result.error || "Failed to update settings.", "error");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Branding & Report Config */}
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h4 className="mb-5 text-lg font-bold text-dark dark:text-white">
          Report Configuration
        </h4>

        <form action={handleSubmit} className="space-y-5" onChange={markDirty}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Report ID Prefix */}
            <div>
              <label className="text-body-sm font-medium text-dark dark:text-white">
                Report ID Prefix <span className="ml-1 text-red">*</span>
              </label>
              <input
                name="reportIdPrefix"
                type="text"
                required
                defaultValue={settings.reportIdPrefix ?? "PEN-DOC-"}
                placeholder="PEN-DOC-"
                className="mt-2 w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
              />
              <p className="mt-1 text-xs text-dark-4 dark:text-dark-6">
                Preview: {settings.reportIdPrefix ?? "PEN-DOC-"}001
              </p>
              {fieldErrors.reportIdPrefix && (
                <p className="mt-1 text-xs text-red">{fieldErrors.reportIdPrefix[0]}</p>
              )}
            </div>

            {/* LaTeX Engine */}
            <div>
              <label className="text-body-sm font-medium text-dark dark:text-white">
                LaTeX Engine <span className="ml-1 text-red">*</span>
              </label>
              <select
                name="latexEngine"
                defaultValue={settings.latexEngine ?? "pdflatex"}
                className="mt-2 w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary"
              >
                <option value="pdflatex">pdflatex</option>
                <option value="xelatex">xelatex</option>
              </select>
              {fieldErrors.latexEngine && (
                <p className="mt-1 text-xs text-red">{fieldErrors.latexEngine[0]}</p>
              )}
            </div>

          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save Settings"}
            </button>
          </div>
        </form>
      </div>

      {/* System Information */}
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h4 className="mb-5 text-lg font-bold text-dark dark:text-white">System Information</h4>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between border-b border-stroke pb-3 dark:border-dark-3">
            <span className="text-dark-4 dark:text-dark-6">Application</span>
            <span className="font-medium text-dark dark:text-white">DEIT Reporting</span>
          </div>
          <div className="flex items-center justify-between border-b border-stroke pb-3 dark:border-dark-3">
            <span className="text-dark-4 dark:text-dark-6">Framework</span>
            <span className="font-medium text-dark dark:text-white">Next.js</span>
          </div>
          <div className="flex items-center justify-between border-b border-stroke pb-3 dark:border-dark-3">
            <span className="text-dark-4 dark:text-dark-6">Database</span>
            <span className="font-medium text-dark dark:text-white">MySQL 8</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-dark-4 dark:text-dark-6">Last Settings Update</span>
            <span className="font-medium text-dark dark:text-white">
              {settings.updatedAt
                ? new Date(settings.updatedAt).toLocaleString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Never"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
