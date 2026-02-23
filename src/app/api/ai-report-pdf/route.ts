import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { marked } from "marked";
import puppeteer from "puppeteer";

/**
 * POST /api/ai-report-pdf
 *
 * Receives Markdown content + report title, converts to PDF via Puppeteer,
 * and returns the PDF buffer inline so the browser can render it.
 *
 * Body: { markdown: string; title?: string }
 */
export async function POST(req: NextRequest) {
  /* ── Auth check ── */
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  /* ── Parse body ── */
  let markdown: string;
  let title: string;

  try {
    const body = await req.json();
    markdown = body.markdown;
    title = body.title || "AI-Generated VAPT Report";
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  if (!markdown || typeof markdown !== "string" || !markdown.trim()) {
    return NextResponse.json(
      { error: "Markdown content is required." },
      { status: 400 },
    );
  }

  /* ── Convert Markdown → HTML ── */
  const bodyHtml = await marked.parse(markdown);
  const html = buildReportPdfHtml(bodyHtml, title);

  /* ── Generate PDF via Puppeteer ── */
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="width:100%;font-size:8px;color:#999;padding:0 15mm;display:flex;justify-content:space-between">
          <span>${escapeForHtml(title)}</span>
          <span>VAPT Report</span>
        </div>`,
      footerTemplate: `
        <div style="width:100%;font-size:8px;color:#999;padding:0 15mm;display:flex;justify-content:space-between">
          <span>CONFIDENTIAL</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>`,
    });

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="ai-report.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } finally {
    await browser.close();
  }
}

/* ─── HTML builder ──────────────────────────────────── */

function buildReportPdfHtml(bodyHtml: string, title: string): string {
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

    /* Section styling */
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

function escapeForHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
