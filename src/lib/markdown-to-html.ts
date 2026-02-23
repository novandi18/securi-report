import { marked } from "marked";
import DOMPurify from "dompurify";

/**
 * Convert Markdown text to sanitized HTML.
 *
 * Uses the `marked` library for parsing, with DOMPurify for XSS protection.
 * Falls back to basic sanitization if DOMPurify is not available (SSR).
 */
export function markdownToHtml(input: string): string {
  if (!input || !input.trim()) return "";

  // Configure marked for security
  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  const rawHtml = marked.parse(input, { async: false }) as string;

  // Sanitize HTML (only in browser where DOMPurify works)
  if (typeof window !== "undefined") {
    return DOMPurify.sanitize(rawHtml, {
      ADD_TAGS: ["figure", "figcaption"],
      ADD_ATTR: ["target"],
    });
  }

  // Server-side: basic sanitization
  return sanitizeHtmlBasic(rawHtml);
}

/**
 * Server-side basic HTML sanitization.
 * Strips script tags and dangerous attributes.
 */
function sanitizeHtmlBasic(html: string): string {
  let result = html;
  result = result.replace(/<script[\s\S]*?<\/script>/gi, "");
  result = result.replace(/javascript:/gi, "");
  result = result.replace(/on\w+\s*=/gi, "");
  return result;
}

/**
 * Escapes HTML special characters.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
