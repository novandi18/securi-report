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
import { sanitizeMarkdown } from "@/lib/security/markdown-sanitizer";
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
    description: string;
    impact: string;
    recommendation: string;
    cvssVector: string;
    cvssScore: string;
    severity: string;
    location: string;
    referencesList: string;
  };
  error?: string;
}

/* ─── System Instruction for Structured Finding ── */

const SYSTEM_INSTRUCTION = `# SYSTEM INSTRUCTION: STRUCTURED SECURITY FINDING GENERATOR (JSON)

## CORE IDENTITY

Anda adalah seorang ahli keamanan siber dan pentester profesional. Tugas Anda adalah menganalisis data kerentanan mentah dan menghasilkan output structured JSON yang berisi field-field temuan keamanan.

## OUTPUT FORMAT

Output Anda HARUS selalu berupa JSON valid tanpa code block wrapper, tanpa backtick, tanpa teks tambahan di luar JSON.

## JSON SCHEMA

{
  "description": "string (Markdown) — Deskripsi teknis lengkap tentang kerentanan",
  "impact": "string (Markdown) — Analisis dampak keamanan dan bisnis",
  "recommendation": "string (Markdown) — Langkah-langkah remediasi konkret",
  "cvssVector": "string — CVSS 4.0 vector, contoh: CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N",
  "cvssScore": "string — Skor numerik CVSS, contoh: 8.7",
  "severity": "string — Salah satu: Critical, High, Medium, Low, Info",
  "location": "string — Lokasi/IP/URL/modul yang terpengaruh",
  "referencesList": "string (Markdown) — Daftar referensi CWE/CVE terkait"
}

## FIELD RULES

1. description: Penjelasan teknis mendetail. Gunakan Markdown (bold, code blocks, lists). Jelaskan langkah eksploitasi.
2. impact: Analisis dampak keamanan dan bisnis. Gunakan bullet points.
3. recommendation: Langkah remediasi konkret. Gunakan numbered list.
4. cvssVector: HARUS valid CVSS 4.0 vector string.
5. cvssScore: Skor numerik sesuai vector.
6. severity: Berdasarkan skor CVSS — Critical (9.0-10.0), High (7.0-8.9), Medium (4.0-6.9), Low (0.1-3.9), Info (0.0).
7. location: IP address, URL, atau modul terdampak.
8. referencesList: Daftar CWE/CVE dalam format Markdown list.

## LANGUAGE RULES

- Gunakan bahasa Indonesia formal (EYD).
- Istilah teknis dalam bahasa Inggris (italic atau code block).
- Nada objektif, faktual, tidak spekulatif.

## IMAGE ANALYSIS

Jika ada gambar PoC, analisis dan integrasikan temuan visual ke deskripsi.
Gunakan TEPAT sintaks berikut untuk menyisipkan gambar: ![upload]["nama_file.png"]
Contoh: ![upload]["nmap_scan_result.png"]
Gunakan nama file PERSIS seperti yang diberikan di label gambar.
Letakkan referensi gambar di posisi yang relevan dalam deskripsi, dekat dengan penjelasan terkait.`;

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

/**
 * Resolve ![upload]["filename.png"] references in markdown
 * to standard markdown image syntax with base64 data URIs for PDF rendering.
 */
function resolveUploadRefsForPdf(
  content: string,
  attachmentMap: Map<string, string>,
): string {
  return content.replace(
    /!\[upload\]\["([^"]+)"\]/g,
    (_match, fileName: string) => {
      const dataUri = attachmentMap.get(fileName);
      return dataUri ? `![${fileName}](${dataUri})` : `![${fileName}]()`;
    },
  );
}

/**
 * Read an image file and return its base64 data URI.
 */
