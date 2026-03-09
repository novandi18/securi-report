import puppeteer from "puppeteer";
import fs from "fs/promises";
import path from "path";
import { marked } from "marked";
import { escapeHtml } from "@/lib/markdown-to-html";

export interface ReportAttachmentPDF {
  fileName: string;
  /** Base64 data URI (data:image/png;base64,...) for embedding in HTML */
  dataUri: string;
  mimeType: string;
}

export interface ReportPDFData {
  id: string;
  reportIdCustom: string | null;
  title: string;
  customerName: string;
  issueReferenceNumber: string | null;
  severity: string | null;
  location: string | null;
  description: string | null;
  pocText: string | null;
  referencesList: string | null;
  cvssVector: string | null;
  cvssScore: string | null;
  impact: string | null;
  recommendation: string | null;
  status: string | null;
  createdAt: Date | null;
  attachments?: ReportAttachmentPDF[];
}

/**
 * Generate a PDF from report data using Puppeteer.
 *
 * @returns The relative URL path to the generated PDF (e.g., "/deliverables/PEN-DOC-xxx.pdf")
 */
export async function generateReportPDF(report: ReportPDFData): Promise<string> {
  // Ensure deliverables directory exists
  const delivDir = path.join(process.cwd(), "public", "deliverables");
  await fs.mkdir(delivDir, { recursive: true });

  // Build the HTML document
  const html = buildReportHtml(report);

  // Generate PDF via Puppeteer
  const fileName = `${(report.reportIdCustom || report.id).replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
  const filePath = path.join(delivDir, fileName);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({
      path: filePath,
      format: "A4",
      margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="width:100%;font-size:8px;color:#999;padding:0 15mm;display:flex;justify-content:space-between">
          <span>${escapeHtml(report.title)}</span>
          <span>${escapeHtml(report.reportIdCustom ?? "")}</span>
        </div>`,
      footerTemplate: `
        <div style="width:100%;font-size:8px;color:#999;padding:0 15mm;display:flex;justify-content:space-between">
          <span>CONFIDENTIAL</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>`,
    });
  } finally {
    await browser.close();
  }

  return `/deliverables/${fileName}`;
}

// ─── HTML template for Single Finding Report ──────────────

