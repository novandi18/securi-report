"use client";

import { useActionState, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/use-role";
import { useToast } from "@/components/ui/toast";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import InputGroup from "@/components/FormElements/InputGroup";
import { Select } from "@/components/FormElements/select";
import { MarkdownEditor } from "@/components/markdown-editor";
import { CvssInput } from "@/components/FormElements/cvss-input";
import type { ActionResult } from "@/lib/actions/template";

export interface TemplateFormData {
  id?: string;
  title: string;
  severity: string | null;
  cvssScore: string | null;
  cvssVector: string | null;
  description: string | null;
  impact: string | null;
  recommendation: string | null;
  referencesLink: string | null;
  cweId: number | null;
  owaspId: number | null;
}

interface TemplateFormProps {
  template?: TemplateFormData | null;
  cweList: { id: number; title: string }[];
  owaspList: { id: number; code: string; title: string; version: string }[];
  serverAction: (
    prevState: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
}

const SEVERITY_OPTIONS = [
  { value: "Critical", label: "Critical" },
  { value: "High", label: "High" },
  { value: "Medium", label: "Medium" },
  { value: "Low", label: "Low" },
  { value: "Info", label: "Info" },
  { value: "None", label: "None" },
];

export default function TemplateForm({
  template,
  cweList,
  owaspList,
  serverAction,
}: TemplateFormProps) {
  const { addToast } = useToast();
  const router = useRouter();

  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(serverAction, null);

  const isEditing = !!template?.id;

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
          ? "Template updated successfully."
          : "Template created successfully.",
        "success",
      );
      router.push("/kb/templates");
      router.refresh();
    } else if (state?.error) {
      addToast(state.error, "error");
    }
  }, [state, addToast, router, isEditing]);

  const fieldErrors = state?.fieldErrors;

  // Use returned values on error, otherwise fall back to entity prop
  const v = state?.values;
  const val = {
    title: v?.title ?? template?.title ?? "",
    severity: v?.severity ?? template?.severity ?? "Info",
    cvssScore: v?.cvssScore ?? template?.cvssScore ?? "0.0",
    cvssVector: v?.cvssVector ?? template?.cvssVector ?? "",
    description: v?.description ?? template?.description ?? "",
    impact: v?.impact ?? template?.impact ?? "",
    recommendation: v?.recommendation ?? template?.recommendation ?? "",
    referencesLink: v?.referencesLink ?? template?.referencesLink ?? "",
    cweId: v?.cweId ?? String(template?.cweId ?? ""),
    owaspId: v?.owaspId ?? String(template?.owaspId ?? ""),
  };

  const formKey =
    state && !state.success
      ? `err-${Date.now()}`
      : `clean-${template?.id ?? "new"}`;

  // Build CWE options for dropdown
  const cweOptions = [
    { value: "", label: "— None —" },
    ...cweList.map((c) => ({
      value: String(c.id),
      label: `CWE-${c.id}: ${c.title}`,
    })),
  ];

  // Build OWASP options for dropdown
  const owaspOptions = [
    { value: "", label: "— None —" },
    ...owaspList.map((o) => ({
      value: String(o.id),
      label: `${o.code}: ${o.title}`,
    })),
  ];

  // ─── CWE Search state ───
  const [cweSearch, setCweSearch] = useState("");
  const [owaspSearch, setOwaspSearch] = useState("");

  const filteredCwe = cweOptions.filter(
    (o) =>
      o.value === "" ||
      o.label.toLowerCase().includes(cweSearch.toLowerCase()),
  );

  const filteredOwasp = owaspOptions.filter(
    (o) =>
      o.value === "" ||
      o.label.toLowerCase().includes(owaspSearch.toLowerCase()),
  );

  return (
    <form key={formKey} action={formAction} className="space-y-8" onChange={markDirty}>
      {isEditing && <input type="hidden" name="id" value={template!.id} />}

      {/* ─── Section 1: Core Info ─── */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="mb-5 text-lg font-semibold text-dark dark:text-white">
          Template Information
        </h3>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* Title */}
          <div className="md:col-span-2">
            <InputGroup
              label="Title"
              name="title"
              type="text"
              placeholder="e.g. SQL Injection in Login Form"
              required
              defaultValue={val.title}
            />
            {fieldErrors?.title && (
              <p className="mt-1 text-xs text-red-500">
                {fieldErrors.title[0]}
              </p>
            )}
          </div>

          {/* Severity */}
          <div>
            <Select
              label="Severity"
              name="severity"
              defaultValue={val.severity}
              items={SEVERITY_OPTIONS}
            />
            {fieldErrors?.severity && (
              <p className="mt-1 text-xs text-red-500">
                {fieldErrors.severity[0]}
              </p>
            )}
          </div>

          {/* CVSS Score */}
          <div>
            <InputGroup
              label="CVSS Score (0.0 - 10.0)"
              name="cvssScore"
              type="number"
              placeholder="0.0"
              defaultValue={val.cvssScore}
            />
            {fieldErrors?.cvssScore && (
              <p className="mt-1 text-xs text-red-500">
                {fieldErrors.cvssScore[0]}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ─── Section 2: CVSS Vector ─── */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="mb-5 text-lg font-semibold text-dark dark:text-white">
          CVSS 4.0 Calculator
        </h3>
        <CvssInput
          name="cvssVector"
          defaultValue={val.cvssVector}
          error={fieldErrors?.cvssVector?.[0]}
        />
      </div>

      {/* ─── Section 3: Framework Linking ─── */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="mb-5 text-lg font-semibold text-dark dark:text-white">
          Framework Linking
        </h3>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* CWE */}
          <div>
            <label className="mb-2 block text-body-sm font-medium text-dark dark:text-white">
              CWE Reference
            </label>
            <input
              type="text"
              placeholder="Search CWE..."
              value={cweSearch}
              onChange={(e) => setCweSearch(e.target.value)}
              className="mb-2 w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-sm outline-none transition focus:border-primary dark:border-dark-3 dark:focus:border-primary"
            />
            <Select
              label=""
              name="cweId"
              defaultValue={val.cweId}
              placeholder="Select CWE"
              items={filteredCwe}
            />
          </div>

          {/* OWASP */}
          <div>
            <label className="mb-2 block text-body-sm font-medium text-dark dark:text-white">
              OWASP Reference
            </label>
            <input
              type="text"
              placeholder="Search OWASP..."
              value={owaspSearch}
              onChange={(e) => setOwaspSearch(e.target.value)}
              className="mb-2 w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-sm outline-none transition focus:border-primary dark:border-dark-3 dark:focus:border-primary"
            />
            <Select
              label=""
              name="owaspId"
              defaultValue={val.owaspId}
              placeholder="Select OWASP"
              items={filteredOwasp}
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
          placeholder="Describe the vulnerability in Markdown..."
          error={fieldErrors?.description?.[0]}
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
          height="200px"
          placeholder="Describe the impact in Markdown..."
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
          name="recommendation"
          defaultValue={val.recommendation}
          height="250px"
          placeholder="Describe remediation steps in Markdown..."
          error={fieldErrors?.recommendation?.[0]}
        />
      </div>

      {/* ─── Section 7: References ─── */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="mb-5 text-lg font-semibold text-dark dark:text-white">
          References
        </h3>
        <div>
          <label className="mb-2 block text-body-sm font-medium text-dark dark:text-white">
            Reference Links
          </label>
          <textarea
            name="referencesLink"
            rows={3}
            defaultValue={val.referencesLink}
            placeholder="Enter reference URLs (one per line)..."
            className="w-full rounded-lg border border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:focus:border-primary"
          />
          {fieldErrors?.referencesLink && (
            <p className="mt-1 text-xs text-red-500">
              {fieldErrors.referencesLink[0]}
            </p>
          )}
        </div>
      </div>

      {/* ─── Submit ─── */}
      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={() => router.push("/kb/templates")}
          className="rounded-lg border border-stroke px-6 py-2.5 text-sm font-medium text-dark transition-colors hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
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
              ? "Update Template"
              : "Create Template"}
        </button>
      </div>
    </form>
  );
}
