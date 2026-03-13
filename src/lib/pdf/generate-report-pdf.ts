import puppeteer from "puppeteer";
import fs from "fs/promises";
import path from "path";
import { marked } from "marked";
import { escapeHtml } from "@/lib/markdown-to-html";
import {
  buildFindingMarkdown,
  buildFindingPdfShell,
  resolveUploadRefsForPdf,
  getUnreferencedAttachments,
  type FindingImageAttachment,
} from "@/lib/pdf/finding-markdown";

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
 * Uses the standardised markdown synthesis pipeline:
 *   ReportPDFData → buildFindingMarkdown → resolveUploadRefs → marked → PDF shell → Puppeteer
 *
 * @returns The relative URL path to the generated PDF (e.g., "/deliverables/PEN-DOC-xxx.pdf")
 */
export async function generateReportPDF(report: ReportPDFData): Promise<string> {
  const delivDir = path.join(process.cwd(), "public", "deliverables");
  await fs.mkdir(delivDir, { recursive: true });

  // Build attachment map for resolving ![upload]["file"] references
  const attachmentMap = new Map<string, string>();
  const allImages: FindingImageAttachment[] = [];
  for (const att of report.attachments ?? []) {
    attachmentMap.set(att.fileName, att.dataUri);
    allImages.push({
      fileName: att.fileName,
      imageUrl: att.dataUri,
    });
  }

  // Only include attachments not already referenced inline in description/pocText
  const explicitAttachments = getUnreferencedAttachments(
    report.description,
    report.pocText,
    allImages,
  );

  // Synthesise standardised Markdown
  const markdown = buildFindingMarkdown({
    issueReferenceNumber: report.issueReferenceNumber,
    reportIdCustom: report.reportIdCustom,
    title: report.title,
    location: report.location,
    referencesList: report.referencesList,
    cvssVector: report.cvssVector,
    cvssScore: report.cvssScore,
    severity: report.severity,
    status: report.status,
    description: report.description,
    pocText: report.pocText,
    impact: report.impact,
    recommendation: report.recommendation,
    attachments: explicitAttachments,
  });

  // Resolve any ![upload]["filename"] inline refs to base64 data URIs
  const resolved = resolveUploadRefsForPdf(markdown, attachmentMap);

  // Markdown → HTML → PDF shell
  const bodyHtml = marked.parse(resolved, { async: false }) as string;
  const html = buildFindingPdfShell(bodyHtml, report.title, report.reportIdCustom ?? undefined);

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
