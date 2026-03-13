import { Marked } from "marked";
import DOMPurify from "dompurify";

/**
 * A dedicated Marked instance so we never mutate global state.
 */
const md = new Marked({
  breaks: true,
  gfm: true,
});

/**
 * Convert Markdown text to sanitized HTML.
 *
 * Uses the `marked` library for parsing, with DOMPurify for XSS protection.
 * Falls back to basic sanitization if DOMPurify is not available (SSR).
 */
export function markdownToHtml(input: string): string {
  if (!input || !input.trim()) return "";

  // Collapse 3+ consecutive newlines into 2 (one blank line max)
  // so that `breaks: true` doesn't produce excessive <br> tags
  const normalized = input.replace(/\n{3,}/g, "\n\n");

  const rawHtml = md.parse(normalized, { async: false }) as string;

  // Sanitize HTML (only in browser where DOMPurify works)
  if (typeof window !== "undefined") {
    return DOMPurify.sanitize(rawHtml, {
      ADD_TAGS: ["figure", "figcaption", "input"],
      ADD_ATTR: ["target", "type", "checked", "disabled", "class"],
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|blob|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
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