async function readImageAsDataUri(fileUrl: string): Promise<string | null> {
  const result = await readImageAsBase64(fileUrl);
  if (!result) return null;
  return `data:${result.mimeType};base64,${result.data}`;
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
    const imageFileNames = formData.pocImages?.map((img) => img.fileName) ?? [];
    const imageNote = imageCount > 0
      ? `\n${imageCount} gambar PoC (Proof of Concept) dilampirkan.\nNama file gambar: ${imageFileNames.join(", ")}\nSisipkan gambar ke dalam field "description" menggunakan sintaks: ![upload]["nama_file.png"]\nLetakkan setiap gambar di posisi yang relevan dalam deskripsi.`
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

    const promptText = `Analisis data kerentanan berikut dan hasilkan structured JSON finding:

Judul Temuan: ${formData.title}
${customerLine}
${contextLine}
Data temuan mentah (raw findings):
${formData.rawNotes}
${scopeNote}${imageNote}

PENTING:
- Output HARUS berupa JSON valid saja, tanpa code block wrapper.
- Isi setiap field sesuai schema yang sudah ditentukan di system instruction.
- Jika data menyebutkan severity/skor, gunakan itu. Jika tidak, tentukan sendiri.
- Semua field Markdown (description, impact, recommendation, referencesList) harus menggunakan formatting Markdown yang baik.`;

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

      const rawText = response.text?.trim();

      if (!rawText) {
        return {
          success: false,
          error: "Gemini returned an empty response. Please try again.",
        };
      }

      // Clean up: remove any code block wrappers if present
      const cleaned = rawText
        .replace(/^```(?:json)?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "")
        .trim();

      // Parse JSON response
      let parsed: {
        description?: string;
        impact?: string;
        recommendation?: string;
        cvssVector?: string;
        cvssScore?: string;
        severity?: string;
        location?: string;
        referencesList?: string;
      };

      try {
        parsed = JSON.parse(cleaned);
      } catch {
        console.error("Failed to parse AI JSON response:", cleaned.substring(0, 500));
        return {
          success: false,
          error: "AI returned invalid JSON. Please try again.",
        };
      }

      // Build markdownReport from structured fields for backward compatibility / preview
      const markdownReport = [
        `## Deskripsi\n\n${parsed.description || ""}`,
        `## Dampak\n\n${parsed.impact || ""}`,
        `## Rekomendasi\n\n${parsed.recommendation || ""}`,
        `## Referensi\n\n${parsed.referencesList || ""}`,
      ].join("\n\n---\n\n");

      /* ── Audit log ── */
      await audit({
        action: "report.ai_generate",
        userId: user.id,
        detail: `AI finding generated: "${formData.title}" (model: ${model}, images: ${imageCount})`,
      });

      return {
        success: true,
        data: {
          markdownReport,
          description: parsed.description || "",
          impact: parsed.impact || "",
          recommendation: parsed.recommendation || "",
          cvssVector: parsed.cvssVector || "",
          cvssScore: parsed.cvssScore || "",
          severity: parsed.severity || "Info",
          location: parsed.location || "",
          referencesList: parsed.referencesList || "",
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
  clientCode?: string;
  serviceAffected?: string;
  findingSequence?: number;
  issueReferenceNumber?: string;
  severity?: string;
  // Individual finding fields (matching manual finding form)
  description?: string;
  location?: string;
  cvssVector?: string;
  cvssScore?: string;
  impact?: string;
  recommendation?: string;
  referencesList?: string;
}

export interface SaveAIReportResult {
  success: boolean;
  reportId?: string;
  pdfUrl?: string;
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
    if (!input.description?.trim() && !input.markdownReport.trim()) {
      return { success: false, error: "Finding description is required." };
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
        description: sanitizeMarkdown(input.description || input.markdownReport) || null,
        location: input.location || null,
        cvssVector: input.cvssVector || null,
        cvssScore: input.cvssScore || null,
        impact: sanitizeMarkdown(input.impact || "") || null,
        recommendation: sanitizeMarkdown(input.recommendation || "") || null,
        referencesList: input.referencesList || null,
        severity: (input.severity as "Critical" | "High" | "Medium" | "Low" | "Info") ?? "Info",
        status: input.status as "Open" | "Closed" | "Draft",
        createdBy: user.id,
        scopeIssa1: input.scopeIssa1 ?? undefined,
        scopeIssa2: input.scopeIssa2 ?? undefined,
        scopeIssa3: input.scopeIssa3 ?? undefined,
        clientCode: input.clientCode || undefined,
        serviceAffected: input.serviceAffected || undefined,
        findingSequence: input.findingSequence || undefined,
        issueReferenceNumber: input.issueReferenceNumber || undefined,
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

      /* ── 3. Generate PDF from structured fields ── */
      const delivDir = path.join(process.cwd(), "public", "deliverables");
      await fs.mkdir(delivDir, { recursive: true });

      const pdfFileName = `${reportIdCustom.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
      const pdfFileUrl = `/deliverables/${pdfFileName}`;

      // Build attachment lookup for resolving ![upload]["file"] references as base64 data URIs
      const attachmentMap = new Map<string, string>();
      if (input.pocImages && input.pocImages.length > 0) {
        for (const img of input.pocImages) {
          const dataUri = await readImageAsDataUri(img.fileUrl);
          if (dataUri) {
            attachmentMap.set(img.fileName, dataUri);
          }
        }
      }

      // Build markdown from individual fields for PDF
      const pdfMarkdownRaw = input.description
        ? [
            `# ${escapeHtml(input.title)}`,
            `## Deskripsi\n\n${input.description}`,
            input.location ? `**Lokasi:** ${input.location}` : "",
            input.cvssVector ? `**CVSS Vector:** ${input.cvssVector}` : "",
            input.cvssScore ? `**CVSS Score:** ${input.cvssScore} (${input.severity || "Info"})` : "",
            input.impact ? `## Dampak\n\n${input.impact}` : "",
            input.recommendation ? `## Rekomendasi\n\n${input.recommendation}` : "",
            input.referencesList ? `## Referensi\n\n${input.referencesList}` : "",
          ].filter(Boolean).join("\n\n")
        : input.markdownReport;

      // Resolve ![upload]["filename"] → standard markdown images with absolute file:// paths
      const pdfMarkdown = resolveUploadRefsForPdf(pdfMarkdownRaw, attachmentMap);

      const bodyHtml = await marked.parse(pdfMarkdown);

      // Debug: verify markdown→HTML conversion
      if (bodyHtml === pdfMarkdown || !bodyHtml.includes("<")) {
        console.warn("WARNING: marked.parse() did not convert markdown to HTML properly.");
        console.warn("Input length:", pdfMarkdown.length, "Output length:", bodyHtml.length);
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
        await db.insert(deliverables).values({
          reportId: created.id,
          format: "PDF",
          fileUrl: pdfFileUrl,
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

      return { success: true, reportId: created.id, pdfUrl: pdfFileUrl };
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
