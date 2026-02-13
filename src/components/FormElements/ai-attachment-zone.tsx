"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadTempAttachmentAction } from "@/lib/actions/attachment";

/* ─── Constants ─────────────────────────────────────── */

const MAX_IMAGES = 10;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

/* ─── Types ─────────────────────────────────────────── */

export interface PoCImage {
  id: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

interface AIAttachmentZoneProps {
  images: PoCImage[];
  onChange: (images: PoCImage[]) => void;
  error?: string;
  /** Label override (default: "PoC Attachments") */
  label?: string;
}

/* ─── Helpers ───────────────────────────────────────── */

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ─── Animation Variants ────────────────────────────── */

const thumbVariants = {
  initial: { opacity: 0, scale: 0.85 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 400, damping: 24 },
  },
  exit: {
    opacity: 0,
    scale: 0.7,
    transition: { duration: 0.2, ease: "easeIn" as const },
  },
};

/* ─── Component ─────────────────────────────────────── */

export function AIAttachmentZone({
  images,
  onChange,
  error,
  label = "PoC Attachments",
}: AIAttachmentZoneProps) {
  const prefersReduced = useReducedMotion();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const canAdd = images.length < MAX_IMAGES;

  /* ── Upload handler ── */
  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      const remaining = MAX_IMAGES - images.length;
      const batch = arr.slice(0, remaining);

      if (batch.length === 0) {
        setUploadError(`Maximum ${MAX_IMAGES} images reached.`);
        return;
      }

      for (const f of batch) {
        if (!ALLOWED_TYPES.includes(f.type)) {
          setUploadError("Invalid file type. Only JPG and PNG allowed.");
          return;
        }
        if (f.size > MAX_SIZE) {
          setUploadError(`"${f.name}" exceeds 5 MB limit.`);
          return;
        }
      }

      setUploadError(null);
      setUploading(true);

      try {
        const uploaded: PoCImage[] = [];

        for (const f of batch) {
          const fd = new FormData();
          fd.append("file", f);
          const res = await uploadTempAttachmentAction(fd);
          if (res.success && res.data) {
            uploaded.push(res.data);
          } else {
            setUploadError(res.error || `Failed to upload "${f.name}".`);
          }
        }

        if (uploaded.length > 0) onChange([...images, ...uploaded]);
      } catch {
        setUploadError("Upload failed. Please try again.");
      } finally {
        setUploading(false);
      }

      if (arr.length > remaining) {
        setUploadError(
          `Only ${remaining} more image(s) allowed (max ${MAX_IMAGES}).`,
        );
      }
    },
    [images, onChange],
  );

  /* ── Drag events ── */
  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);
      if (canAdd) await handleFiles(e.dataTransfer.files);
    },
    [canAdd, handleFiles],
  );

  const onInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) await handleFiles(e.target.files);
      e.target.value = "";
    },
    [handleFiles],
  );

  const removeImage = useCallback(
    (id: string) => onChange(images.filter((img) => img.id !== id)),
    [images, onChange],
  );

  return (
    <div className="space-y-3">
      <label className="block text-body-sm font-medium text-dark dark:text-white">
        {label}
        <span className="ml-2 text-xs font-normal text-dark-5 dark:text-dark-6">
          ({images.length}/{MAX_IMAGES})
        </span>
      </label>

      {/* ── Drop zone ── */}
      <div
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={() => canAdd && !uploading && inputRef.current?.click()}
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 transition-all duration-200",
          // Glassmorphism hints
          "bg-white/60 backdrop-blur-sm dark:bg-white/5",
          isDragging
            ? "border-purple-400 bg-purple-50/70 shadow-[0_0_20px_-5px_rgba(87,80,241,0.3)] dark:border-purple-500/60 dark:bg-purple-900/20"
            : "border-stroke/70 hover:border-purple-300/60 dark:border-dark-3 dark:hover:border-purple-500/40",
          !canAdd && "cursor-not-allowed opacity-50",
          uploading && "pointer-events-none",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png"
          multiple
          className="hidden"
          onChange={onInputChange}
          disabled={!canAdd || uploading}
        />

        {uploading ? (
          <div className="flex items-center gap-2 text-sm text-dark-5 dark:text-dark-6">
            <Loader2 size={20} className="animate-spin text-purple-500" />
            <span>Uploading...</span>
          </div>
        ) : (
          <>
            <div
              className={cn(
                "mb-2 flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                isDragging
                  ? "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400"
                  : "bg-gray-100 text-dark-5 dark:bg-dark-3 dark:text-dark-6",
              )}
            >
              {isDragging ? <ImagePlus size={20} /> : <Upload size={20} />}
            </div>
            <p className="text-sm font-medium text-dark dark:text-white">
              {isDragging
                ? "Drop PoC images here"
                : "Drag & drop PoC screenshots"}
            </p>
            <p className="mt-1 text-xs text-dark-5 dark:text-dark-6">
              or click to browse — JPG / PNG, up to 5 MB each
            </p>
          </>
        )}
      </div>

      {/* ── Errors ── */}
      {(error || uploadError) && (
        <p className="text-xs text-red-500">{error || uploadError}</p>
      )}

      {/* ── Thumbnails grid with animated mount / unmount ── */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          <AnimatePresence mode="popLayout">
            {images.map((img) => (
              <motion.div
                key={img.id}
                layout={!prefersReduced}
                variants={prefersReduced ? undefined : thumbVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="group relative overflow-hidden rounded-lg border border-stroke/70 bg-white shadow-sm dark:border-dark-3 dark:bg-dark-2"
              >
                <div className="aspect-square bg-gray-1 dark:bg-dark-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.fileUrl}
                    alt={img.fileName}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="px-2 py-1.5">
                  <p className="truncate text-[10px] font-medium text-dark dark:text-white">
                    {img.fileName}
                  </p>
                  <p className="text-[9px] text-dark-5 dark:text-dark-6">
                    {fmtSize(img.fileSize)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(img.id);
                  }}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500/90 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  title="Remove"
                >
                  <Trash2 size={12} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Hidden inputs for form submission ── */}
      {images.map((img, i) => (
        <input
          key={img.id}
          type="hidden"
          name={`pocImages[${i}]`}
          value={JSON.stringify(img)}
        />
      ))}
    </div>
  );
}