function buildReportHtml(report: ReportPDFData): string {
  const renderMarkdown = (content: string | null) => {
    if (!content?.trim()) return "";
    return marked.parse(content, { async: false }) as string;
  };

  const severityLabel = (report.severity ?? "Info").toUpperCase();
  const cvssScore = report.cvssScore ?? "—";
  const statusLabel = report.status ?? "Open";

  // Build PoC images
  const pocImages = (report.attachments ?? [])
    .map(
      (a, i) => `
      <div class="poc-item">
        <img src="${a.dataUri}" alt="Figure ${i + 1}: ${escapeHtml(a.fileName)}" />
        <div class="poc-caption"><em>Figure ${i + 1}: ${escapeHtml(a.fileName)}</em></div>
      </div>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
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

    h1 { font-size: 20pt; color: #1a1a2e; margin-bottom: 16px; border-bottom: 3px solid #5750F1; padding-bottom: 8px; }
    h2 { font-size: 15pt; color: #1a1a2e; margin-top: 28px; margin-bottom: 12px; border-bottom: 2px solid #5750F1; padding-bottom: 6px; }
    h3 { font-size: 13pt; color: #334155; margin-top: 18px; margin-bottom: 8px; }
    p { margin-bottom: 8px; text-align: justify; }
    ul, ol { margin: 8px 0; padding-left: 24px; }
    li { margin-bottom: 4px; }

    /* Finding Info Table */
    .finding-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .finding-table th {
      text-align: left; background: #f8fafc; font-size: 10pt; font-weight: 700;
      padding: 10px 14px; border: 1px solid #e2e8f0; width: 220px; color: #1a1a2e;
    }
    .finding-table td {
      padding: 10px 14px; border: 1px solid #e2e8f0; font-size: 10pt;
    }

    .severity-badge {
      display: inline-block; padding: 3px 12px; border-radius: 12px;
      font-size: 10pt; font-weight: 600; color: white;
    }
    .severity-critical { background: #dc2626; }
    .severity-high { background: #ef4444; }
    .severity-medium { background: #f97316; }
    .severity-low { background: #eab308; }
    .severity-info { background: #6b7280; }

    code { background: #f1f5f9; padding: 2px 6px; border-radius: 3px; font-size: 10pt; font-family: 'Menlo', monospace; }
    pre { background: #1e293b; color: #e2e8f0; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 10pt; margin: 12px 0; }
    pre code { background: none; padding: 0; color: inherit; }
    blockquote { border-left: 3px solid #5750F1; padding-left: 16px; margin: 12px 0; color: #475569; }
    a { color: #5750F1; text-decoration: underline; }

    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
    th { background: #f8fafc; font-weight: 600; text-align: left; padding: 8px 12px; border: 1px solid #e2e8f0; }
    td { padding: 8px 12px; border: 1px solid #e2e8f0; }

    .section { margin-bottom: 24px; }
    .section .content { line-height: 1.7; }

    .poc-item { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin: 16px 0; page-break-inside: avoid; }
    .poc-item img { width: 100%; max-height: 500px; object-fit: contain; display: block; background: #f8fafc; }
    .poc-caption { padding: 8px 12px; font-size: 9pt; color: #64748b; background: #f8fafc; border-top: 1px solid #e2e8f0; }

    .confidential { text-align: center; font-size: 9pt; color: #dc2626; font-weight: 600; letter-spacing: 1px; margin-top: 32px; }
  </style>
</head>
<body>

  <h1>PENETRATION TEST FINDING</h1>

  <!-- Finding Info Table -->
  <table class="finding-table">
    <tr>
      <th>ISSUE REFERENCE NUMBER</th>
      <td><strong>${escapeHtml(report.issueReferenceNumber ?? report.reportIdCustom ?? "—")}</strong></td>
    </tr>
    <tr>
      <th>ISSUE TITLE</th>
      <td>${escapeHtml(report.title)}</td>
    </tr>
    <tr>
      <th>AFFECTED MODULE</th>
      <td>${escapeHtml(report.location ?? "—")}</td>
    </tr>
    <tr>
      <th>REFERENCES</th>
      <td>${report.referencesList ? renderMarkdown(report.referencesList) : "—"}</td>
    </tr>
  </table>

  <!-- CVSS Section -->
  <h2>COMMON VULNERABILITY SCORING SYSTEM (CVSS)</h2>
  <div class="section">
    <p><strong>CVSS 4.0 VECTOR</strong> <code>${escapeHtml(report.cvssVector ?? "—")}</code></p>
    <p><strong>RESULT SCORE</strong> <span class="severity-badge severity-${(report.severity ?? "info").toLowerCase()}">${severityLabel} (${escapeHtml(cvssScore)})</span></p>
    <p><strong>STATUS</strong> ${escapeHtml(statusLabel)}</p>
  </div>

  <!-- Description -->
  <h2>DESKRIPSI</h2>
  <div class="section">
    <div class="content">${renderMarkdown(report.description)}</div>
  </div>

  <!-- Proof of Concept -->
  ${report.pocText?.trim() || pocImages ? `
  <div class="section">
    <div class="content">${renderMarkdown(report.pocText)}</div>
    ${pocImages}
  </div>
  ` : ""}

  <!-- Impact -->
  <h2>DAMPAK</h2>
  <div class="section">
    <div class="content">${renderMarkdown(report.impact)}</div>
  </div>

  <!-- Recommendation -->
  <h2>REKOMENDASI PERBAIKAN</h2>
  <div class="section">
    <div class="content">${renderMarkdown(report.recommendation)}</div>
  </div>

  <div class="confidential">CONFIDENTIAL</div>

</body>
</html>`;
}
