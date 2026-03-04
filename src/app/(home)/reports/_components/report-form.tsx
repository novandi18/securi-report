"use client";

import { useActionState, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/use-role";
import { useToast } from "@/components/ui/toast";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import InputGroup from "@/components/FormElements/InputGroup";
import { Select } from "@/components/FormElements/select";
import { MarkdownEditor } from "@/components/markdown-editor";
import { CvssInput } from "@/components/FormElements/cvss-calculator";
import { ReferencesInput } from "@/components/FormElements/references-input";
import { AttachmentDropzone, type AttachmentFile } from "@/components/FormElements/attachment-dropzone";
import { WorksheetUploader } from "@/components/FormElements/worksheet-uploader";
import { isDevClient } from "@/lib/env";
import TemplatePickerModal from "./template-picker-modal";
import type { PickableTemplate } from "./template-picker-modal";
import type { ActionResult } from "@/lib/actions/report";
import type { Issa1Target, Issa2Target, Issa3Target } from "@/lib/db/schema";
import type { ParsedWorksheet } from "@/lib/actions/worksheet-actions";

/**
 * Generate PEN-DOC-YYYYMMDDHHmm format report ID
 */
function generatePenDocId(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `PEN-DOC-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export interface ReportFormData {
  id?: string;
  customerId: string;
  reportIdCustom: string | null;
  title: string;
  executiveSummary: string | null;
  scopeIssa1: Issa1Target[] | null;
  scopeIssa2: Issa2Target[] | null;
  scopeIssa3: Issa3Target[] | null;
  referencesFramework: string | null;
  cvssVector: string | null;
  impact: string | null;
  recommendationSummary: string | null;
  status: "Open" | "Closed" | "Draft" | null;
  customerName?: string;
}

interface ReportFormProps {
  report?: ReportFormData | null;
  customers: { id: string; name: string }[];
  templates?: PickableTemplate[];
  initialAttachments?: AttachmentFile[];
  serverAction: (
    prevState: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
}

export default function ReportForm({
  report,
  customers,
  templates = [],
  initialAttachments = [],
  serverAction,
}: ReportFormProps) {
  const { isAdmin } = useRole();
  const { addToast } = useToast();
  const router = useRouter();

  // Auto-generate report ID on create (PEN-DOC-YYYYMMDDHHmm)
  const [autoReportId] = useState(() =>
    report?.reportIdCustom ?? generatePenDocId(),
  );

  // Attachment state
  const [attachments, setAttachments] = useState<AttachmentFile[]>(initialAttachments);

  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(serverAction, null);

  const isEditing = !!report?.id;

  // ─── Track unsaved changes ───
  const [isDirty, setIsDirty] = useState(false);
  useUnsavedChanges(isDirty);

  const markDirty = useCallback(() => {
    if (!isDirty) setIsDirty(true);
  }, [isDirty]);

  // Clear dirty flag on successful submission
  useEffect(() => {
    if (state?.success) {
      setIsDirty(false);
    }
  }, [state?.success]);

  // ─── Template Picker ───
  const [pickerOpen, setPickerOpen] = useState(false);
  const [templateOverrides, setTemplateOverrides] = useState<Record<string, string> | null>(null);
  const [templateKey, setTemplateKey] = useState(0);

  function handleTemplatePick(template: PickableTemplate) {
    setTemplateOverrides({
      executiveSummary: template.description ?? "",
      impact: template.impact ?? "",
      recommendationSummary: template.recommendation ?? "",
      cvssVector: template.cvssVector ?? "",
      referencesFramework: template.referencesLink ?? "",
    });
    setTemplateKey((k) => k + 1);
    setPickerOpen(false);
    addToast(`Template "${template.title}" applied.`, "success");
  }

  // ─── Dev: Generate Sample Content (client-only, no DB write) ───
  function handleGenerateSample() {
    // Dynamic import so this code is tree-shaken in production
    import("@/lib/sample-report-content").then(({ generateSampleReportContent }) => {
      const sample = generateSampleReportContent();
      setTemplateOverrides({
        reportIdCustom: sample.reportIdCustom,
        title: sample.title,
        executiveSummary: sample.executiveSummary,
        methodology: sample.methodology,
        impact: sample.impact,
        recommendationSummary: sample.recommendationSummary,
        cvssVector: sample.cvssVector,
        referencesFramework: sample.referencesFramework,
      });
      setTemplateKey((k) => k + 1);
    });
  }

  useEffect(() => {
    if (state?.success) {
      addToast(
        isEditing
          ? "Report updated successfully."
          : "Report created successfully.",
        "success",
      );
      router.push("/reports");
      router.refresh();
    } else if (state?.error) {
      addToast(state.error, "error");
    }
  }, [state, addToast, router, isEditing]);

  const fieldErrors = state?.fieldErrors;

  // Use returned values on error, otherwise fall back to template overrides, then entity prop
  const v = state?.values;
  const t = templateOverrides;
  const val = {
    customerId: v?.customerId ?? report?.customerId ?? "",
    reportIdCustom: v?.reportIdCustom ?? t?.reportIdCustom ?? autoReportId,
    title: v?.title ?? t?.title ?? report?.title ?? "",
    referencesFramework: v?.referencesFramework ?? t?.referencesFramework ?? report?.referencesFramework ?? "",
    cvssVector: v?.cvssVector ?? t?.cvssVector ?? report?.cvssVector ?? "",
    status: v?.status ?? report?.status ?? "Draft",
    executiveSummary: v?.executiveSummary ?? t?.executiveSummary ?? report?.executiveSummary ?? "",
    impact: v?.impact ?? t?.impact ?? report?.impact ?? "",
    recommendationSummary: v?.recommendationSummary ?? t?.recommendationSummary ?? report?.recommendationSummary ?? "",
  };

  // Build initial worksheet data from report for edit mode
  const initialWorksheetData: ParsedWorksheet | null =
    report?.scopeIssa1 || report?.scopeIssa2 || report?.scopeIssa3
      ? {
          issa1: report.scopeIssa1 ?? [],
          issa2: report.scopeIssa2 ?? [],
          issa3: report.scopeIssa3 ?? [],
        }
      : null;

  // Key forces React to re-mount form inputs with updated defaultValue
  const formKey = state && !state.success
    ? `err-${Date.now()}`
    : `clean-${report?.id ?? "new"}-tpl-${templateKey}`;

  // Build customer options for dropdown
  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  return (
    <>
    <form key={formKey} action={formAction} className="space-y-8" onChange={markDirty}>
      {isEditing && <input type="hidden" name="id" value={report!.id} />}

      {/* ─── Section 1: Core Info ─── */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="mb-5 text-lg font-semibold text-dark dark:text-white">
          Report Information
        </h3>

        {/* Template Picker Button */}
        {templates.length > 0 && (
          <div className="mb-5 rounded-lg border border-dashed border-primary/50 bg-primary/5 p-4 dark:bg-primary/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-dark dark:text-white">
                  Import from Finding Template
                </p>
                <p className="mt-0.5 text-xs text-dark-5 dark:text-dark-6">
                  Auto-fill Executive Summary, Impact, Recommendation, CVSS, and References from a KB template
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-white"
              >
                Browse Templates
              </button>
            </div>
          </div>
        )}

        {/* Dev: Generate Sample Content (client-only, no DB) */}
        {isDevClient && !isEditing && (
          <div className="mb-5 rounded-lg border border-dashed border-amber-500/50 bg-amber-50 p-4 dark:border-amber-400/30 dark:bg-amber-900/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Generate Sample Report Content
                </p>
                <p className="mt-0.5 text-xs text-amber-700/70 dark:text-amber-400/60">
                  Auto-fill all fields with realistic pentest report data (Markdown, CVSS, dates). No database write.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateSample}
                className="rounded-lg border border-amber-500/50 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-200 dark:border-amber-400/30 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60"
              >
                Generate Sample
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* 1. Customer */}
          <div>
            <Select
              label="Customer"
              name="customerId"
              required
              placeholder="Select a customer"
              defaultValue={val.customerId}
              items={customerOptions}
            />
            {fieldErrors?.customerId && (
              <p className="mt-1 text-xs text-red-500">
                {fieldErrors.customerId[0]}
              </p>
            )}
          </div>

          {/* 2. Report ID */}
          <div>
            <InputGroup
              label="Report ID"
              name="reportIdCustom"
              type="text"
              placeholder="PEN-DOC-YYYYMMDDHHmm"
              defaultValue={val.reportIdCustom}
            />
            <p className="mt-1 text-xs text-dark-5 dark:text-dark-6">
              Auto-generated. You can override it manually.
            </p>
            {fieldErrors?.reportIdCustom && (
              <p className="mt-1 text-xs text-red-500">
                {fieldErrors.reportIdCustom[0]}
              </p>
            )}
          </div>

          {/* 3. Report Title */}
          <div className="md:col-span-2">
            <InputGroup
              label="Report Title"
              name="title"
              type="text"
              placeholder="Report title"
              required
              defaultValue={val.title}
            />
            {fieldErrors?.title && (
              <p className="mt-1 text-xs text-red-500">
                {fieldErrors.title[0]}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ─── Section 2: Scope (Worksheet Upload) ─── */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="mb-2 text-lg font-semibold text-dark dark:text-white">
          Scope
        </h3>
        <p className="mb-5 text-sm text-dark-5 dark:text-dark-6">
          Upload the ISSA Worksheet (.xlsx) containing audit scope targets. The system will parse sheets ISSA-1, ISSA-2, and ISSA-3 automatically.
        </p>
        <WorksheetUploader
          initialData={initialWorksheetData}
          onChange={() => markDirty()}
        />
      </div>

      {/* ─── Section 3: References & CVSS ─── */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="mb-5 text-lg font-semibold text-dark dark:text-white">
          Security Metadata
        </h3>

        <div className="space-y-6">
          {/* 5. References / Framework */}
          <ReferencesInput
            name="referencesFramework"
            defaultValue={val.referencesFramework}
            error={fieldErrors?.referencesFramework?.[0]}
          />

          {/* 6. CVSS 4.0 Score */}
          <CvssInput
            name="cvssVector"
            defaultValue={val.cvssVector}
            error={fieldErrors?.cvssVector?.[0]}
          />

          {/* 7. Status */}
          <div className="max-w-xs">
            <Select
              label="Status"
              name="status"
              defaultValue={val.status}
              items={
                isAdmin
                  ? [
                      { value: "Draft", label: "Draft" },
                      { value: "Open", label: "Open (Submit)" },
                      { value: "Closed", label: "Closed" },
                    ]
                  : [
                      { value: "Draft", label: "Draft" },
                      { value: "Open", label: "Open (Submit)" },
                    ]
              }
            />
          </div>
        </div>
      </div>

      {/* ─── Section 4: Executive Summary (Markdown) ─── */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="mb-5 text-lg font-semibold text-dark dark:text-white">
          Executive Summary
        </h3>
        <MarkdownEditor
          label=""
          name="executiveSummary"
          defaultValue={val.executiveSummary}
          height="250px"
          placeholder="Enter executive summary in Markdown..."
          error={fieldErrors?.executiveSummary?.[0]}
        />
      </div>

      {/* ─── Section 5: Impact (Markdown) ─── */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="mb-5 text-lg font-semibold text-dark dark:text-white">
          Impact
        </h3>
        <MarkdownEditor
          label=""
          name="impact"
          defaultValue={val.impact}
          height="250px"
          placeholder="Enter impact analysis in Markdown..."
          error={fieldErrors?.impact?.[0]}
        />
      </div>

      {/* ─── Section 6: Recommendation (Markdown) ─── */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="mb-5 text-lg font-semibold text-dark dark:text-white">
          Recommendation
        </h3>
        <MarkdownEditor
          label=""
          name="recommendationSummary"
          defaultValue={val.recommendationSummary}
          height="250px"
          placeholder="Enter recommendation summary in Markdown..."
          error={fieldErrors?.recommendationSummary?.[0]}
        />
      </div>

      {/* ─── Section 7: Attachments ─── */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="mb-5 text-lg font-semibold text-dark dark:text-white">
          Attachments
        </h3>
        <AttachmentDropzone
          attachments={attachments}
          onChange={setAttachments}
        />
        {/* Pass attachment metadata to server action */}
        <input type="hidden" name="attachmentsJson" value={JSON.stringify(attachments)} />
      </div>



      {/* ─── Actions ─── */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={pending}
          className="rounded-lg border border-stroke px-6 py-2.5 text-sm font-medium text-dark transition-colors hover:bg-gray-2 disabled:opacity-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {pending
            ? "Saving..."
            : isEditing
              ? "Update Report"
              : "Create Report"}
        </button>
      </div>
    </form>

    {/* Template Picker Modal */}
    <TemplatePickerModal
      open={pickerOpen}
      templates={templates}
      onSelect={handleTemplatePick}
      onClose={() => setPickerOpen(false)}
    />
    </>
  );
}
