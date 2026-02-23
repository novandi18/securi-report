"use server";

import { auth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { audit } from "@/lib/security";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "reports");
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Server action: upload an image for use in Markdown reports.
 *
 * Validates:
 *  - Authentication
 *  - File type (jpg, jpeg, png only)
 *  - File size (≤ 5 MB)
 *
 * Saves to /public/uploads/reports/ with a timestamp-based name.
 * Returns the public URL path on success.
 */
export async function uploadReportImageAction(formData: FormData) {
  const session = await auth();
  if (!session) {
    return { success: false as const, error: "Unauthorized" };
  }

  const file = formData.get("file") as File | null;
  if (!file || !(file instanceof File)) {
    return { success: false as const, error: "No file provided" };
  }

  // ── Validate MIME type ──────────────────────────────
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      success: false as const,
      error: "Invalid file type. Only .jpg, .jpeg, and .png are allowed.",
    };
  }

  // ── Validate size ───────────────────────────────────
  if (file.size > MAX_SIZE) {
    return {
      success: false as const,
      error: "File too large. Maximum size is 5 MB.",
    };
  }

  try {
    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Build a collision-free filename: img_<timestamp>_<random>.<ext>
    const ext = path.extname(file.name).toLowerCase() || ".png";
    const safeExt = [".jpg", ".jpeg", ".png"].includes(ext) ? ext : ".png";
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T]/g, "")
      .slice(0, 14); // YYYYMMDDHHmmss
    const rand = Math.random().toString(36).slice(2, 8);
    const filename = `img_${timestamp}_${rand}${safeExt}`;

    const filePath = path.join(UPLOAD_DIR, filename);
    const buffer = Buffer.from(await file.arrayBuffer());

    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/reports/${filename}`;
    await audit({ userId: session.user.id, action: "upload.image" });
    return { success: true as const, url: publicUrl };
  } catch (err) {
    console.error("Image upload failed:", err);
    return { success: false as const, error: "Upload failed. Please try again." };
  }
}
