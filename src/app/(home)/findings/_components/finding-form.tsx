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
import { isDevClient } from "@/lib/env";

// ─── Severity → single letter map ───
const SEVERITY_LETTER: Record<string, string> = {
  Critical: "C",
  High: "H",
  Medium: "M",
  Low: "L",
  Info: "I",
};

interface FindingFormProps {
  customers: { id: string; name: string; code: string }[];
  serverAction: (
    prevState: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
}

export default function FindingForm({
  customers,
  serverAction,
}: FindingFormProps) {
  const { isAdmin } = useRole();
  const { addToast } = useToast();
  const router = useRouter();

  // Attachment state
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);

  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(serverAction, null);

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
      addToast("Finding created successfully.", "success");
      router.push("/findings");
      router.refresh();
    } else if (state?.error) {
      addToast(state.error, "error");
    }
  }, [state, addToast, router]);

  const fieldErrors = state?.fieldErrors;

  const v = state?.values;
  // ─── Dev dummy data ───
  const devDefaults = isDevClient && !v ? {
    title: "Sensitive Information Disclosure via Unauthenticated SMB Null Session",
    serviceAffected: "SMB",
    findingSequence: "1",
    severity: "High",
    location: "192.1.2.95 - H2H/API Server CIRT KSEI",
    description: "Berdasarkan hasil Pemindaian menggunakan Nmap mengungkap adanya port 445 (microsoft-ds) yang aktif.\n\nMelakukan pengujian untuk melihat apakah server memberikan izin kepada siapa pun untuk melihat daftar folder di dalamnya tanpa perlu melakukan proses login.\n\nSetelah mendapatkan list direktori, tim mencoba masuk ke salah satu share yang terdeteksi untuk membuktikan bahwa file dapat diakses dan dibaca. Dengan perintah ls menampilkan ratusan file instalasi, dokumen backup, dan data operasional internal.",
    referencesList: "- CWE-284 (Improper Access Control)\n- CWE-200 (Exposure of Sensitive Information to an Unauthorized Actor)",
    cvssVector: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N",
    impact: "- **Kebocoran Data Sensitif:** Tereksposnya data operasional perusahaan dan dokumen rahasia kepada pihak tidak berwenang.\n\n- **Pencurian Kredensial:** Penyerang dapat menemukan username, password, atau keys yang tertinggal di dalam file instalasi atau konfigurasi.\n\n- **Batu Loncatan Serangan (Lateral Movement):** Data yang didapat bisa digunakan sebagai pijakan awal untuk meretas layanan internal lain.\n\n- **Risiko Ransomware:** Jika ada folder yang mengizinkan akses modifikasi (_Write Access_), peretas dapat dengan mudah menanamkan malware atau mengenkripsi data.",
    recommendation: "1.  **Blokir Akses Internet:** Segera tutup Port 445 (SMB) dan 139 di level firewall eksternal. Layanan ini tidak boleh terekspos langsung ke publik.\n2.  **Nonaktifkan Null Session:** Ubah konfigurasi _Registry_ atau _Group Policy (GPO) Windows_ untuk menolak akses masuk dari pengguna anonim atau tamu (_Guest_).\n3.  **Amankan Data Kritis:** Segera hapus atau pindahkan file sensitif (seperti data kependudukan, file instalasi, dan teks kredensial) dari folder publik (Data PC A, E, Users).",
    status: "Open",
  } : null;

  const val = {
    customerId: v?.customerId ?? "",
    reportIdCustom: v?.reportIdCustom ?? "",
    title: v?.title ?? devDefaults?.title ?? "",
    clientCode: v?.clientCode ?? "",
    serviceAffected: v?.serviceAffected ?? devDefaults?.serviceAffected ?? "",
    findingSequence: v?.findingSequence ?? devDefaults?.findingSequence ?? "",
    severity: v?.severity ?? devDefaults?.severity ?? "Info",
    location: v?.location ?? devDefaults?.location ?? "",
    description: v?.description ?? devDefaults?.description ?? "",
    pocText: v?.pocText ?? "",
    referencesList: v?.referencesList ?? devDefaults?.referencesList ?? "",
    cvssVector: v?.cvssVector ?? devDefaults?.cvssVector ?? "",
    cvssScore: v?.cvssScore ?? "",
    impact: v?.impact ?? devDefaults?.impact ?? "",
    recommendation: v?.recommendation ?? devDefaults?.recommendation ?? "",
    status: v?.status ?? devDefaults?.status ?? "Open",
  };

  // ─── Issue Reference Builder (React state) ───
  const [selectedCustomerId, setSelectedCustomerId] = useState(val.customerId);
  const customerCodeMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of customers) map[c.id] = c.code;
    return map;
  }, [customers]);
  const clientCode = selectedCustomerId ? (customerCodeMap[selectedCustomerId] ?? "") : "";
  const [refPrefix, setRefPrefix] = useState<"HTPT" | "HTVA">("HTPT");
  const [severity, setSeverity] = useState(val.severity);
  const [serviceAffected, setServiceAffected] = useState(val.serviceAffected);
  const [findingSeq, setFindingSeq] = useState(val.findingSequence);

  const issueReferenceNumber = useMemo(() => {
    const cc = clientCode.toUpperCase().trim();
    const sl = SEVERITY_LETTER[severity] ?? "I";
    const svc = serviceAffected.toUpperCase().trim();
    const seq = findingSeq ? String(parseInt(findingSeq, 10) || 0).padStart(3, "0") : "001";

    if (!cc && !svc) return "";
    return `${refPrefix}-${cc || "XX"}-${sl}-${svc || "SVC"}-${seq}`;
  }, [clientCode, severity, serviceAffected, findingSeq, refPrefix]);

  const formKey = state && !state.success
    ? `err-${Date.now()}`
    : "clean-new";

  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: c.name,
  }));

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

  return (
    <form key={formKey} action={formAction} className="space-y-8" onChange={markDirty}>
      <input type="hidden" name="issueReferenceNumber" value={issueReferenceNumber} />

      {/* ─── Section 1: Issue Reference Builder ─── */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="mb-5 text-lg font-semibold text-dark dark:text-white">
          Issue Reference Builder
        </h3>

        <div className="mb-6 rounded-lg border-2 border-primary/30 bg-primary/5 p-4 text-center dark:bg-primary/10">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-dark-5 dark:text-dark-6">
            Issue Reference Number
          </p>
          <p className="font-mono text-2xl font-bold tracking-wide text-primary">
            {issueReferenceNumber || `${refPrefix}-XX-I-SVC-001`}
          </p>
          <p className="mt-1 text-xs text-dark-5 dark:text-dark-6">
            Format: &#123;Prefix&#125;-&#123;ClientCode&#125;-&#123;Severity&#125;-&#123;Service&#125;-&#123;Sequence&#125;
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
              Prefix
            </label>
            <select
              value={refPrefix}
              onChange={(e) => setRefPrefix(e.target.value as "HTPT" | "HTVA")}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
            >
              <option value="HTPT">HTPT — Pentest</option>
              <option value="HTVA">HTVA — VA Scan</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
              Client Code
            </label>
            <input
              type="text"
              name="clientCode"
              readOnly
              value={clientCode}
              placeholder="Select a customer"
              className="w-full rounded-lg border border-stroke bg-gray-1 px-4 py-2.5 text-sm uppercase text-dark outline-none dark:border-dark-3 dark:bg-dark-2 dark:text-white cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-dark-5 dark:text-dark-6">Auto-filled from selected customer</p>
          </div>

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
          <div>
            <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
              Customer <span className="text-red-500">*</span>
            </label>
            <select
              name="customerId"
              required
              value={selectedCustomerId}
              onChange={(e) => {
                setSelectedCustomerId(e.target.value);
                markDirty();
              }}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
            >
              <option value="">Select a customer</option>
              {customerOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {fieldErrors?.customerId && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.customerId[0]}</p>
            )}
          </div>

          <div>
            <InputGroup
              label="Report ID (Optional)"
              name="reportIdCustom"
              type="text"
              placeholder="Auto-generated if empty"
              defaultValue={val.reportIdCustom}
            />
          </div>

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
          <CvssInput
            name="cvssVector"
            defaultValue={val.cvssVector}
            error={fieldErrors?.cvssVector?.[0]}
          />

          <div className="max-w-xs">
            <Select
              label="Status"
              name="status"
              defaultValue={val.status}
              items={[
                { value: "Open", label: "Open" },
                { value: "Closed", label: "Closed" },
              ]}
            />
          </div>
        </div>
      </div>

      {/* ─── Section 4: PoC Screenshots ─── */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="mb-3 text-lg font-semibold text-dark dark:text-white">
          PoC Screenshots & Evidence
        </h3>
        <p className="mb-4 text-sm text-dark-5 dark:text-dark-6">
          Upload proof-of-concept screenshots. To embed an image in the Description editor below, use
          the syntax: <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-primary dark:bg-dark-3">{'![upload]["filename.png"]'}</code>
        </p>

        <AttachmentDropzone
          attachments={attachments}
          onChange={setAttachments}
        />
        <input type="hidden" name="attachmentsJson" value={JSON.stringify(attachments)} />

        {/* Show copy-paste reference helpers */}
        {attachments.length > 0 && (
          <div className="mt-4 rounded-lg border border-stroke bg-gray-1 p-3 dark:border-dark-3 dark:bg-dark-2">
            <p className="mb-2 text-xs font-medium text-dark-5 dark:text-dark-6">
              Click to copy embed syntax:
            </p>
            <div className="flex flex-wrap gap-2">
              {attachments.map((att) => (
                <button
                  key={att.id}
                  type="button"
                  onClick={() => {
                    const syntax = `![upload]["${att.fileName}"]`;
                    navigator.clipboard.writeText(syntax);
                  }}
                  className="rounded border border-stroke bg-white px-2.5 py-1 font-mono text-xs text-dark transition-colors hover:border-primary hover:text-primary dark:border-dark-3 dark:bg-dark-3 dark:text-white dark:hover:border-primary"
                  title={`Copy: ![upload]["${att.fileName}"]`}
                >
                  {att.fileName}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Section 5: Description (Markdown with inline images) ─── */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="mb-2 text-lg font-semibold text-dark dark:text-white">
          Description
        </h3>
        <p className="mb-4 text-sm text-dark-5 dark:text-dark-6">
          Describe the vulnerability. Embed uploaded PoC images using{" "}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-primary dark:bg-dark-3">{'![upload]["filename.png"]'}</code>
        </p>
        <MarkdownEditor
          label=""
          name="description"
          defaultValue={val.description}
          height="350px"
          placeholder={'Describe the vulnerability finding in Markdown...\n\nTo embed an uploaded image:\n![upload]["SMB login.png"]'}
          error={fieldErrors?.description?.[0]}
          attachments={attachmentsMeta}
          onAttachmentAdd={handleAttachmentAdd}
        />
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

      {/* ─── Section 7: Remediation ─── */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="mb-5 text-lg font-semibold text-dark dark:text-white">
          Remediation
        </h3>
        <MarkdownEditor
          label=""
          name="recommendation"
          defaultValue={val.recommendation}
          height="200px"
          placeholder="Provide remediation steps in Markdown..."
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
          {pending ? "Saving..." : "Create Finding"}
        </button>
      </div>
    </form>
  );
}
