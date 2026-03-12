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
        className="markdown-preview prose max-w-none dark:prose-invert text-dark dark:text-white [&_table]:border-collapse [&_table]:my-4 [&_th]:border [&_th]:border-gray-300 [&_th]:dark:border-gray-600 [&_th]:bg-gray-100 [&_th]:dark:bg-gray-700 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-gray-300 [&_td]:dark:border-gray-600 [&_td]:px-3 [&_td]:py-2 [&_pre]:bg-[#1e1e2e] [&_pre]:text-[#cdd6f4] [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:text-sm [&_code:not(pre_code)]:bg-gray-100 [&_code:not(pre_code)]:dark:bg-gray-700 [&_code:not(pre_code)]:px-1.5 [&_code:not(pre_code)]:py-0.5 [&_code:not(pre_code)]:rounded [&_code:not(pre_code)]:text-[0.9em] [&_.contains-task-list]:list-none [&_.contains-task-list]:pl-0 [&_.task-list-item]:flex [&_.task-list-item]:items-start [&_.task-list-item]:gap-2 [&_.task-list-item_input]:mt-1 [&_.task-list-item_input]:accent-primary [&_ol[type='a']]:list-[lower-alpha] [&_ol[type='A']]:list-[upper-alpha] [&_ol[type='i']]:list-[lower-roman] [&_ol[type='I']]:list-[upper-roman] [&_ol[type]]:pl-6 [&_ol[type]_li]:my-1 [&_sup]:text-[0.75em] [&_sup]:align-super [&_sub]:text-[0.75em] [&_sub]:align-sub"
        dangerouslySetInnerHTML={{ __html: rendered }}
      />
    </div>
  );
}
