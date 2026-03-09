"use server";

import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";
import fs from "fs/promises";
import { GoogleGenAI, createUserContent } from "@google/genai";
import { marked } from "marked";
import puppeteer from "puppeteer";
import { requireEditor, withAccessControl } from "@/lib/security";
import { audit } from "@/lib/security/audit-logger";
import { db } from "@/lib/db";
import { reports, customers, deliverables, reportAttachments } from "@/lib/db/schema";
import type { Issa1Target, Issa2Target, Issa3Target } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { syncDocument, INDEX } from "@/lib/meilisearch";

/* ─── Types ─────────────────────────────────────────── */

export interface PoCImageInput {
  fileUrl: string;
  fileName: string;
  mimeType: string;
}

export interface GenerateReportInput {
  title: string;
  customerName: string;
  rawNotes: string;
  aiContext: string;
  pocImages?: PoCImageInput[];
  scopeIssa1?: Issa1Target[] | null;
  scopeIssa2?: Issa2Target[] | null;
  scopeIssa3?: Issa3Target[] | null;
}

export interface GenerateReportResult {
  success: boolean;
  data?: {
    markdownReport: string;
  };
  error?: string;
}

/* ─── System Instruction (shared with custom template) ── */

const SYSTEM_INSTRUCTION = `# SYSTEM INSTRUCTION: PROFESSIONAL SECURITY REPORT GENERATOR (MARKDOWN)

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
-   Jika ada _screenshot_ yang disebutkan di input, berikan placeholder: \`![Bukti Eksploitasi: Nama_Temuan](url_gambar_placeholder)\`.

## ADDITIONAL CONTEXT FOR AI REPORT GENERATION

Ketika user memberikan gambar lampiran (PoC screenshots), Anda WAJIB:
-   Menganalisis setiap gambar dan mengidentifikasi temuan keamanan yang terlihat.
-   Menyertakan referensi gambar dalam laporan menggunakan sintaks: \`![Bukti: Nama_Temuan](nama_file_gambar)\`.
-   Mendeskripsikan temuan berdasarkan informasi visual dari gambar secara akurat dan profesional.
-   Jika gambar menunjukkan tool output (Burp Suite, Nmap, dll), ekstrak informasi teknis yang relevan.`;

/* ─── Helpers ───────────────────────────────────────── */

async function readImageAsBase64(fileUrl: string): Promise<{ data: string; mimeType: string } | null> {
  // fileUrl is like /uploads/reports/att_20260218120000_abc123.png
  const filePath = path.join(process.cwd(), "public", fileUrl);

  if (!existsSync(filePath)) {
    console.warn(`PoC image not found: ${filePath}`);
    return null;
  }

  const buffer = await readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType =
    ext === ".png" ? "image/png" :
    ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
    "image/png";

  return {
    data: buffer.toString("base64"),
    mimeType,
  };
}

/* ─── Server Action ─────────────────────────────────── */

