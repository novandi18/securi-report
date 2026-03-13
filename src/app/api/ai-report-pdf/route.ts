import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { marked } from "marked";
import puppeteer from "puppeteer";
import { buildFindingPdfShell } from "@/lib/pdf/finding-markdown";
import { escapeHtml } from "@/lib/markdown-to-html";

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
  const html = buildFindingPdfShell(bodyHtml, title);

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
          <span>${escapeHtml(title)}</span>
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
