import katex from "katex";

/**
 * Convert LaTeX text to HTML.
 *
 * Handles:
 * - Display & inline math via KaTeX
 * - Text formatting (\textbf, \textit, \underline, \texttt, \emph, \textsc, \textsf)
 * - Sectioning (\section, \subsection, \subsubsection, \paragraph)
 * - Lists (itemize, enumerate, description environments)
 * - Tables (tabular environment)
 * - Links (\href, \url)
 * - Code (verbatim environment, \verb)
 * - Line breaks (\\, \newline, \par)
 * - Special characters (\%, \$, \#, \&, \_, \{, \}, --, ---, ``, '', ~)
 */
export function latexToHtml(input: string): string {
  if (!input || !input.trim()) return "";

  // Step 1: Extract and protect verbatim blocks
  const verbatimBlocks: string[] = [];
  let processed = input.replace(
    /\\begin\{verbatim\}([\s\S]*?)\\end\{verbatim\}/g,
    (_, content) => {
      const idx = verbatimBlocks.length;
      verbatimBlocks.push(`<pre><code>${escapeHtml(content)}</code></pre>`);
      return `%%VERBATIM_${idx}%%`;
    },
  );

  // Step 2: Extract and protect math blocks
  const mathBlocks: string[] = [];

  // Display math: $$...$$ or \[...\]
  processed = processed.replace(
    /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]/g,
    (_, m1, m2) => {
      const idx = mathBlocks.length;
      mathBlocks.push(
        katex.renderToString(m1 ?? m2, {
          displayMode: true,
          throwOnError: false,
          trust: false,
          strict: "warn",
          maxSize: 500,
          maxExpand: 100,
        }),
      );
      return `%%MATH_${idx}%%`;
    },
  );

  // Inline math: $...$ or \(...\)
  processed = processed.replace(
    /\$([^\$\n]+?)\$|\\\(([\s\S]*?)\\\)/g,
    (_, m1, m2) => {
      const idx = mathBlocks.length;
      mathBlocks.push(
        katex.renderToString(m1 ?? m2, {
          displayMode: false,
          throwOnError: false,
          trust: false,
          strict: "warn",
          maxSize: 500,
          maxExpand: 100,
        }),
      );
      return `%%MATH_${idx}%%`;
    },
  );

  // Step 3: Process environments
  processed = processEnvironments(processed);

  // Step 4: Process text commands
  processed = processTextCommands(processed);

  // Step 5: Restore protected blocks
  for (let i = 0; i < mathBlocks.length; i++) {
    processed = processed.replace(`%%MATH_${i}%%`, mathBlocks[i]);
  }
  for (let i = 0; i < verbatimBlocks.length; i++) {
    processed = processed.replace(`%%VERBATIM_${i}%%`, verbatimBlocks[i]);
  }

  return processed;
}

// ─── Environments ───────────────────────────────────────

function processEnvironments(input: string): string {
  let result = input;

  result = result.replace(
    /\\begin\{tabular\}(?:\{[^}]*\})?([\s\S]*?)\\end\{tabular\}/g,
    (_, body: string) => processTabular(body),
  );

  result = result.replace(
    /\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g,
    (_, body: string) => processList(body, "ul"),
  );

  result = result.replace(
    /\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g,
    (_, body: string) => processList(body, "ol"),
  );

  result = result.replace(
    /\\begin\{description\}([\s\S]*?)\\end\{description\}/g,
    (_, body: string) => processDescriptionList(body),
  );

  result = result.replace(
    /\\begin\{(?:quote|quotation)\}([\s\S]*?)\\end\{(?:quote|quotation)\}/g,
    (_, body: string) =>
      `<blockquote>${processTextContent(body.trim())}</blockquote>`,
  );

  result = result.replace(
    /\\begin\{center\}([\s\S]*?)\\end\{center\}/g,
    (_, body: string) =>
      `<div style="text-align:center">${processTextContent(body.trim())}</div>`,
  );

  result = result.replace(
    /\\begin\{flushleft\}([\s\S]*?)\\end\{flushleft\}/g,
    (_, body: string) =>
      `<div style="text-align:left">${processTextContent(body.trim())}</div>`,
  );

  result = result.replace(
    /\\begin\{flushright\}([\s\S]*?)\\end\{flushright\}/g,
    (_, body: string) =>
      `<div style="text-align:right">${processTextContent(body.trim())}</div>`,
  );

  return result;
}

