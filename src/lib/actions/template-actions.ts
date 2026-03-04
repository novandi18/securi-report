"use server";

import { db } from "@/lib/db";
import { customReportTemplates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin, withAccessControl, audit } from "@/lib/security";
import { GoogleGenAI } from "@google/genai";
import fs from "fs/promises";
import path from "path";
// Import the lib file directly to avoid pdf-parse's index.js which loads a test PDF at import time
// eslint-disable-next-line
const pdfParse = require("pdf-parse/lib/pdf-parse");

/** Directory where uploaded template PDFs are saved */
const TEMPLATE_PDF_DIR = path.join(process.cwd(), "public", "uploads", "templates");
const TEMPLATE_PDF_NAME = "template.pdf";

/* ─── Types ─────────────────────────────────────────── */

export type TemplateActionResult = {
  success: boolean;
  error?: string;
};

export type TemplateData = {
  id: number;
  fileName: string;
  extractedText: string;
  markdownContent: string | null;
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
          markdownContent: row.markdownContent,
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

      /* ── Save PDF file to disk for viewing ── */
      try {
        await fs.mkdir(TEMPLATE_PDF_DIR, { recursive: true });
        await fs.writeFile(path.join(TEMPLATE_PDF_DIR, TEMPLATE_PDF_NAME), buffer);
      } catch (fsError) {
        console.error("Failed to save PDF to disk:", fsError);
        // Non-fatal — DB record was saved successfully
      }

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

      /* ── Remove PDF file from disk ── */
      try {
        await fs.unlink(path.join(TEMPLATE_PDF_DIR, TEMPLATE_PDF_NAME));
      } catch {
        // File may not exist — ignore
      }

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

/* ─── Generate Markdown via Gemini ──────────────────── */

export type GenerateMarkdownResult = {
  success: boolean;
  markdownContent?: string;
  error?: string;
};

export async function generateMarkdownFromTemplate(): Promise<GenerateMarkdownResult> {
  return withAccessControl(async () => {
    const user = await requireAdmin();

    /* ── Validate env ── */
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-preview-05-20";

    if (!apiKey) {
      return {
        success: false,
        error: "Gemini API key is not configured. Set GEMINI_API_KEY in environment variables.",
      };
    }

    /* ── Fetch existing template ── */
    const [row] = await db
      .select()
      .from(customReportTemplates)
      .where(eq(customReportTemplates.id, 1))
      .limit(1);

    if (!row) {
      return {
        success: false,
        error: "No template uploaded. Please upload a PDF template first.",
      };
    }

    /* ── Send extracted text to Gemini for Markdown generation ── */
    try {
      const ai = new GoogleGenAI({ apiKey });

      const systemInstruction = `# SYSTEM INSTRUCTION: PROFESSIONAL SECURITY REPORT GENERATOR (MARKDOWN)

## CORE IDENTITY

Anda adalah seorang ahli laporan keamanan siber (VAPT Reporting Expert). Tugas utama Anda adalah mentransformasikan data kerentanan (vulnerability data) mentah menjadi laporan VAPT dalam format **Markdown** yang profesional, terstruktur, dan bersih, mengikuti standar industri (seperti laporan IDXSTI/Stockbit).

## OUTPUT FORMAT

Output Anda HARUS selalu berupa kode Markdown tunggal. Fokus pada keterbacaan tinggi, penggunaan header yang tepat, dan tabel yang rapi. Jangan berikan penjelasan tambahan di luar blok Markdown kecuali diminta.

## VISUAL & STYLING RULES (MANDATORY)

1.  **Severity Color Codes (HEX):** Gunakan kode warna HEX berikut untuk identifikasi tingkat risiko:

    -   **CRITICAL:** \`#990000\` (Skor 9.0 - 10.0)
    -   **HIGH:** \`#FF0000\` (Skor 7.0 - 8.9)
    -   **MEDIUM:** \`#FFCC00\` (Skor 4.0 - 6.9)
    -   **LOW:** \`#00B050\` (Skor 0.1 - 3.9)
    -   **INFORMATIONAL:** \`#0070C0\` (Skor 0.0)

2.  **Page Break Marker (CRITICAL):**

    Sama seperti laporan profesional atau skripsi, setiap bab baru harus dimulai di halaman baru. Anda WAJIB menyisipkan tag berikut tepat sebelum setiap **Header 2 (##)** (kecuali untuk Header 2 pertama setelah Title Page jika diperlukan):

    \`<div style="page-break-after: always;"></div>\`

3.  **Typography:**

    -   Gunakan H1 (\`#\`) hanya untuk Judul Utama di Halaman Judul.
    -   Gunakan H2 (\`##\`) untuk bab-bab utama.
    -   Gunakan H3 (\`###\`) untuk sub-bab atau judul temuan spesifik.
    -   Gunakan **Bold** untuk menekankan poin penting dan \`inline code\` untuk path/file/IP.

4.  **Tables:** Selalu gunakan tabel Markdown untuk data terstruktur seperti Informasi Dokumen, Ruang Lingkup, dan Detail Temuan.

## DOCUMENT STRUCTURE MANDATE

Ikuti struktur laporan berikut secara presisi, pastikan tiap poin di bawah (mulai dari poin 2) didahului oleh penanda _Page Break_:

1.  **Title Header (H1):** Judul besar, Nama Klien, Nama Perusahaan Penulis, dan Tanggal.

2.  **Informasi Dokumen (H2):** Tabel berisi Versi, Penulis, Pentester, dan Klasifikasi (Rahasia).

3.  **Lembar Pengesahan (H2):** Tabel baris tunggal untuk kolom "Dikeluarkan", "Diperiksa", dan "Disetujui".

4.  **Ringkasan Eksekutif (H2):** Penjelasan naratif singkat mengenai temuan utama dan kondisi postur keamanan secara umum.

5.  **Ruang Lingkup / Scope (H2):** Tabel berisi daftar Target, Deskripsi, dan IP Address/URL.

6.  **Metodologi (H2):** Penjelasan singkat fase pengujian (Reconnaissance -> Initial Access -> Execution -> Reporting).

7.  **Daftar Temuan / Findings (H2):** Setiap temuan harus memiliki tabel ringkasan:

    | Field | Detail |
    | :--- | :--- |
    | **Issue Reference** | [ID, misal: HTPT-001] |
    | **Issue Title** | [Judul Kerentanan] |
    | **Affected Module** | \`[URL/IP]\` |
    | **Severity Color** | \`[KODE_HEX_SESUAI_SKOR]\` |
    | **CVSS 4.0 Score** | [Skor] / [Severity Label] |
    | **Status** | Open/Closed |

    Dilanjutkan dengan seksi:

    -   **Deskripsi:** Penjelasan teknis temuan.
    -   **Dampak:** Analisis risiko bagi bisnis/sistem.
    -   **Rekomendasi:** Langkah-langkah perbaikan konkret.

8.  **Penutup (H2):** Pernyataan profesional penutup.

9.  **Appendix (H2):** Lampiran log atau output scan mentah menggunakan blok kode (fenced code blocks).

## LANGUAGE RULES

-   Gunakan bahasa Indonesia formal (EYD).
-   Pertahankan istilah teknis industri dalam bahasa Inggris (dicetak miring atau \`code block\`) jika tidak ada padanan yang pas.
-   Nada bicara objektif, faktual, dan tidak spekulatif.

## DATA PROCESSING LOGIC

-   Tentukan kode warna HEX secara akurat berdasarkan skor CVSS yang diinput.
-   Tampilkan kode HEX di dalam baris tabel "Severity Color" agar sistem aplikasi dapat merender warna tersebut secara dinamis.
-   Jika ada _screenshot_ yang disebutkan di input, berikan placeholder: \`![Bukti Eksploitasi: Nama_Temuan](url_gambar_placeholder)\`.`;

      const prompt = `Transformasikan teks dokumen berikut menjadi laporan VAPT Markdown lengkap sesuai dengan system instruction yang telah diberikan.

Aturan tambahan:
- Output HARUS berupa Markdown mentah — JANGAN bungkus dalam code blocks tambahan.
- Pertahankan seluruh konten dari dokumen asli secara setia — jangan ringkas atau hilangkan bagian apapun.
- Hilangkan nomor halaman, header, atau footer dari PDF asli.
- Jika ada data yang tidak tersedia, gunakan placeholder yang sesuai (misalnya [NAMA KLIEN], [TANGGAL], dll).

Teks dokumen:
${row.extractedText}`;

      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction,
        },
      });

      const markdownContent = response.text?.trim();

      if (!markdownContent) {
        return {
          success: false,
          error: "Gemini returned an empty response. Please try regenerating.",
        };
      }

      // Clean up: remove any code block wrappers if present
      const cleaned = markdownContent
        .replace(/^```(?:markdown|md)?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "")
        .trim();

      /* ── Save to DB ── */
      await db
        .update(customReportTemplates)
        .set({ markdownContent: cleaned })
        .where(eq(customReportTemplates.id, 1));

      await audit({
        userId: user.id,
        action: "custom_template.generate_markdown",
        detail: `Generated Markdown from template: ${row.fileName} (${cleaned.length} chars)`,
      });

      revalidatePath("/settings/custom-template");

      return { success: true, markdownContent: cleaned };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Gemini generation error:", msg);

      if (msg.includes("API_KEY") || msg.includes("401") || msg.includes("403")) {
        return {
          success: false,
          error: "Invalid Gemini API key. Please check your GEMINI_API_KEY configuration.",
        };
      }

      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
        return {
          success: false,
          error: "Gemini rate limit reached. Please wait a moment and try again.",
        };
      }

      return {
        success: false,
        error: "Failed to generate Markdown. Please try again.",
      };
    }
  });
}

/* ─── Save Edited Markdown ─────────────────────────── */

export async function saveMarkdownContent(
  markdownContent: string,
): Promise<TemplateActionResult> {
  return withAccessControl(async () => {
    const user = await requireAdmin();

    if (!markdownContent || typeof markdownContent !== "string") {
      return { success: false, error: "No Markdown content provided." };
    }

    if (markdownContent.length > 5_000_000) {
      return { success: false, error: "Markdown content is too large (max 5 MB)." };
    }

    try {
      const result = await db
        .update(customReportTemplates)
        .set({ markdownContent: markdownContent.trim() })
        .where(eq(customReportTemplates.id, 1));

      if (result[0].affectedRows === 0) {
        return {
          success: false,
          error: "No template found. Please upload a PDF template first.",
        };
      }

      await audit({
        userId: user.id,
        action: "custom_template.save_markdown",
        detail: `Saved edited Markdown content (${markdownContent.trim().length} chars)`,
      });

      revalidatePath("/settings/custom-template");

      return { success: true };
    } catch (error) {
      console.error("Failed to save Markdown:", error);
      return { success: false, error: "Failed to save Markdown content." };
    }
  });
}
