"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { uploadTempAttachmentAction } from "@/lib/actions/attachment";
import { Loader2, Trash2, Upload } from "lucide-react";

const MAX_ATTACHMENTS = 10;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png"];
const MAX_SIZE = 5 * 1024 * 1024;

export interface AttachmentFile {
  id: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

interface AttachmentDropzoneProps {
  /** Current attachments list */
  attachments: AttachmentFile[];
  /** Called when attachments change */
  onChange: (attachments: AttachmentFile[]) => void;
  /** Error message */
  error?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentDropzone({
  attachments,
  onChange,
  error,
}: AttachmentDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const canAdd = attachments.length < MAX_ATTACHMENTS;

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const remaining = MAX_ATTACHMENTS - attachments.length;
      const toUpload = fileArray.slice(0, remaining);

      if (toUpload.length === 0) {
        setUploadError(`Maximum ${MAX_ATTACHMENTS} attachments reached.`);
        return;
      }

      // Validate all files first
      for (const file of toUpload) {
        if (!ALLOWED_TYPES.includes(file.type)) {
          setUploadError("Invalid file type. Only JPG, JPEG, and PNG are allowed.");
          return;
        }
        if (file.size > MAX_SIZE) {
          setUploadError(`File "${file.name}" is too large. Maximum is 5 MB.`);
          return;
        }
      }

      setUploadError(null);
      setUploading(true);

      try {
        const uploaded: AttachmentFile[] = [];

        for (const file of toUpload) {
          const fd = new FormData();
          fd.append("file", file);
          const result = await uploadTempAttachmentAction(fd);

          if (result.success && result.data) {
            uploaded.push(result.data);
          } else {
            setUploadError(result.error || `Failed to upload "${file.name}".`);
          }
        }

        if (uploaded.length > 0) {
          onChange([...attachments, ...uploaded]);
        }
      } catch {
        setUploadError("Upload failed. Please try again.");
      } finally {
        setUploading(false);
      }

      if (fileArray.length > remaining) {
        setUploadError(
          `Only ${remaining} more attachment(s) allowed (max ${MAX_ATTACHMENTS}).`,
        );
      }
    },
    [attachments, onChange],
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);

      if (!canAdd) return;
      await handleFiles(e.dataTransfer.files);
    },
    [canAdd, handleFiles],
  );

  const handleInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        await handleFiles(e.target.files);
      }
      e.target.value = "";
    },
    [handleFiles],
  );

  const removeAttachment = useCallback(
    (id: string) => {
      onChange(attachments.filter((a) => a.id !== id));
    },
    [attachments, onChange],
  );

  return (
    <div className="space-y-3">
      <label className="block text-body-sm font-medium text-dark dark:text-white">
        Attachments
        <span className="ml-2 text-xs font-normal text-dark-5 dark:text-dark-6">
          ({attachments.length}/{MAX_ATTACHMENTS})
        </span>
      </label>

      {/* Dropzone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => canAdd && !uploading && fileInputRef.current?.click()}
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
          isDragging
            ? "border-primary bg-primary/5 dark:bg-primary/10"
            : "border-stroke hover:border-primary/50 dark:border-dark-3 dark:hover:border-primary/50",
          !canAdd && "cursor-not-allowed opacity-50",
          uploading && "pointer-events-none",
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png"
          multiple
          className="hidden"
          onChange={handleInputChange}
          disabled={!canAdd || uploading}
        />

        {uploading ? (
          <div className="flex items-center gap-2 text-sm text-dark-5 dark:text-dark-6">
            <Loader2 size={20} className="animate-spin" />
            Uploading...
          </div>
        ) : (
          <>
            <Upload
              size={28}
              className={cn(
                "mb-2",
                isDragging
                  ? "text-primary"
                  : "text-dark-5 dark:text-dark-6",
              )}
            />
            <p className="text-sm font-medium text-dark dark:text-white">
              {isDragging ? "Drop images here" : "Drag & drop images here"}
            </p>
            <p className="mt-1 text-xs text-dark-5 dark:text-dark-6">
              or click to browse — JPG, PNG up to 5 MB
            </p>
          </>
        )}
      </div>

      {/* Errors */}
      {(error || uploadError) && (
        <p className="text-xs text-red-500">{error || uploadError}</p>
      )}

      {/* Attachment thumbnails */}
      {attachments.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="group relative overflow-hidden rounded-lg border border-stroke dark:border-dark-3"
            >
              <div className="aspect-square bg-gray-1 dark:bg-dark-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={att.fileUrl}
                  alt={att.fileName}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="px-2 py-1.5">
                <p className="truncate text-[10px] font-medium text-dark dark:text-white">
                  {att.fileName}
                </p>
                <p className="text-[9px] text-dark-5 dark:text-dark-6">
                  {formatSize(att.fileSize)}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeAttachment(att.id);
                }}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500/90 text-white opacity-0 transition-opacity group-hover:opacity-100"
                title="Remove"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Hidden inputs for form submission */}
      {attachments.map((att, i) => (
        <input
          key={att.id}
          type="hidden"
          name={`attachments[${i}]`}
          value={JSON.stringify(att)}
        />
      ))}
    </div>
  );
}
