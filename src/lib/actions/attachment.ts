"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { reportAttachments, reports } from "@/lib/db/schema";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "reports");
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB per file
const MAX_ATTACHMENTS = 10;

export type AttachmentResult = {
  success: boolean;
  error?: string;
  data?: {
    id: string;
    fileUrl: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  };
};

/**
 * Upload an attachment image for a report.
 *
 * Security considerations:
 * - Validates authentication & authorization (viewer blocked)
 * - Validates MIME type server-side (jpg, jpeg, png only)
 * - Validates file size (max 5MB per file)
 * - Enforces max 10 attachments per report
 * - Sanitizes filename to prevent path traversal
 */
export async function uploadAttachmentAction(
  reportId: string,
  formData: FormData,
): Promise<AttachmentResult> {
  const session = await auth();
  if (!session || session.user.role === "viewer") {
    return { success: false, error: "Unauthorized" };
  }

  const file = formData.get("file") as File | null;
  if (!file || !(file instanceof File)) {
    return { success: false, error: "No file provided" };
  }

  // Validate MIME type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      success: false,
      error: "Invalid file type. Only JPG, JPEG, and PNG are allowed.",
    };
  }

  // Validate size
  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: "File too large. Maximum size is 5 MB." };
  }

  // Verify report exists
  const [report] = await db
    .select({ id: reports.id })
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);

  if (!report) {
    return { success: false, error: "Report not found." };
  }

  // Check attachment count
  const existingAttachments = await db
    .select({ id: reportAttachments.id })
    .from(reportAttachments)
    .where(eq(reportAttachments.reportId, reportId));

  if (existingAttachments.length >= MAX_ATTACHMENTS) {
    return {
      success: false,
      error: `Maximum ${MAX_ATTACHMENTS} attachments per report.`,
    };
  }

  try {
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Sanitized filename
    const ext = path.extname(file.name).toLowerCase() || ".png";
    const safeExt = [".jpg", ".jpeg", ".png"].includes(ext) ? ext : ".png";
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T]/g, "")
      .slice(0, 14);
    const rand = Math.random().toString(36).slice(2, 8);
    const filename = `att_${timestamp}_${rand}${safeExt}`;

    const filePath = path.join(UPLOAD_DIR, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/reports/${filename}`;

    // Save to DB
    const attachmentId = randomUUID();
    await db
      .insert(reportAttachments)
      .values({
        id: attachmentId,
        reportId,
        fileUrl: publicUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });

    return {
      success: true,
      data: {
        id: attachmentId,
        fileUrl: publicUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      },
    };
  } catch (err) {
    console.error("Attachment upload failed:", err);
    return { success: false, error: "Upload failed. Please try again." };
  }
}

/**
 * Upload attachments for a new report (before reportId is known).
 * Stores images temporarily and returns URLs.
 */
export async function uploadTempAttachmentAction(
  formData: FormData,
): Promise<AttachmentResult> {
  const session = await auth();
  if (!session || session.user.role === "viewer") {
    return { success: false, error: "Unauthorized" };
  }

  const file = formData.get("file") as File | null;
  if (!file || !(file instanceof File)) {
    return { success: false, error: "No file provided" };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      success: false,
      error: "Invalid file type. Only JPG, JPEG, and PNG are allowed.",
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: "File too large. Maximum size is 5 MB." };
  }

  try {
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    const ext = path.extname(file.name).toLowerCase() || ".png";
    const safeExt = [".jpg", ".jpeg", ".png"].includes(ext) ? ext : ".png";
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T]/g, "")
      .slice(0, 14);
    const rand = Math.random().toString(36).slice(2, 8);
    const filename = `att_${timestamp}_${rand}${safeExt}`;

    const filePath = path.join(UPLOAD_DIR, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    return {
      success: true,
      data: {
        id: `temp_${rand}`,
        fileUrl: `/uploads/reports/${filename}`,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      },
    };
  } catch (err) {
    console.error("Temp attachment upload failed:", err);
    return { success: false, error: "Upload failed. Please try again." };
  }
}

/**
 * Delete a specific attachment.
 */
export async function deleteAttachmentAction(
  attachmentId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session || session.user.role === "viewer") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const [attachment] = await db
      .select()
      .from(reportAttachments)
      .where(eq(reportAttachments.id, attachmentId))
      .limit(1);

    if (!attachment) {
      return { success: false, error: "Attachment not found." };
    }

    // Delete file from disk
    const filePath = path.join(process.cwd(), "public", attachment.fileUrl);
    try {
      await unlink(filePath);
    } catch {
      // File may not exist, non-blocking
    }

    await db
      .delete(reportAttachments)
      .where(eq(reportAttachments.id, attachmentId));

    return { success: true };
  } catch (err) {
    console.error("Delete attachment failed:", err);
    return { success: false, error: "Failed to delete attachment." };
  }
}

/**
 * Get all attachments for a report.
 */
export async function getAttachmentsAction(reportId: string) {
  const session = await auth();
  if (!session) {
    return { success: false as const, error: "Unauthorized", data: [] };
  }

  try {
    const data = await db
      .select()
      .from(reportAttachments)
      .where(eq(reportAttachments.reportId, reportId));

    return { success: true as const, data };
  } catch (err) {
    console.error("Failed to fetch attachments:", err);
    return { success: false as const, error: "Failed to fetch attachments", data: [] };
  }
}
