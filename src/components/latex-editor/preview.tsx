"use client";

import { useMemo } from "react";
import { latexToHtml } from "@/lib/latex-to-html";
import "katex/dist/katex.min.css";

interface LatexPreviewProps {
  content: string;
  height?: string;
}

/**
 * Renders a LaTeX string into HTML.
 *
 * Supports:
 * - Display math: $$ ... $$ or \[ ... \]
 * - Inline math: $ ... $ or \( ... \)
 * - Text formatting: \textbf, \textit, \underline, \texttt, \emph
 * - Sections: \section, \subsection, \subsubsection
 * - Lists: itemize, enumerate environments with \item
 * - Tables: tabular environment with & column separators, \\ row separators, \hline
 * - Links: \href{url}{text}, \url{url}
 * - Code: verbatim environment
 * - Line breaks: \\, \newline, \par
 * - Horizontal rule: \hrule
 */
export function LatexPreview({ content, height = "200px" }: LatexPreviewProps) {
  const rendered = useMemo(() => {
    if (!content.trim()) {
      return '<span class="text-dark-5 dark:text-dark-6">Nothing to preview</span>';
    }

    try {
      return latexToHtml(content);
    } catch {
      return `<span class="text-red-500">Error rendering LaTeX</span>`;
    }
  }, [content]);

  return (
    <div
      className="overflow-auto rounded-lg border border-stroke bg-white p-4 dark:border-dark-3 dark:bg-dark-2"
      style={{ minHeight: height }}
    >
      <div
        className="latex-preview prose max-w-none dark:prose-invert text-dark dark:text-white [&_table]:border-collapse [&_table]:my-4 [&_th]:border [&_th]:border-gray-300 [&_th]:dark:border-gray-600 [&_th]:bg-gray-100 [&_th]:dark:bg-gray-700 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-gray-300 [&_td]:dark:border-gray-600 [&_td]:px-3 [&_td]:py-2 [&_pre]:bg-[#1e1e2e] [&_pre]:text-[#cdd6f4] [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:text-sm [&_code:not(pre_code)]:bg-gray-100 [&_code:not(pre_code)]:dark:bg-gray-700 [&_code:not(pre_code)]:px-1.5 [&_code:not(pre_code)]:py-0.5 [&_code:not(pre_code)]:rounded [&_code:not(pre_code)]:text-[0.9em]"
        dangerouslySetInnerHTML={{ __html: rendered }}
      />
    </div>
  );
}