export async function generateReportWithAI(
  formData: GenerateReportInput,
): Promise<GenerateReportResult> {
  return withAccessControl(async () => {
    const user = await requireEditor();

    /* ── Validate input ── */
    if (!formData.rawNotes.trim()) {
      return { success: false, error: "Raw findings notes cannot be empty." };
    }
    if (!formData.title.trim()) {
      return { success: false, error: "Report title is required." };
    }

    /* ── Validate env ── */
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-preview-05-20";

    if (!apiKey) {
      return {
        success: false,
        error: "Gemini API key is not configured. Set GEMINI_API_KEY in environment variables.",
      };
    }

    /* ── Build prompt ── */
    const customerLine = formData.customerName
      ? `Nama Klien: ${formData.customerName}`
      : "Nama Klien: [NAMA KLIEN]";

    const contextLine = formData.aiContext.trim()
      ? `\nInstruksi tambahan dari user:\n${formData.aiContext.trim()}\n`
      : "";

    const imageCount = formData.pocImages?.length ?? 0;
    const imageNote = imageCount > 0
      ? `\n${imageCount} gambar PoC (Proof of Concept) dilampirkan. Analisis setiap gambar dan integrasikan temuan visual ke dalam laporan. Referensi setiap gambar dengan nama filenya.`
      : "";

    // Build scope context from ISSA worksheet data
    const scopeLines: string[] = [];
    if (formData.scopeIssa1 && formData.scopeIssa1.length > 0) {
      scopeLines.push("\nScope ISSA-1 (Exploitation Targets):");
      formData.scopeIssa1.forEach((t) => scopeLines.push(`  ${t.no}. ${t.sistemEndpoint} \u2014 IP: ${t.ipAddress} \u2014 URL: ${t.linkUrl}`));
    }
    if (formData.scopeIssa2 && formData.scopeIssa2.length > 0) {
      scopeLines.push("\nScope ISSA-2 (VA Public Targets):");
      formData.scopeIssa2.forEach((t) => scopeLines.push(`  ${t.no}. IP Public: ${t.ipPublic} \u2014 URL: ${t.linkUrl}`));
    }
    if (formData.scopeIssa3 && formData.scopeIssa3.length > 0) {
      scopeLines.push("\nScope ISSA-3 (VA Workstation Targets):");
      formData.scopeIssa3.forEach((t) => scopeLines.push(`  ${t.no}. IP Internal: ${t.ipInternal}`));
    }
    const scopeNote = scopeLines.length > 0 ? `\n${scopeLines.join("\n")}` : "";

    const promptText = `Buatkan laporan VAPT Markdown lengkap berdasarkan data berikut:

Judul Laporan: ${formData.title}
${customerLine}
Tanggal: ${new Date().toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })}
${contextLine}
Data temuan mentah (raw findings):
${formData.rawNotes}
${scopeNote}${imageNote}

Aturan:
- Output HARUS berupa Markdown mentah — JANGAN bungkus dalam code blocks tambahan.
- Strukturkan data mentah menjadi temuan-temuan yang jelas dengan severity, CVSS score, deskripsi, dampak, dan rekomendasi.
- Jika data temuan menyebutkan severity/skor, gunakan itu. Jika tidak, tentukan sendiri berdasarkan analisis.
- Untuk field yang datanya tidak tersedia, gunakan placeholder yang sesuai.`;

    /* ── Build content parts (text + images) ── */
    // eslint-disable-next-line
    const parts: any[] = [{ text: promptText }];

    // Read and attach PoC images as inline base64 data
    if (formData.pocImages && formData.pocImages.length > 0) {
      for (const img of formData.pocImages) {
        const imageData = await readImageAsBase64(img.fileUrl);
        if (imageData) {
          parts.push({
            inlineData: {
              mimeType: imageData.mimeType,
              data: imageData.data,
            },
          });
          // Add a text label so AI knows which file this image corresponds to
          parts.push({ text: `[Gambar di atas adalah file: ${img.fileName}]` });
        }
      }
    }

    /* ── Call Gemini ── */
    try {
      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model,
        contents: createUserContent(parts),
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      });

      const rawMarkdown = response.text?.trim();

      if (!rawMarkdown) {
        return {
          success: false,
          error: "Gemini returned an empty response. Please try again.",
        };
      }

      // Clean up: remove any code block wrappers if present
      const cleaned = rawMarkdown
        .replace(/^```(?:markdown|md)?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "")
        .trim();

      /* ── Audit log ── */
      await audit({
        action: "report.ai_generate",
        userId: user.id,
        detail: `AI report generated: "${formData.title}" (model: ${model}, images: ${imageCount})`,
      });

      return {
        success: true,
        data: {
          markdownReport: cleaned,
        },
      };
    } catch (err) {
      console.error("Gemini AI generation error:", err);

      if (err instanceof Error && err.message?.includes("API_KEY")) {
        return {
          success: false,
          error: "Invalid Gemini API key. Please check your GEMINI_API_KEY configuration.",
        };
      }

      return {
        success: false,
        error: "AI generation failed. Please try again.",
      };
    }
  });
}

/* ═══════════════════════════════════════════════════════
   Save AI Report — Persists report + auto-generates PDF
   ═══════════════════════════════════════════════════════ */

export interface SaveAIReportInput {
  title: string;
  reportIdCustom: string;
  customerId: string;
  status: string;
  markdownReport: string;
  pocImages?: PoCImageInput[];
  scopeIssa1?: Issa1Target[] | null;
  scopeIssa2?: Issa2Target[] | null;
  scopeIssa3?: Issa3Target[] | null;
}

export interface SaveAIReportResult {
  success: boolean;
  reportId?: string;
  error?: string;
}

function generateReportId(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `PEN-DOC-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${rand}`;
}

export async function saveAIReport(
  input: SaveAIReportInput,
): Promise<SaveAIReportResult> {
  return withAccessControl(async () => {
    const user = await requireEditor();

    /* ── Validate ── */
    if (!input.title.trim()) {
      return { success: false, error: "Report title is required." };
    }
    if (!input.customerId.trim()) {
      return { success: false, error: "Customer is required." };
    }
    if (!input.markdownReport.trim()) {
      return { success: false, error: "Markdown report content is required." };
    }

    // Only admin can set Closed
    if (input.status === "Closed" && user.role !== "administrator") {
      return { success: false, error: "Only administrators can set status to Closed." };
    }

    /* ── Verify customer exists ── */
    const [customer] = await db
      .select({ id: customers.id, name: customers.name })
      .from(customers)
      .where(eq(customers.id, input.customerId))
      .limit(1);

    if (!customer) {
      return { success: false, error: "Selected customer does not exist." };
    }

    const reportIdCustom = input.reportIdCustom.trim() || generateReportId();

    try {
      /* ── 1. Insert report ── */
      await db.insert(reports).values({
        customerId: input.customerId,
        reportIdCustom,
        title: input.title,
        description: input.markdownReport,
        status: input.status as "Open" | "Closed" | "Draft",
        createdBy: user.id,
        scopeIssa1: input.scopeIssa1 ?? undefined,
        scopeIssa2: input.scopeIssa2 ?? undefined,
        scopeIssa3: input.scopeIssa3 ?? undefined,
      });

      // Get the created report
      const [created] = await db
        .select({
          id: reports.id,
          title: reports.title,
          reportIdCustom: reports.reportIdCustom,
          customerName: customers.name,
          status: reports.status,
          description: reports.description,
          auditDate: reports.auditDate,
        })
        .from(reports)
        .innerJoin(customers, eq(reports.customerId, customers.id))
        .orderBy(desc(reports.createdAt))
        .limit(1);

      if (!created) {
        return { success: false, error: "Failed to create report." };
      }

      /* ── 2. Link PoC attachments ── */
      if (input.pocImages && input.pocImages.length > 0) {
        const attachmentValues = [];
        for (const img of input.pocImages) {
          const filePath = path.join(process.cwd(), "public", img.fileUrl);
          let fileSize = 0;
          try {
            const stat = await fs.stat(filePath);
            fileSize = stat.size;
          } catch {
            // fallback
          }
          attachmentValues.push({
            reportId: created.id,
            fileUrl: img.fileUrl,
            fileName: img.fileName,
            fileSize,
            mimeType: img.mimeType,
          });
        }
        await db.insert(reportAttachments).values(attachmentValues);
      }

      /* ── 3. Generate PDF from Markdown ── */
      const delivDir = path.join(process.cwd(), "public", "deliverables");
      await fs.mkdir(delivDir, { recursive: true });

      const bodyHtml = await marked.parse(input.markdownReport);

      // Debug: verify markdown→HTML conversion
      if (bodyHtml === input.markdownReport || !bodyHtml.includes("<")) {
        console.warn("WARNING: marked.parse() did not convert markdown to HTML properly.");
        console.warn("Input length:", input.markdownReport.length, "Output length:", bodyHtml.length);
        console.warn("First 200 chars of output:", bodyHtml.substring(0, 200));
      }

      const html = buildAIReportPdfHtml(bodyHtml, input.title);

      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "networkidle0" });

        const pdfFileName = `${reportIdCustom.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
        const pdfPath = path.join(delivDir, pdfFileName);

        await page.pdf({
          path: pdfPath,
          format: "A4",
          margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
          printBackground: true,
          displayHeaderFooter: true,
          headerTemplate: `
            <div style="width:100%;font-size:8px;color:#999;padding:0 15mm;display:flex;justify-content:space-between">
              <span>${escapeHtml(input.title)}</span>
              <span>${escapeHtml(reportIdCustom)}</span>
            </div>`,
          footerTemplate: `
            <div style="width:100%;font-size:8px;color:#999;padding:0 15mm;display:flex;justify-content:space-between">
              <span>CONFIDENTIAL</span>
              <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
            </div>`,
        });

        // SHA-256 hash for integrity
        const pdfBuffer = await fs.readFile(pdfPath);
        const sha256Hash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

        // Insert deliverable record
        const fileUrl = `/deliverables/${pdfFileName}`;
        await db.insert(deliverables).values({
          reportId: created.id,
          format: "PDF",
          fileUrl,
          sha256Hash,
          generatedBy: user.id,
        });
      } finally {
        await browser.close();
      }

      /* ── 4. Sync to Meilisearch ── */
      syncDocument(INDEX.REPORTS, created);

      /* ── 5. Audit log ── */
      await audit({
        action: "report.create",
        userId: user.id,
        resourceId: created.id,
        detail: `AI-generated report saved: "${input.title}"`,
      });

      /* ── 6. Notify admins if editor submits as Open ── */
      if (input.status === "Open" && user.role === "editor") {
        try {
          const { createNotificationForRole } = await import("@/lib/actions/notification");
          await createNotificationForRole("administrator", {
            actorId: user.id,
            category: "collaboration",
            type: "contribution_submitted",
            title: "New AI Report Submitted",
            message: `${user.username} submitted AI-generated report "${input.title}" for review.`,
            actionUrl: `/reports/${created.id}`,
          });
        } catch (err) {
          console.error("Failed to send notification (non-blocking):", err);
        }
      }

      revalidatePath("/reports");
      revalidatePath("/reports/deliverables");

      return { success: true, reportId: created.id };
    } catch (error: any) {
      console.error("Save AI report error:", error);

      if (error?.code === "ER_DUP_ENTRY") {
        return {
          success: false,
          error: "A report with this Report ID already exists. Try again.",
        };
      }

      return { success: false, error: "Failed to save report. Please try again." };
    }
  });
}

