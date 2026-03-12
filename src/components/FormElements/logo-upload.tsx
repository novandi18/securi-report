"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { uploadToImgbbAction } from "@/lib/actions/imgbb";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_DIMENSION = 1024; // max width/height after resize

/**
 * Compress an image file using Canvas.
 * Resizes to fit within MAX_DIMENSION while keeping aspect ratio,
 * then encodes as WebP at high quality (0.85).
 */
function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    // GIF can't be properly compressed via Canvas — skip
    if (file.type === "image/gif") {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Only resize if larger than MAX_DIMENSION
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file); // fallback
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            // If compressed is larger, use original
            resolve(file);
            return;
          }
          const compressed = new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), {
            type: "image/webp",
          });
          resolve(compressed);
        },
        "image/webp",
        0.85,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for compression."));
    };

    img.src = url;
  });
}

interface LogoUploadProps {
  value: string;
  onChange: (url: string) => void;
  error?: string;
}

export function LogoUpload({ value, onChange, error }: LogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const handleFile = useCallback(
    async (file: File) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setUploadError("Invalid file type. Allowed: JPG, PNG, GIF, WebP.");
        return;
      }
      if (file.size > MAX_SIZE) {
        setUploadError("File is too large. Maximum size is 10 MB.");
        return;
      }

      setUploadError(null);
      setUploading(true);

      try {
        // Compress image before uploading
        const compressed = await compressImage(file);

        const fd = new FormData();
        fd.append("image", compressed);
        const result = await uploadToImgbbAction(fd);

        if (result.success && result.url) {
          onChange(result.url);
        } else {
          setUploadError(result.error || "Upload failed.");
        }
      } catch {
        setUploadError("Upload failed. Please try again.");
      } finally {
        setUploading(false);
      }
    },
    [onChange],
  );

  const handleInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) await handleFile(file);
      e.target.value = "";
    },
    [handleFile],
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

      const file = e.dataTransfer.files[0];
      if (file) await handleFile(file);
    },
    [handleFile],
  );

  const handleRemove = useCallback(() => {
    onChange("");
    setUploadError(null);
  }, [onChange]);

  return (
    <div className="space-y-2">
      <label className="block text-body-sm font-medium text-dark dark:text-white">
        Logo
      </label>

      {value ? (
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-stroke bg-gray-1 dark:border-dark-3 dark:bg-dark-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Customer logo"
              className="h-full w-full object-contain"
            />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition-colors hover:bg-red-600"
              title="Remove logo"
            >
              <Trash2 size={10} />
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-dark-5 dark:text-dark-6">
              {value}
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="mt-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
            >
              Change logo
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={cn(
            "relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 transition-colors",
            isDragging
              ? "border-primary bg-primary/5 dark:bg-primary/10"
              : "border-stroke hover:border-primary/50 dark:border-dark-3 dark:hover:border-primary/50",
            uploading && "pointer-events-none",
          )}
        >
          {uploading ? (
            <div className="flex items-center gap-2 text-sm text-dark-5 dark:text-dark-6">
              <Loader2 size={20} className="animate-spin" />
              Uploading...
            </div>
          ) : (
            <>
              <ImagePlus
                size={28}
                className={cn(
                  "mb-2",
                  isDragging ? "text-primary" : "text-dark-5 dark:text-dark-6",
                )}
              />
              <p className="text-sm font-medium text-dark dark:text-white">
                {isDragging ? "Drop logo here" : "Upload customer logo"}
              </p>
              <p className="mt-1 text-xs text-dark-5 dark:text-dark-6">
                Drag & drop or click — JPG, PNG, GIF, WebP up to 10 MB
              </p>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.gif,.webp"
        className="hidden"
        onChange={handleInputChange}
        disabled={uploading}
      />

      {/* Hidden input to include logoUrl in form submission */}
      <input type="hidden" name="logoUrl" value={value} />

      {(error || uploadError) && (
        <p className="text-xs text-red-500">{error || uploadError}</p>
      )}
    </div>
  );
}
