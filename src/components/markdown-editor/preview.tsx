"use client";

import { useMemo } from "react";
import { markdownToHtml } from "@/lib/markdown-to-html";

interface MarkdownPreviewProps {
  content: string;
  height?: string;
}

/**
 * Renders a Markdown string into HTML.
 *
 * Supports:
 * - Headings: # ## ### ####
 * - Text formatting: **bold**, *italic*, ~~strikethrough~~, `inline code`
 * - Lists: bullet (-) and ordered (1.)
 * - Tables: GFM tables
 * - Links: [text](url)
 * - Images: ![alt](url)
 * - Code blocks: ```language ... ```
 * - Blockquotes: > text
 * - Horizontal rules: ---
 */
export function MarkdownPreview({ content, height = "200px" }: MarkdownPreviewProps) {
  const rendered = useMemo(() => {
    if (!content.trim()) {
      return '<span class="text-dark-5 dark:text-dark-6">Nothing to preview</span>';
    }

    try {
      return markdownToHtml(content);
    } catch {
      return `<span class="text-red-500">Error rendering Markdown</span>`;
    }
  }, [content]);

  return (
    <div
      className="overflow-auto rounded-lg border border-stroke bg-white p-4 dark:border-dark-3 dark:bg-dark-2"
      style={{ minHeight: height }}
    >
      <div
        className="markdown-preview prose max-w-none dark:prose-invert text-dark dark:text-white [&_table]:border-collapse [&_table]:my-4 [&_th]:border [&_th]:border-gray-300 [&_th]:dark:border-gray-600 [&_th]:bg-gray-100 [&_th]:dark:bg-gray-700 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-gray-300 [&_td]:dark:border-gray-600 [&_td]:px-3 [&_td]:py-2 [&_pre]:bg-[#1e1e2e] [&_pre]:text-[#cdd6f4] [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:text-sm [&_code:not(pre_code)]:bg-gray-100 [&_code:not(pre_code)]:dark:bg-gray-700 [&_code:not(pre_code)]:px-1.5 [&_code:not(pre_code)]:py-0.5 [&_code:not(pre_code)]:rounded [&_code:not(pre_code)]:text-[0.9em]"
        dangerouslySetInnerHTML={{ __html: rendered }}
      />
    </div>
  );
}
