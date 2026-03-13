/**
 * Standardized Markdown synthesis for single penetration testing findings.
 *
 * Produces a strict Markdown document following the professional report template.
 * The output is consumed by marked.js → Puppeteer → PDF.
 */

// ─── Interfaces ────────────────────────────────────────

export interface FindingMarkdownInput {
  issueReferenceNumber?: string | null;
  reportIdCustom?: string | null;
  title: string;
  location?: string | null;
  referencesList?: string | null;
  cvssVector?: string | null;
  cvssScore?: string | null;
  severity?: string | null;
  status?: string | null;
  description?: string | null;
  pocText?: string | null;
  impact?: string | null;
  recommendation?: string | null;
  /** Explicit PoC attachments (rendered in "Proof of Concept Visuals" section) */
  attachments?: FindingImageAttachment[];
}

export interface FindingImageAttachment {
  fileName: string;
  caption?: string;
  /** Data URI (data:image/…;base64,…) or relative URL */
  imageUrl: string;
}

// ─── Main function ─────────────────────────────────────

/**
 * Build a standardised Markdown document for a single penetration testing finding.
 *
 * @param input - Finding data mapped from DB/form fields.
 * @returns Compiled Markdown string ready for marked.js parsing.
 */
export function buildFindingMarkdown(input: FindingMarkdownInput): string {
  const issueRef = input.issueReferenceNumber || input.reportIdCustom || "—";
  const title = input.title || "—";
  const location = input.location || "—";
  const cvssVector = input.cvssVector || "—";
  const cvssScore = input.cvssScore || "—";
  const severity = (input.severity || "Info").toUpperCase();
  const status = input.status || "Open";

  const refsCell = formatReferencesForCell(input.referencesList);

  const sections: string[] = [];

  // ── 1. Title ──
  sections.push("# PENETRATION TEST FINDING");

  // ── 2. Metadata table ──
  // GFM requires a header row + separator. First row becomes <thead>.
  sections.push(
    [
      `| **ISSUE REFERENCE NUMBER** | ${esc(issueRef)} |`,
      `|---|---|`,
      `| **ISSUE TITLE** | ${esc(title)} |`,
      `| **AFFECTED MODULE** | ${esc(location)} |`,
      `| **REFERENCES** | ${refsCell} |`,
    ].join("\n"),
  );

  // ── 3. CVSS section ──
  sections.push(
    [
      "## COMMON VULNERABILITY SCORING SYSTEM (CVSS)",
      "",
      `**CVSS 4.0 VECTOR** \`${cvssVector}\``,
      "",
      `**RESULT SCORE** **${severity} (${cvssScore})**`,
      "",
      `**STATUS** ${status}`,
    ].join("\n"),
  );

  // ── 4. Deskripsi ──
  sections.push("## DESKRIPSI");
  if (input.description?.trim()) {
    sections.push(input.description.trim());
  }

  // ── 5. PoC text (steps to reproduce) ──
  if (input.pocText?.trim()) {
    sections.push(input.pocText.trim());
  }

  // ── 6. Proof of Concept Visuals (explicit attachments) ──
  if (input.attachments && input.attachments.length > 0) {
    const imageLines: string[] = ["### Proof of Concept Visuals"];

    input.attachments.forEach((att, i) => {
      const num = i + 1;
      const caption = att.caption || att.fileName;
      imageLines.push(
        [
          `**Gambar ${num}** ${caption}`,
          "",
          `![${caption}](${att.imageUrl})`,
          "",
          `_Gambar ${num} ${caption}_`,
        ].join("\n"),
      );
    });

    sections.push(imageLines.join("\n\n"));
  }

  // ── 7. Dampak ──
  sections.push("## DAMPAK");
  if (input.impact?.trim()) {
    sections.push(input.impact.trim());
  }

  // ── 8. Rekomendasi Perbaikan ──
  sections.push("## REKOMENDASI PERBAIKAN");
  if (input.recommendation?.trim()) {
    sections.push(input.recommendation.trim());
  }

  return sections.join("\n\n");
}

// ─── Upload reference resolution ───────────────────────

/**
 * Resolve `![upload]["filename.png"]` references in Markdown content
 * to standard image syntax with base64 data URIs (for PDF rendering)
 * or relative URLs (for browser preview).
 */
export function resolveUploadRefsForPdf(
  content: string,
  attachmentMap: Map<string, string>,
): string {
  return content.replace(
    /!\[upload\]\["([^"]+)"\]/g,
    (_match, fileName: string) => {
      const resolved = attachmentMap.get(fileName);
      return resolved ? `![${fileName}](${resolved})` : `![${fileName}]()`;
    },
  );
}

// ─── Helpers to filter attachments already referenced inline ──

/**
 * Return only attachments whose fileName is NOT already referenced
 * via `![upload]["filename"]` in the description or pocText.
 */
export function getUnreferencedAttachments(
  description: string | null | undefined,
  pocText: string | null | undefined,
  attachments: FindingImageAttachment[],
): FindingImageAttachment[] {
  const combined = (description ?? "") + (pocText ?? "");
  return attachments.filter((att) => !combined.includes(att.fileName));
}

