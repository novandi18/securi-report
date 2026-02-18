"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload,
  FileText,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileUp,
  Calendar,
  HardDrive,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  uploadCustomTemplate,
  deleteCustomTemplate,
} from "@/lib/actions/template-actions";
import type { TemplateData } from "@/lib/actions/template-actions";

/* ─── Props ─────────────────────────────────────────── */

interface CustomTemplateClientProps {
  template: TemplateData | null;
}

/* ─── Component ─────────────────────────────────────── */

export default function CustomTemplateClient({
  template: initialTemplate,
}: CustomTemplateClientProps) {
  const { addToast } = useToast();

  /* ── State ── */
  const [template, setTemplate] = useState<TemplateData | null>(
    initialTemplate,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Upload handler ── */
  const handleUpload = useCallback(
    async (file: File) => {
      /* Client-side pre-validation */
      if (file.type !== "application/pdf") {
        addToast("Only PDF files are accepted.", "error");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        addToast("File too large. Maximum size is 10 MB.", "error");
        return;
      }

      setUploading(true);
      setUploadProgress("Uploading file…");

      try {
        setUploadProgress("Extracting text from PDF…");

        const formData = new FormData();
        formData.append("file", file);

        const result = await uploadCustomTemplate(formData);

        if (!result.success) {
          addToast(result.error || "Upload failed.", "error");
          return;
        }

        addToast("Template uploaded and text extracted successfully.", "success");

        // Optimistic update — refetch from server via page revalidation
        // For immediate UX we set a placeholder. The page will revalidate.
        setTemplate({
          id: 1,
          fileName: file.name,
          extractedText: "Reloading…",
          fileSizeKb: Math.round(file.size / 1024),
          updatedAt: new Date(),
        });

        // Force a full page refresh to get server-fresh data
        window.location.reload();
      } catch {
        addToast("An unexpected error occurred during upload.", "error");
      } finally {
        setUploading(false);
        setUploadProgress("");
      }
    },
    [addToast],
  );

  /* ── Delete handler ── */
  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const result = await deleteCustomTemplate();

      if (!result.success) {
        addToast(result.error || "Delete failed.", "error");
        return;
      }

      addToast("Template deleted successfully.", "success");
      setTemplate(null);
      setShowPreview(false);
    } catch {
      addToast("An unexpected error occurred while deleting.", "error");
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  }, [addToast]);

  /* ── Drag & Drop ── */
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);
  const onDragLeave = useCallback(() => setDragOver(false), []);
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload],
  );
  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
      // Reset so same file can be re-uploaded
      e.target.value = "";
    },
    [handleUpload],
  );

  /* ── Format date ── */
  const formatDate = (date: Date | null) => {
    if (!date) return "—";
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date(date));
  };

  return (
    <div className="space-y-6">
      {/* ─── Description Header ─── */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-sm dark:border-dark-3 dark:bg-dark-2">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <FileText size={24} className="text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-dark dark:text-white">
              Custom Report Template
            </h3>
            <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
              Upload laporan referensi terbaik perusahaan Anda sebagai standar
              gaya penulisan. Teks akan diekstrak dari PDF dan disimpan sebagai
              acuan struktural dan gaya untuk mesin pelaporan.
            </p>
          </div>
        </div>
      </div>

      {/* ─── Current Template Card ─── */}
      {template && (
        <div className="rounded-xl border border-stroke bg-white p-6 shadow-sm dark:border-dark-3 dark:bg-dark-2">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-dark dark:text-white">
              <CheckCircle2 size={16} className="text-green-500" />
              Active Template
            </h4>
            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* File Name */}
            <div className="flex items-center gap-3 rounded-lg border border-stroke/60 bg-gray-1 px-4 py-3 dark:border-dark-3/60 dark:bg-dark-3/30">
              <FileText size={18} className="shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-dark-5 dark:text-dark-6">
                  File Name
                </p>
                <p
                  className="truncate text-sm font-medium text-dark dark:text-white"
                  title={template.fileName}
                >
                  {template.fileName}
                </p>
              </div>
            </div>

            {/* Upload Date */}
            <div className="flex items-center gap-3 rounded-lg border border-stroke/60 bg-gray-1 px-4 py-3 dark:border-dark-3/60 dark:bg-dark-3/30">
              <Calendar size={18} className="shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-dark-5 dark:text-dark-6">
                  Upload Date
                </p>
                <p className="text-sm font-medium text-dark dark:text-white">
                  {formatDate(template.updatedAt)}
                </p>
              </div>
            </div>

            {/* File Size */}
            <div className="flex items-center gap-3 rounded-lg border border-stroke/60 bg-gray-1 px-4 py-3 dark:border-dark-3/60 dark:bg-dark-3/30">
              <HardDrive size={18} className="shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-dark-5 dark:text-dark-6">
                  File Size
                </p>
                <p className="text-sm font-medium text-dark dark:text-white">
                  {template.fileSizeKb
                    ? `${template.fileSizeKb.toLocaleString()} KB`
                    : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* ── Preview Toggle ── */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80"
            >
              <Eye size={14} />
              {showPreview ? "Hide Preview" : "Show Extracted Text Preview"}
            </button>

            {showPreview && (
              <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-stroke/60 bg-gray-1 p-4 dark:border-dark-3/60 dark:bg-dark-3/20">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-dark-5 dark:text-dark-6">
                  First 1000 characters of extracted text
                </p>
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-dark-4 dark:text-dark-6">
                  {template.extractedText.slice(0, 1000)}
                  {template.extractedText.length > 1000 && (
                    <span className="text-dark-5/60">
                      {"\n\n"}… ({template.extractedText.length.toLocaleString()}{" "}
                      total characters)
                    </span>
                  )}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Upload Zone ─── */}
      <div className="rounded-xl border border-stroke bg-white p-6 shadow-sm dark:border-dark-3 dark:bg-dark-2">
        <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold text-dark dark:text-white">
          <FileUp size={16} className="text-primary" />
          {template ? "Replace Template" : "Upload Template"}
        </h4>

        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          className={cn(
            "relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-all",
            uploading && "pointer-events-none opacity-60",
            dragOver
              ? "border-primary bg-primary/5 dark:bg-primary/10"
              : "border-stroke hover:border-primary/50 hover:bg-gray-1 dark:border-dark-3 dark:hover:border-primary/40 dark:hover:bg-dark-3/30",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            onChange={onFileChange}
            className="hidden"
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={32} className="animate-spin text-primary" />
              <p className="text-sm font-medium text-dark dark:text-white">
                {uploadProgress}
              </p>
              <p className="text-xs text-dark-5 dark:text-dark-6">
                Please wait while the text is being extracted from the PDF…
              </p>
            </div>
          ) : (
            <>
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                <Upload size={24} className="text-primary" />
              </div>
              <p className="text-sm font-medium text-dark dark:text-white">
                Drag and drop your PDF here, or{" "}
                <span className="text-primary">click to browse</span>
              </p>
              <p className="mt-1 text-xs text-dark-5 dark:text-dark-6">
                PDF only • Max 10 MB • Text-based PDF required
              </p>
            </>
          )}
        </div>

        {/* Hint */}
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200/60 bg-amber-50/50 px-4 py-3 dark:border-amber-900/30 dark:bg-amber-950/20">
          <AlertTriangle
            size={16}
            className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
          />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Pastikan PDF yang diunggah berisi teks (bukan scan/gambar). PDF yang
            dienkripsi atau dilindungi password tidak dapat diproses. Mengunggah
            template baru akan menimpa template yang ada.
          </p>
        </div>
      </div>

      {/* ─── No Template State ─── */}
      {!template && !uploading && (
        <div className="rounded-xl border border-dashed border-stroke bg-gray-1/50 py-12 text-center dark:border-dark-3 dark:bg-dark-3/10">
          <FileText
            size={40}
            className="mx-auto mb-3 text-dark-5/40 dark:text-dark-6/30"
          />
          <p className="text-sm font-medium text-dark-5 dark:text-dark-6">
            No template uploaded
          </p>
          <p className="mt-1 text-xs text-dark-5/70 dark:text-dark-6/60">
            Upload a reference PDF report to set your company&apos;s writing
            standard.
          </p>
        </div>
      )}

      {/* ─── Delete Confirmation ─── */}
      <ConfirmDialog
        open={showDeleteDialog}
        title="Delete Template"
        message="Are you sure you want to delete the current template? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </div>
  );
}
