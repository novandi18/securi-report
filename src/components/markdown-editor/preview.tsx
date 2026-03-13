"use client";

import { useMemo } from "react";
import { markdownToHtml } from "@/lib/markdown-to-html";

interface MarkdownPreviewProps {
  content: string;
  height?: string;
  /** Uploaded attachments for resolving ![upload]["filename"] references */
  attachments?: { fileName: string; fileUrl: string }[];
  /** Locally selected files (blob URLs) for instant preview before upload */
  localFiles?: { fileName: string; blobUrl: string }[];
}

/**
 * Resolve `![upload]["filename.png"]` references in markdown content
 * by replacing them with standard markdown image syntax.
 * Checks local blob URLs first (for instant preview), then uploaded attachments.
 */
function resolveUploadReferences(
  content: string,
  attachments: { fileName: string; fileUrl: string }[],
  localFiles: { fileName: string; blobUrl: string }[] = [],
): string {
  // Match ![upload]["filename.ext"] pattern
  return content.replace(
    /!\[upload\]\["([^"]+)"\]/g,
    (_match, fileName: string) => {
      // Check local blob URLs first (files selected but not yet uploaded)
      const local = localFiles.find((f) => f.fileName === fileName);
      if (local) {
        return `![${fileName}](${local.blobUrl})`;
      }
      // Then check uploaded attachments
      const att = attachments.find(
        (a) => a.fileName === fileName,
      );
      if (att) {
        return `![${fileName}](${att.fileUrl})`;
      }
      // Keep original text with a visual indicator that the file wasn't found
      return `![⚠ File not found: ${fileName}]()`;
    },
  );
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
 * - Upload references: ![upload]["filename.png"]
 * - Code blocks: ```language ... ```
 * - Blockquotes: > text
 * - Horizontal rules: ---
 */
export function MarkdownPreview({ content, height = "200px", attachments, localFiles }: MarkdownPreviewProps) {
  const rendered = useMemo(() => {
    if (!content.trim()) {
      return '<span class="text-dark-5 dark:text-dark-6">Nothing to preview</span>';
    }

    try {
      // Resolve upload references before converting to HTML
      const resolved = (attachments?.length || localFiles?.length)
        ? resolveUploadReferences(content, attachments ?? [], localFiles ?? [])
        : content;
      return markdownToHtml(resolved);
    } catch {
      return `<span class="text-red-500">Error rendering Markdown</span>`;
    }
  }, [content, attachments, localFiles]);

  return (
    <div
      className="overflow-auto rounded-lg border border-stroke bg-white p-4 dark:border-dark-3 dark:bg-dark-2"
      style={{ minHeight: height }}
    >
      <div
        className="markdown-preview prose prose-sm max-w-none dark:prose-invert prose-headings:text-dark dark:prose-headings:text-white prose-p:text-dark dark:prose-p:text-gray-300 prose-strong:text-dark dark:prose-strong:text-white prose-code:before:content-none prose-code:after:content-none prose-pre:bg-[#1e1e2e] prose-pre:text-[#cdd6f4] prose-th:border prose-th:border-gray-300 dark:prose-th:border-gray-600 prose-td:border prose-td:border-gray-300 dark:prose-td:border-gray-600 prose-img:rounded-lg prose-a:text-primary"
        dangerouslySetInnerHTML={{ __html: rendered }}
      />
    </div>
  );
}
