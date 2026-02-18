import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { customReportTemplates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { marked } from "marked";
import puppeteer from "puppeteer";

/**
 * GET /api/template-markdown-pdf
 *
 * Generates a PDF from the stored Markdown content and returns it inline
 * so the browser opens it in a new tab.
 */
export async function GET() {
  /* ── Auth check ── */
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "administrator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  /* ── Fetch Markdown content from DB ── */
  const [row] = await db
    .select()
    .from(customReportTemplates)
    .where(eq(customReportTemplates.id, 1))
    .limit(1);

  if (!row?.markdownContent) {
    return NextResponse.json(
      { error: "No Markdown content available. Generate Markdown first." },
      { status: 404 },
    );
  }

  /* ── Convert Markdown → HTML ── */
  const bodyHtml = await marked.parse(row.markdownContent);
  const html = buildMarkdownPdfHtml(bodyHtml, row.fileName);

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
          <span>Custom Report Template</span>
          <span>${escapeForHtml(row.fileName)}</span>
        </div>`,
      footerTemplate: `
        <div style="width:100%;font-size:8px;color:#999;padding:0 15mm;display:flex;justify-content:space-between">
          <span>Generated from Markdown</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>`,
    });

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="template-report.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } finally {
    await browser.close();
  }
}

/* ─── HTML builder ──────────────────────────────────── */

function buildMarkdownPdfHtml(bodyHtml: string, fileName: string): string {
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

    /* Title block */
    .doc-title {
      font-size: 20pt;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 4px;
    }

    .doc-subtitle {
      font-size: 10pt;
      color: #64748b;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #e2e8f0;
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
  <div class="doc-title">Custom Report Template</div>
  <div class="doc-subtitle">Markdown Preview — ${escapeForHtml(fileName)}</div>
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