function processTabular(body: string): string {
  const clean = body.replace(/\\hline/g, "").trim();
  const rows = clean
    .split(/\\\\/)
    .map((r) => r.trim())
    .filter(Boolean);

  const htmlRows = rows.map((row, i) => {
    const cells = row.split("&").map((c) => c.trim());
    const tag = i === 0 ? "th" : "td";
    const cellsHtml = cells
      .map((c) => `<${tag}>${processTextContent(c)}</${tag}>`)
      .join("");
    return `<tr>${cellsHtml}</tr>`;
  });

  return `<table>${htmlRows.join("")}</table>`;
}

function processList(body: string, tag: "ul" | "ol"): string {
  const items = body.split(/\\item\s*/).filter((s) => s.trim());
  const htmlItems = items.map((item) => {
    let content = item.trim();
    content = processEnvironments(content);
    return `<li>${processTextContent(content)}</li>`;
  });
  return `<${tag}>${htmlItems.join("")}</${tag}>`;
}

function processDescriptionList(body: string): string {
  const items = body.split(/\\item\s*/).filter((s) => s.trim());
  const htmlItems = items.map((item) => {
    const labelMatch = item.match(/^\[([^\]]*)\]\s*([\s\S]*)/);
    if (labelMatch) {
      return `<dt><strong>${escapeHtml(labelMatch[1])}</strong></dt><dd>${processTextContent(labelMatch[2].trim())}</dd>`;
    }
    return `<dd>${processTextContent(item.trim())}</dd>`;
  });
  return `<dl>${htmlItems.join("")}</dl>`;
}

// ─── Text commands ──────────────────────────────────────