// ─── PDF HTML shell ────────────────────────────────────

/**
 * Wrap marked-generated body HTML in a styled PDF document shell.
 * This is the single source of truth for PDF CSS across all generation paths.
 */
export function buildFindingPdfShell(
  bodyHtml: string,
  title: string,
  reportId?: string,
): string {
  const safeTitle = escapeHtml(title);
  const safeId = reportId ? escapeHtml(reportId) : "";

  // Header / footer templates are set via Puppeteer page.pdf() options,
  // so they are NOT embedded here. This function only produces the <body>.
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>${safeTitle}${safeId ? ` — ${safeId}` : ""}</title>
  <style>
    @page { margin: 20mm 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
                   'Helvetica Neue', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a2e;
      padding: 0;
    }

    /* ── Headings ── */
    h1 {
      font-size: 20pt; color: #1a1a2e;
      margin-bottom: 16px;
      border-bottom: 3px solid #5750F1; padding-bottom: 8px;
    }
    h2 {
      font-size: 15pt; color: #1a1a2e;
      margin-top: 28px; margin-bottom: 12px;
      border-bottom: 2px solid #5750F1; padding-bottom: 6px;
    }
    h3 {
      font-size: 13pt; color: #334155;
      margin-top: 18px; margin-bottom: 8px;
    }
    h4 {
      font-size: 11pt; color: #475569;
      margin-top: 14px; margin-bottom: 6px; font-weight: 600;
    }

    /* ── Prose ── */
    p  { margin-bottom: 8px; text-align: justify; }
    ul, ol { margin: 8px 0; padding-left: 24px; }
    li { margin-bottom: 4px; }

    /* ── Tables (metadata + inline) ── */
    table {
      width: 100%; border-collapse: collapse;
      margin: 12px 0; font-size: 10pt;
    }
    th {
      background: #f8fafc; font-weight: 700; text-align: left;
      padding: 10px 14px; border: 1px solid #e2e8f0; color: #1a1a2e;
    }
    td {
      padding: 10px 14px; border: 1px solid #e2e8f0;
    }
    /* First column in the metadata table should be wider */
    thead th:first-child,
    tbody td:first-child {
      width: 240px; white-space: nowrap;
    }

    /* ── Code ── */
    code {
      background: #f1f5f9; padding: 2px 6px; border-radius: 3px;
      font-size: 10pt; font-family: 'Menlo', 'Consolas', monospace;
    }
    pre {
      background: #1e293b; color: #e2e8f0;
      padding: 16px; border-radius: 8px;
      overflow-x: auto; font-size: 10pt; margin: 12px 0;
    }
    pre code { background: none; padding: 0; color: inherit; }

    /* ── Block elements ── */
    blockquote {
      border-left: 3px solid #5750F1; padding: 8px 16px;
      margin: 12px 0; color: #475569; background: #f8fafc;
    }
    hr { border: none; border-top: 1px solid #e2e8f0; margin: 16px 0; }
    a  { color: #5750F1; text-decoration: underline; }
    strong { font-weight: 700; }
    em { font-style: italic; }

    /* ── Images & PoC visuals ── */
    img {
      max-width: 100%; height: auto;
      margin: 8px 0; border-radius: 4px;
      border: 1px solid #e2e8f0;
      page-break-inside: avoid;
    }

    /* ── Footer ── */
    .confidential {
      text-align: center; font-size: 9pt; color: #dc2626;
      font-weight: 600; letter-spacing: 1px; margin-top: 32px;
    }
  </style>
</head>
<body>
  ${bodyHtml}

  <div class="confidential">CONFIDENTIAL</div>
</body>
</html>`;
}

// ─── Private helpers ───────────────────────────────────

/**
 * Format `referencesList` (Markdown list) into a single table-cell value
 * using `<br>` separators so it fits in a GFM table row.
 *
 * Input example:
 *   "- CWE-89: Improper Neutralization…\n- OWASP A03:2021 – Injection"
 *
 * Output:
 *   "• **CWE-89**: Improper Neutralization… <br> • **OWASP A03:2021**: Injection"
 */
function formatReferencesForCell(raw: string | null | undefined): string {
  if (!raw?.trim()) return "—";

  const lines = raw
    .split("\n")
    .map((l) => l.replace(/^[\s\-*•]+/, "").trim())
    .filter(Boolean);

  if (lines.length === 0) return "—";

  return lines
    .map((line) => {
      // Try to bold the identifier (CWE-xxx, CVE-xxx, OWASP xxx, NIST xxx)
      const bolded = line.replace(
        /^((?:CWE|CVE|OWASP|NIST)[^\s:–—-]*)/i,
        "**$1**",
      );
      return `• ${bolded}`;
    })
    .join(" <br> ");
}

/** Escape pipe characters so they don't break GFM table cells. */
function esc(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/** Escape HTML special characters for use inside HTML attributes/text. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
