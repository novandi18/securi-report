"use server";

import { db } from "@/lib/db";
import { customReportTemplates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin, withAccessControl, audit } from "@/lib/security";
// Import the lib file directly to avoid pdf-parse's index.js which loads a test PDF at import time
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse");

/* ─── Types ─────────────────────────────────────────── */

export type TemplateActionResult = {
  success: boolean;
  error?: string;
};

export type TemplateData = {
  id: number;
  fileName: string;
  extractedText: string;
  fileSizeKb: number | null;
  updatedAt: Date | null;
};

export type GetTemplateResult = {
  success: boolean;
  data: TemplateData | null;
  error?: string;
};

/* ─── Constants ─────────────────────────────────────── */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = "application/pdf";

/* ─── Helpers ───────────────────────────────────────── */

/**
 * Sanitize extracted text: collapse excessive whitespace/newlines,
 * strip null bytes and non-printable control characters.
 */
function sanitizeExtractedText(raw: string): string {
  return (
    raw
      // Remove null bytes
      .replace(/\0/g, "")
      // Remove non-printable control characters (keep \n, \r, \t)
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      // Collapse 3+ consecutive newlines into 2
      .replace(/\n{3,}/g, "\n\n")
      // Collapse 2+ consecutive spaces/tabs into single space
      .replace(/[^\S\n]{2,}/g, " ")
      // Trim each line
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .trim()
  );
}

/* ─── Get Template ──────────────────────────────────── */

export async function getCustomTemplate(): Promise<GetTemplateResult> {
  return withAccessControl(async () => {
    await requireAdmin();

    try {
      const [row] = await db
        .select()
        .from(customReportTemplates)
        .where(eq(customReportTemplates.id, 1))
        .limit(1);

      if (!row) {
        return { success: true as const, data: null };
      }

      return {
        success: true as const,
        data: {
          id: row.id,
          fileName: row.fileName,
          extractedText: row.extractedText,
          fileSizeKb: row.fileSizeKb,
          updatedAt: row.updatedAt,
        },
      };
    } catch (error) {
      console.error("Failed to fetch custom template:", error);
      return {
        success: false as const,
        data: null,
        error: "Failed to fetch template.",
      };
    }
  });
}

/* ─── Upload & Extract ──────────────────────────────── */

export async function uploadCustomTemplate(
  formData: FormData,
): Promise<TemplateActionResult> {
  return withAccessControl(async () => {
    const user = await requireAdmin();

    /* ── Get file from FormData ── */
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return { success: false, error: "No file provided." };
    }

    /* ── MIME validation ── */
    if (file.type !== ALLOWED_MIME) {
      return {
        success: false,
        error: `Invalid file type "${file.type}". Only PDF files are accepted.`,
      };
    }

    /* ── Size validation ── */
    if (file.size > MAX_FILE_SIZE) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      return {
        success: false,
        error: `File too large (${sizeMb} MB). Maximum allowed size is 10 MB.`,
      };
    }

    /* ── Read file buffer ── */
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    /* ── Extract text from PDF ── */
    let extractedText: string;
    try {
      const pdfData = await pdfParse(buffer);

      if (!pdfData.text || pdfData.text.trim().length === 0) {
        return {
          success: false,
          error:
            "No text could be extracted from this PDF. The file may be image-based or scanned. Please use a text-based PDF.",
        };
      }

      extractedText = sanitizeExtractedText(pdfData.text);
    } catch (pdfError: unknown) {
      const msg =
        pdfError instanceof Error ? pdfError.message : String(pdfError);

      // Detect encrypted/locked PDFs
      if (
        msg.toLowerCase().includes("encrypt") ||
        msg.toLowerCase().includes("password")
      ) {
        return {
          success: false,
          error:
            "This PDF is encrypted or password-protected. Please upload an unlocked PDF.",
        };
      }

      console.error("PDF parse error:", msg);
      return {
        success: false,
        error: "Failed to parse the PDF file. Please ensure it is a valid, non-corrupted PDF.",
      };
    }

    /* ── Upsert into DB (id = 1, single-row policy) ── */
    const fileSizeKb = Math.round(file.size / 1024);

    try {
      // Try insert first; on duplicate key (id=1), update
      await db
        .insert(customReportTemplates)
        .values({
          id: 1,
          fileName: file.name,
          extractedText,
          fileSizeKb,
        })
        .onDuplicateKeyUpdate({
          set: {
            fileName: file.name,
            extractedText,
            fileSizeKb,
          },
        });

      await audit({
        userId: user.id,
        action: "custom_template.upload",
        detail: `Uploaded template: ${file.name} (${fileSizeKb} KB, ${extractedText.length} chars extracted)`,
      });

      revalidatePath("/settings/custom-template");

      return { success: true };
    } catch (dbError) {
      console.error("Failed to save template:", dbError);
      return {
        success: false,
        error: "Failed to save extracted text to database.",
      };
    }
  });
}

/* ─── Delete Template ───────────────────────────────── */

export async function deleteCustomTemplate(): Promise<TemplateActionResult> {
  return withAccessControl(async () => {
    const user = await requireAdmin();

    try {
      await db
        .delete(customReportTemplates)
        .where(eq(customReportTemplates.id, 1));

      await audit({
        userId: user.id,
        action: "custom_template.delete",
      });

      revalidatePath("/settings/custom-template");

      return { success: true };
    } catch (error) {
      console.error("Failed to delete template:", error);
      return { success: false, error: "Failed to delete template." };
    }
  });
}