/* ─── HTML builder for AI Report PDF ─────────────────── */

function buildAIReportPdfHtml(bodyHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <style>
    @page { margin: 20mm 15mm; }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a2e;
      padding: 0;
    }

    h1 { font-size: 18pt; color: #1a1a2e; margin-top: 28px; margin-bottom: 12px; border-bottom: 2px solid #5750F1; padding-bottom: 6px; }
    h2 { font-size: 15pt; color: #1a1a2e; margin-top: 22px; margin-bottom: 10px; }
    h3 { font-size: 13pt; color: #334155; margin-top: 18px; margin-bottom: 8px; }
    h4 { font-size: 11pt; color: #475569; margin-top: 14px; margin-bottom: 6px; font-weight: 600; }

    p { margin-bottom: 8px; text-align: justify; }

    ul, ol { margin: 8px 0; padding-left: 24px; }
    li { margin-bottom: 4px; }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 10pt;
    }

    th {
      background: #f8fafc;
      font-weight: 600;
      text-align: left;
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      color: #475569;
    }

    td {
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
    }

    pre {
      background: #1e1e2e;
      color: #cdd6f4;
      padding: 12px 16px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 9pt;
      margin: 8px 0;
    }

    code:not(pre code) {
      background: #f1f5f9;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 0.9em;
    }

    blockquote {
      border-left: 3px solid #5750F1;
      padding: 8px 16px;
      margin: 12px 0;
      color: #475569;
      background: #f8fafc;
    }

    hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 16px 0;
    }

    a { color: #5750F1; text-decoration: underline; }
    img { max-width: 100%; height: auto; margin: 8px 0; border-radius: 4px; }
    strong { font-weight: 700; }
    em { font-style: italic; }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
