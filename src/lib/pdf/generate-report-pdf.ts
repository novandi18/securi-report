import puppeteer from "puppeteer";
import fs from "fs/promises";
import path from "path";
import { marked } from "marked";
import { escapeHtml } from "@/lib/markdown-to-html";
import type { Issa1Target, Issa2Target, Issa3Target } from "@/lib/db/schema";

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
  executiveSummary: string | null;
  scopeIssa1: Issa1Target[] | null;
  scopeIssa2: Issa2Target[] | null;
  scopeIssa3: Issa3Target[] | null;
  methodology: string | null;
  referencesFramework: string | null;
  cvssVector: string | null;
  impact: string | null;
  recommendationSummary: string | null;
  auditDate: string | null;
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

// ─── HTML template ──────────────────────────────────────

function buildReportHtml(report: ReportPDFData): string {
  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const renderSection = (title: string, content: string | null, num: number) => {
    if (!content?.trim()) return "";
    const htmlContent = marked.parse(content, { async: false }) as string;
    return `
      <div class="section">
        <h2>${num}. ${escapeHtml(title)}</h2>
        <div class="content">${htmlContent}</div>
      </div>`;
  };

  const renderProofOfConcept = (attachments: ReportAttachmentPDF[], num: number) => {
    if (attachments.length === 0) return "";
    return `
      <div class="section" style="page-break-before: always;">
        <h2>${num}. Proof of Concept</h2>
        <div class="poc-grid">
          ${attachments.map((a, i) => `
            <div class="poc-item">
              <img src="${a.dataUri}" alt="Figure ${i + 1}" />
              <div class="poc-caption">Figure ${i + 1}</div>
            </div>
          `).join("")}
        </div>
      </div>`;
  };

  const renderIssa1Table = (title: string, targets: Issa1Target[]) => {
    if (targets.length === 0) return "";
    return `
      <h3 style="margin-top:16px;margin-bottom:8px;font-size:12pt;color:#1a1a2e">${escapeHtml(title)}</h3>
      <table class="info-table" style="width:100%;margin-bottom:12px">
        <thead>
          <tr><th style="width:50px">No.</th><th>Sistem / Endpoint</th><th>IP Address</th><th>Link URL</th></tr>
        </thead>
        <tbody>
          ${targets.map((t) => `<tr><td>${escapeHtml(String(t.no))}</td><td>${escapeHtml(t.sistemEndpoint)}</td><td>${escapeHtml(t.ipAddress)}</td><td>${escapeHtml(t.linkUrl)}</td></tr>`).join("")}
        </tbody>
      </table>`;
  };

  const renderIssa2Table = (title: string, targets: Issa2Target[]) => {
    if (targets.length === 0) return "";
    return `
      <h3 style="margin-top:16px;margin-bottom:8px;font-size:12pt;color:#1a1a2e">${escapeHtml(title)}</h3>
      <table class="info-table" style="width:100%;margin-bottom:12px">
        <thead>
          <tr><th style="width:50px">No.</th><th>IP Public</th><th>Link URL</th></tr>
        </thead>
        <tbody>
          ${targets.map((t) => `<tr><td>${escapeHtml(String(t.no))}</td><td>${escapeHtml(t.ipPublic)}</td><td>${escapeHtml(t.linkUrl)}</td></tr>`).join("")}
        </tbody>
      </table>`;
  };

  const renderIssa3Table = (title: string, targets: Issa3Target[]) => {
    if (targets.length === 0) return "";
    return `
      <h3 style="margin-top:16px;margin-bottom:8px;font-size:12pt;color:#1a1a2e">${escapeHtml(title)}</h3>
      <table class="info-table" style="width:100%;margin-bottom:12px">
        <thead>
          <tr><th style="width:50px">No.</th><th>IP Internal</th></tr>
        </thead>
        <tbody>
          ${targets.map((t) => `<tr><td>${escapeHtml(String(t.no))}</td><td>${escapeHtml(t.ipInternal)}</td></tr>`).join("")}
        </tbody>
      </table>`;
  };

  const renderScopeSection = (r: ReportPDFData, num: number) => {
    const issa1 = r.scopeIssa1 ?? [];
    const issa2 = r.scopeIssa2 ?? [];
    const issa3 = r.scopeIssa3 ?? [];
    if (issa1.length === 0 && issa2.length === 0 && issa3.length === 0) return "";
    return `
      <div class="section">
        <h2>${num}. Scope</h2>
        <div class="content">
          ${renderIssa1Table("BAB IV — ISSA-1 Targets", issa1)}
          ${renderIssa2Table("BAB V — ISSA-2 Targets", issa2)}
          ${renderIssa3Table("BAB V — ISSA-3 Targets", issa3)}
        </div>
      </div>`;
  };

  const severityFromCvss = (vector?: string | null) => {
    if (!vector) return { label: "None", color: "#6b7280", score: "0.0" };
    // Simple CVSS 4.0 scoring approximation based on vector metrics
    const metrics = Object.fromEntries(
      vector
        .replace("CVSS:4.0/", "")
        .split("/")
        .map((p) => p.split(":"))
        .filter((p) => p.length === 2),
    );
    const highCount = Object.values(metrics).filter((v) => v === "H").length;
    const noneCount = Object.values(metrics).filter((v) => v === "N").length;

    if (highCount >= 6) return { label: "Critical", color: "#dc2626", score: "9.0+" };
    if (highCount >= 4) return { label: "High", color: "#ef4444", score: "7.0-8.9" };
    if (highCount >= 2) return { label: "Medium", color: "#f97316", score: "4.0-6.9" };
    if (noneCount >= 8) return { label: "None", color: "#6b7280", score: "0.0" };
    return { label: "Low", color: "#eab308", score: "1.0-3.9" };
  };

  const severity = severityFromCvss(report.cvssVector);

  const referenceTags = report.referencesFramework
    ? report.referencesFramework.split(",").map((r) => r.trim()).filter(Boolean)
    : [];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    @page {
      margin: 20mm 15mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a2e;
    }

    /* Cover Page */
    .cover {
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 85vh;
      text-align: center;
    }

    .cover-badge {
      display: inline-block;
      background: #eff0fe;
      color: #5750F1;
      font-size: 10pt;
      font-weight: 600;
      padding: 6px 16px;
      border-radius: 20px;
      margin-bottom: 24px;
      letter-spacing: 0.5px;
    }

    .cover h1 {
      font-size: 28pt;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 12px;
      max-width: 600px;
    }

    .cover .subtitle {
      font-size: 14pt;
      color: #64748b;
      margin-bottom: 40px;
    }

    .cover-meta {
      border-top: 2px solid #e2e8f0;
      padding-top: 24px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      text-align: left;
      width: 400px;
    }

    .cover-meta dt {
      font-size: 9pt;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .cover-meta dd {
      font-size: 11pt;
      color: #1a1a2e;
      margin-bottom: 8px;
    }

    .cover .confidential {
      margin-top: 48px;
      font-size: 10pt;
      font-weight: 600;
      color: #dc2626;
      letter-spacing: 1px;
      text-transform: uppercase;
      border: 2px solid #dc2626;
      padding: 8px 24px;
      border-radius: 4px;
    }

    /* Overview Table */
    .overview {
      page-break-after: always;
    }

    .overview h2 {
      font-size: 18pt;
      color: #1a1a2e;
      border-bottom: 3px solid #5750F1;
      padding-bottom: 8px;
      margin-bottom: 24px;
    }

    .overview-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }

    .overview-table th {
      text-align: left;
      background: #f8fafc;
      font-size: 9pt;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 12px 16px;
      border-bottom: 2px solid #e2e8f0;
      width: 160px;
    }

    .overview-table td {
      padding: 12px 16px;
      border-bottom: 1px solid #f1f5f9;
      color: #1a1a2e;
    }

    .severity-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 10pt;
      font-weight: 600;
      color: white;
    }

    .ref-tag {
      display: inline-block;
      background: #eff0fe;
      color: #5750F1;
      font-size: 9pt;
      font-weight: 500;
      padding: 3px 10px;
      border-radius: 12px;
      margin: 2px 4px 2px 0;
    }

    /* Sections */
    .section {
      margin-bottom: 32px;
    }

    .section h2 {
      font-size: 16pt;
      color: #1a1a2e;
      border-bottom: 2px solid #5750F1;
      padding-bottom: 6px;
      margin-bottom: 16px;
    }

    .section .content {
      line-height: 1.7;
    }

    .section .content h3 {
      font-size: 13pt;
      color: #334155;
      margin-top: 16px;
      margin-bottom: 8px;
    }

    .section .content h4 {
      font-size: 12pt;
      color: #475569;
      margin-top: 12px;
      margin-bottom: 6px;
    }

    .section .content p {
      margin-bottom: 8px;
    }

    .section .content ul, .section .content ol {
      margin: 8px 0 8px 24px;
    }

    .section .content li {
      margin-bottom: 4px;
    }

    .section .content table {
      border-collapse: collapse;
      margin: 12px 0;
      width: 100%;
    }

    .section .content table th,
    .section .content table td {
      border: 1px solid #e2e8f0;
      padding: 8px 12px;
      text-align: left;
      font-size: 10pt;
    }

    .section .content table th {
      background: #f8fafc;
      font-weight: 600;
    }

    .section .content code {
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10pt;
      font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
    }

    .section .content pre {
      background: #1e293b;
      color: #e2e8f0;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 10pt;
      line-height: 1.5;
      margin: 12px 0;
    }

    .section .content pre code {
      background: none;
      padding: 0;
      color: inherit;
    }

    .section .content blockquote {
      border-left: 3px solid #5750F1;
      padding-left: 16px;
      margin: 12px 0;
      color: #475569;
      font-style: italic;
    }

    .section .content a {
      color: #5750F1;
      text-decoration: underline;
    }

    .section .content hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 16px 0;
    }

    /* Proof of Concept */
    .poc-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 24px;
      margin-top: 16px;
    }

    .poc-item {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      page-break-inside: avoid;
    }

    .poc-item img {
      width: 100%;
      max-height: 500px;
      object-fit: contain;
      display: block;
      background: #f8fafc;
    }

    .poc-caption {
      padding: 8px 12px;
      font-size: 9pt;
      color: #64748b;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      word-break: break-all;
    }

    .poc-empty {
      color: #94a3b8;
      font-style: italic;
      margin-top: 12px;
    }
  </style>