function processTextCommands(input: string): string {
  let result = input;

  // Images: \includegraphics[...]{path}
  result = result.replace(
    /\\includegraphics(?:\[[^\]]*\])?\{([^}]*)\}/g,
    (_, src) => {
      const safeSrc = escapeHtml(src.trim());
      return `<figure style="margin:1em 0"><img src="${safeSrc}" alt="Report image" style="max-width:100%;height:auto;border-radius:0.5rem" /></figure>`;
    },
  );

  // Sections
  result = result.replace(/\\section\*?\{([^}]*)\}/g, (_, t) => `<h2>${escapeHtml(t)}</h2>`);
  result = result.replace(/\\subsection\*?\{([^}]*)\}/g, (_, t) => `<h3>${escapeHtml(t)}</h3>`);
  result = result.replace(/\\subsubsection\*?\{([^}]*)\}/g, (_, t) => `<h4>${escapeHtml(t)}</h4>`);
  result = result.replace(/\\paragraph\*?\{([^}]*)\}/g, (_, t) => `<h5>${escapeHtml(t)}</h5>`);

  // Text formatting (multiple passes for nesting)
  for (let pass = 0; pass < 3; pass++) {
    result = result.replace(/\\textbf\{([^}]*)\}/g, (_, t) => `<strong>${t}</strong>`);
    result = result.replace(/\\textit\{([^}]*)\}/g, (_, t) => `<em>${t}</em>`);
    result = result.replace(/\\emph\{([^}]*)\}/g, (_, t) => `<em>${t}</em>`);
    result = result.replace(/\\underline\{([^}]*)\}/g, (_, t) => `<u>${t}</u>`);
    result = result.replace(/\\texttt\{([^}]*)\}/g, (_, t) => `<code>${escapeHtml(t)}</code>`);
    result = result.replace(/\\textsc\{([^}]*)\}/g, (_, t) => `<span style="font-variant:small-caps">${t}</span>`);
    result = result.replace(/\\textsf\{([^}]*)\}/g, (_, t) => `<span style="font-family:sans-serif">${t}</span>`);
    result = result.replace(/\\sout\{([^}]*)\}/g, (_, t) => `<s>${t}</s>`);
  }

  // Links
  result = result.replace(
    /\\href\{([^}]*)\}\{([^}]*)\}/g,
    (_, url, text) => `<a href="${escapeHtml(url)}" style="color:#5750F1;text-decoration:underline">${escapeHtml(text)}</a>`,
  );
  result = result.replace(
    /\\url\{([^}]*)\}/g,
    (_, url) => `<a href="${escapeHtml(url)}" style="color:#5750F1;text-decoration:underline">${escapeHtml(url)}</a>`,
  );

  // Code
  result = result.replace(/\\verb\|([^|]*)\|/g, (_, code) => `<code>${escapeHtml(code)}</code>`);

  // Footnotes
  result = result.replace(
    /\\footnote\{([^}]*)\}/g,
    (_, text) => `<sup title="${escapeHtml(text)}" style="cursor:help;color:#5750F1">[*]</sup>`,
  );

  // Rules & page breaks
  result = result.replace(/\\hrule\b/g, "<hr/>");
  result = result.replace(/\\rule\{[^}]*\}\{[^}]*\}/g, "<hr/>");
  result = result.replace(/\\noindent\b\s*/g, "");
  result = result.replace(/\\(?:clearpage|newpage|pagebreak)\b/g, "<hr/>");

  // Process remaining text
  result = processTextContent(result);

  return result;
}

// ─── Plain text processing ──────────────────────────────

function processTextContent(input: string): string {
  let result = input;

  result = result.replace(/\\par\b\s*/g, "</p><p>");
  result = result.replace(/\\newline\b/g, "<br/>");
  result = result.replace(/\\\\(?!%)/g, "<br/>");

  result = result.replace(
    /\\hspace\*?\{([^}]*)\}/g,
    (_, size) => `<span style="margin-left:${latexSizeToCSS(size)}"></span>`,
  );
  result = result.replace(
    /\\vspace\*?\{([^}]*)\}/g,
    (_, size) => `<div style="height:${latexSizeToCSS(size)}"></div>`,
  );

  result = result.replace(/~/g, "&nbsp;");
  result = result.replace(/---/g, "\u2014");
  result = result.replace(/--/g, "\u2013");
  result = result.replace(/``/g, "\u201C");
  result = result.replace(/''/g, "\u201D");

  result = result.replace(/\\%/g, "%");
  result = result.replace(/\\\$/g, "$");
  result = result.replace(/\\#/g, "#");
  result = result.replace(/\\&/g, "&amp;");
  result = result.replace(/\\_/g, "_");
  result = result.replace(/\\\{/g, "{");
  result = result.replace(/\\\}/g, "}");
  result = result.replace(/\\(?:ldots|dots)\b/g, "\u2026");
  result = result.replace(
    /\\LaTeX\b/g,
    '<span style="font-variant:small-caps">L<sup style="font-size:0.7em;margin-left:-0.3em">A</sup>T<sub style="font-size:0.7em;margin-left:-0.1em">E</sub>X</span>',
  );
  result = result.replace(
    /\\today\b/g,
    new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
  );

  result = result.replace(/\n\s*\n/g, "</p><p>");
  result = result.replace(/\n/g, "<br/>");

  return result;
}

// ─── Helpers ────────────────────────────────────────────

function latexSizeToCSS(size: string): string {
  const match = size.match(/^([\d.]+)\s*(cm|mm|in|pt|em|ex|px)?$/);
  if (!match) return "1em";
  return `${match[1]}${match[2] || "em"}`;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
