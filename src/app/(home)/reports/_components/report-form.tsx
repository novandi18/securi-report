"use client";

import { useActionState, useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/use-role";
import { useToast } from "@/components/ui/toast";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import InputGroup from "@/components/FormElements/InputGroup";
import { Select } from "@/components/FormElements/select";
import { MarkdownEditor } from "@/components/markdown-editor";
import { CvssInput } from "@/components/FormElements/cvss-calculator";
import { AttachmentDropzone, type AttachmentFile } from "@/components/FormElements/attachment-dropzone";
import type { ActionResult } from "@/lib/actions/report";

// ─── Severity → single letter map ───
const SEVERITY_LETTER: Record<string, string> = {
  Critical: "C",
  High: "H",
  Medium: "M",
  Low: "L",
  Info: "I",
};

export interface ReportFormData {
  id?: string;
  customerId: string;
  reportIdCustom: string | null;
  title: string;
  clientCode: string | null;
  serviceAffected: string | null;
  findingSequence: number | null;
  issueReferenceNumber: string | null;
  severity: "Critical" | "High" | "Medium" | "Low" | "Info" | null;
  location: string | null;
  description: string | null;
  pocText: string | null;
  referencesList: string | null;
  cvssVector: string | null;
  cvssScore: string | null;
  impact: string | null;
  recommendation: string | null;
  status: "Open" | "Closed" | "Draft" | null;
  customerName?: string;
}

interface ReportFormProps {
  report?: ReportFormData | null;
  customers: { id: string; name: string }[];
  initialAttachments?: AttachmentFile[];
  serverAction: (
    prevState: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
}

export default function ReportForm({
  report,
  customers,
  initialAttachments = [],
  serverAction,
}: ReportFormProps) {
  const { isAdmin } = useRole();
  const { addToast } = useToast();
  const router = useRouter();

  // Attachment state
  const [attachments, setAttachments] = useState<AttachmentFile[]>(initialAttachments);

  // Attachment metadata for markdown editor preview
  const attachmentsMeta = useMemo(
    () => attachments.map((a) => ({ fileName: a.fileName, fileUrl: a.fileUrl })),
    [attachments],
  );

  const handleAttachmentAdd = useCallback(
    (file: { id: string; fileUrl: string; fileName: string; fileSize: number; mimeType: string }) => {
      setAttachments((prev) => {
        if (prev.some((a) => a.fileName === file.fileName)) return prev;
        return [...prev, file];
      });
    },
    [],
  );

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

  useEffect(() => {
    if (state?.success) {
      setIsDirty(false);
    }
  }, [state?.success]);

  useEffect(() => {
    if (state?.success) {
      addToast(
        isEditing
          ? "Finding report updated successfully."
          : "Finding report created successfully.",
        "success",
      );
      router.push("/reports");
      router.refresh();
    } else if (state?.error) {
      addToast(state.error, "error");
    }
  }, [state, addToast, router, isEditing]);

  const fieldErrors = state?.fieldErrors;

  // Use returned values on error, otherwise fall back to report prop
  const v = state?.values;
  const val = {
    customerId: v?.customerId ?? report?.customerId ?? "",
    reportIdCustom: v?.reportIdCustom ?? report?.reportIdCustom ?? "",
    title: v?.title ?? report?.title ?? "",
    clientCode: v?.clientCode ?? report?.clientCode ?? "",
    serviceAffected: v?.serviceAffected ?? report?.serviceAffected ?? "",
    findingSequence: v?.findingSequence ?? (report?.findingSequence != null ? String(report.findingSequence) : ""),
    severity: v?.severity ?? report?.severity ?? "Info",
    location: v?.location ?? report?.location ?? "",
    description: v?.description ?? report?.description ?? "",
    pocText: v?.pocText ?? report?.pocText ?? "",
    referencesList: v?.referencesList ?? report?.referencesList ?? "",
    cvssVector: v?.cvssVector ?? report?.cvssVector ?? "",
    cvssScore: v?.cvssScore ?? report?.cvssScore ?? "",
    impact: v?.impact ?? report?.impact ?? "",
    recommendation: v?.recommendation ?? report?.recommendation ?? "",
    status: v?.status ?? report?.status ?? "Draft",
  };

  // ─── Issue Reference Builder (React state) ───
  const [clientCode, setClientCode] = useState(val.clientCode);
  const [severity, setSeverity] = useState(val.severity);
  const [serviceAffected, setServiceAffected] = useState(val.serviceAffected);
  const [findingSeq, setFindingSeq] = useState(val.findingSequence);

  const issueReferenceNumber = useMemo(() => {
    const cc = clientCode.toUpperCase().trim();
    const sl = SEVERITY_LETTER[severity] ?? "I";
    const svc = serviceAffected.toUpperCase().trim();
    const seq = findingSeq ? String(parseInt(findingSeq, 10) || 0).padStart(3, "0") : "001";

    if (!cc && !svc) return "";
    return `HTPT-${cc || "XX"}-${sl}-${svc || "SVC"}-${seq}`;
  }, [clientCode, severity, serviceAffected, findingSeq]);

  // Key forces React to re-mount form inputs with updated defaultValue
  const formKey = state && !state.success
    ? `err-${Date.now()}`
    : `clean-${report?.id ?? "new"}`;

  // Build customer options for dropdown
  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  return (
    <form key={formKey} action={formAction} className="space-y-8" onChange={markDirty}>
      {isEditing && <input type="hidden" name="id" value={report!.id} />}
      {/* Hidden field for the compiled issue reference number */}
      <input type="hidden" name="issueReferenceNumber" value={issueReferenceNumber} />

      {/* ─── Section 1: Issue Reference Builder ─── */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="mb-5 text-lg font-semibold text-dark dark:text-white">
          Issue Reference Builder
        </h3>

        {/* Live Preview */}
        <div className="mb-6 rounded-lg border-2 border-primary/30 bg-primary/5 p-4 text-center dark:bg-primary/10">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-dark-5 dark:text-dark-6">
            Issue Reference Number
          </p>
          <p className="font-mono text-2xl font-bold tracking-wide text-primary">
            {issueReferenceNumber || "HTPT-XX-I-SVC-001"}
          </p>
          <p className="mt-1 text-xs text-dark-5 dark:text-dark-6">
            Format: HTPT-&#123;ClientCode&#125;-&#123;Severity&#125;-&#123;Service&#125;-&#123;Sequence&#125;
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Client Code */}
          <div>
            <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
              Client Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="clientCode"
              maxLength={10}
              placeholder="e.g. TF"
              value={clientCode}
              onChange={(e) => {
                setClientCode(e.target.value);
                markDirty();
              }}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm uppercase text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:text-white"
            />
            {fieldErrors?.clientCode && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.clientCode[0]}</p>
            )}
          </div>

          {/* Severity */}
          <div>
            <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
              Severity
            </label>
            <select
              name="severity"
              value={severity}
              onChange={(e) => {
                setSeverity(e.target.value);
                markDirty();
              }}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
            >
              <option value="Critical">Critical (C)</option>
              <option value="High">High (H)</option>
              <option value="Medium">Medium (M)</option>
              <option value="Low">Low (L)</option>
              <option value="Info">Info (I)</option>
            </select>
          </div>

          {/* Service */}
          <div>
            <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
              Service Affected
            </label>
            <input
              type="text"
              name="serviceAffected"
              maxLength={50}
              placeholder="e.g. SMB, HTTP, API"
              value={serviceAffected}
              onChange={(e) => {
                setServiceAffected(e.target.value);
                markDirty();
              }}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm uppercase text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:text-white"
            />
            {fieldErrors?.serviceAffected && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.serviceAffected[0]}</p>
            )}
          </div>

          {/* Finding Sequence */}
          <div>
            <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
              Finding Sequence
            </label>
            <input
              type="number"
              name="findingSequence"
              min={1}
              max={999}
              placeholder="e.g. 3"
              value={findingSeq}
              onChange={(e) => {
                setFindingSeq(e.target.value);
                markDirty();
              }}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* ─── Section 2: Core Finding Info ─── */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="mb-5 text-lg font-semibold text-dark dark:text-white">
          Finding Information
        </h3>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* Customer */}
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
              <p className="mt-1 text-xs text-red-500">{fieldErrors.customerId[0]}</p>
            )}
          </div>

          {/* Report ID */}
          <div>
            <InputGroup
              label="Report ID (Optional)"
              name="reportIdCustom"
              type="text"
              placeholder="Auto-generated if empty"
              defaultValue={val.reportIdCustom}
            />
          </div>

          {/* Finding Title */}
          <div className="md:col-span-2">
            <InputGroup
              label="Finding Title (Issue Title)"
              name="title"
              type="text"
              placeholder="e.g. SQL Injection in Login Form"
              required
              defaultValue={val.title}
            />
            {fieldErrors?.title && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.title[0]}</p>
            )}
          </div>

          {/* Location / Affected Module */}
          <div className="md:col-span-2">
            <InputGroup
              label="Location / Affected Module"
              name="location"
              type="text"
              placeholder="e.g. /api/v1/auth/login"
              defaultValue={val.location}
            />
          </div>
        </div>
      </div>

      {/* ─── Section 3: CVSS & Status ─── */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="mb-5 text-lg font-semibold text-dark dark:text-white">
          CVSS & Status
        </h3>

        <div className="space-y-6">
          {/* CVSS 4.0 Vector */}
          <CvssInput
            name="cvssVector"
            defaultValue={val.cvssVector}
            error={fieldErrors?.cvssVector?.[0]}
          />

          {/* CVSS Score */}
          <div className="max-w-xs">
            <InputGroup
              label="Result Score"
              name="cvssScore"
              type="text"
              placeholder="e.g. 8.8"
              defaultValue={val.cvssScore}
            />
          </div>

          {/* Status */}
          <div className="max-w-xs">
            <Select
              label="Status"
              name="status"
              defaultValue={val.status}
              items={
                isAdmin
                  ? [
                      { value: "Draft", label: "Draft" },
                      { value: "Open", label: "Open" },
                      { value: "Closed", label: "Closed" },
                    ]
                  : [
                      { value: "Draft", label: "Draft" },
                      { value: "Open", label: "Open" },
                    ]
              }
            />
          </div>
        </div>
      </div>

      {/* ─── Section 4: Description (Markdown) ─── */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="mb-5 text-lg font-semibold text-dark dark:text-white">
          Description
        </h3>
        <MarkdownEditor
          label=""
          name="description"
          defaultValue={val.description}
          height="250px"
          placeholder="Describe the vulnerability finding in Markdown..."
          error={fieldErrors?.description?.[0]}
          attachments={attachmentsMeta}
          onAttachmentAdd={handleAttachmentAdd}
        />
      </div>

      {/* ─── Section 5: Proof of Concept ─── */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="mb-5 text-lg font-semibold text-dark dark:text-white">
          Proof of Concept
        </h3>
        <MarkdownEditor
          label="PoC Steps / Text"
          name="pocText"
          defaultValue={val.pocText}
          height="200px"
          placeholder="Step-by-step proof of concept in Markdown..."
          error={fieldErrors?.pocText?.[0]}
          attachments={attachmentsMeta}
          onAttachmentAdd={handleAttachmentAdd}
        />

        <div className="mt-6">
          <h4 className="mb-3 text-sm font-medium text-dark dark:text-white">
            PoC Images / Attachments
          </h4>
          <AttachmentDropzone
            attachments={attachments}
            onChange={setAttachments}
          />
          <input type="hidden" name="attachmentsJson" value={JSON.stringify(attachments)} />
        </div>
      </div>

      {/* ─── Section 6: Impact (Markdown) ─── */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="mb-5 text-lg font-semibold text-dark dark:text-white">
          Impact
        </h3>
        <MarkdownEditor
          label=""
          name="impact"
          defaultValue={val.impact}
          height="200px"
          placeholder="Describe the impact of this vulnerability..."
          error={fieldErrors?.impact?.[0]}
          attachments={attachmentsMeta}
          onAttachmentAdd={handleAttachmentAdd}
        />
      </div>

      {/* ─── Section 7: Recommendation (Markdown) ─── */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="mb-5 text-lg font-semibold text-dark dark:text-white">
          Recommendation
        </h3>
        <MarkdownEditor
          label=""
          name="recommendation"
          defaultValue={val.recommendation}
          height="200px"
          placeholder="Provide remediation recommendations in Markdown..."
          error={fieldErrors?.recommendation?.[0]}
          attachments={attachmentsMeta}
          onAttachmentAdd={handleAttachmentAdd}
        />
      </div>

      {/* ─── Section 8: References (CWE/OWASP) ─── */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="mb-5 text-lg font-semibold text-dark dark:text-white">
          References
        </h3>
        <MarkdownEditor
          label=""
          name="referencesList"
          defaultValue={val.referencesList}
          height="150px"
          placeholder="CWE/OWASP references in Markdown..."
          error={fieldErrors?.referencesList?.[0]}
          attachments={attachmentsMeta}
          onAttachmentAdd={handleAttachmentAdd}
        />
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
              ? "Update Finding"
              : "Create Report"}
        </button>
      </div>
    </form>
  );
}