</head>
<body>

  <!-- Cover Page -->
  <div class="cover">
    <span class="cover-badge">PENETRATION TEST REPORT</span>
    <h1>${escapeHtml(report.title)}</h1>
    <p class="subtitle">Prepared for ${escapeHtml(report.customerName)}</p>

    <dl class="cover-meta">
      <div>
        <dt>Report ID</dt>
        <dd>${escapeHtml(report.reportIdCustom ?? "—")}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>${escapeHtml(report.status ?? "Draft")}</dd>
      </div>
      <div>
        <dt>Audit Date</dt>
        <dd>${formatDate(report.auditDate)}</dd>
      </div>
      <div>
        <dt>Generated On</dt>
        <dd>${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</dd>
      </div>
    </dl>

    <div class="confidential">CONFIDENTIAL</div>
  </div>

  <!-- Overview -->
  <div class="overview">
    <h2>Report Overview</h2>
    <table class="overview-table">
      <tr>
        <th>Report Title</th>
        <td>${escapeHtml(report.title)}</td>
      </tr>
      <tr>
        <th>Customer</th>
        <td>${escapeHtml(report.customerName)}</td>
      </tr>
      <tr>
        <th>Report ID</th>
        <td><code>${escapeHtml(report.reportIdCustom ?? "—")}</code></td>
      </tr>
      <tr>
        <th>Audit Date</th>
        <td>${formatDate(report.auditDate)}</td>
      </tr>
      <tr>
        <th>Overall Severity</th>
        <td><span class="severity-badge" style="background:${severity.color}">${severity.label} (${severity.score})</span></td>
      </tr>
      ${report.cvssVector ? `<tr><th>CVSS 4.0 Vector</th><td><code style="font-size:9pt;word-break:break-all">${escapeHtml(report.cvssVector)}</code></td></tr>` : ""}
      ${referenceTags.length > 0 ? `<tr><th>References</th><td>${referenceTags.map((r) => `<span class="ref-tag">${escapeHtml(r)}</span>`).join("")}</td></tr>` : ""}
      <tr>
        <th>Status</th>
        <td>${escapeHtml(report.status ?? "Draft")}</td>
      </tr>
    </table>
  </div>

  <!-- Content Sections -->
  ${renderSection("Executive Summary", report.executiveSummary, 1)}
  ${renderScopeSection(report, 2)}
  ${renderSection("Methodology", report.methodology, 3)}
  ${renderSection("Impact Analysis", report.impact, 4)}
  ${renderSection("Recommendations", report.recommendationSummary, 5)}
  ${renderProofOfConcept(report.attachments ?? [], 6)}

</body>
</html>`;
}
