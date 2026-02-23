/**
 * Markdown Input Sanitization
 *
 * Strips dangerous content from Markdown that could lead to:
 * - XSS via embedded HTML/JavaScript
 * - Script injection via markdown links/images
 * - Path traversal via image references
 *
 * OWASP A03:2021 — Injection
 * CWE-79: Cross-site Scripting (XSS)
 * CWE-94: Code Injection
 */

/**
 * Sanitize Markdown input by stripping dangerous content.
 *
 * This is the primary entry point for all user-supplied Markdown content
 * (executive_summary, impact, scope, methodology, recommendation_summary, etc.)
 *
 * @param input  Raw Markdown string from user
 * @returns      Sanitized Markdown string safe for server-side rendering
 */
export function sanitizeMarkdown(input: string): string {
  if (!input) return "";

  let result = input;

  // 1. Remove embedded HTML script tags
  result = result.replace(/<script[\s\S]*?<\/script>/gi, "");

  // 2. Remove javascript: protocol in links
  result = result.replace(/\[([^\]]*)\]\(javascript:[^)]*\)/gi, "[$1](#)");

  // 3. Remove on* event handlers in any inline HTML
  result = result.replace(/on\w+\s*=\s*["'][^"']*["']/gi, "");
  result = result.replace(/on\w+\s*=\s*[^\s>]*/gi, "");

  // 4. Remove iframe, object, embed, form tags
  result = result.replace(/<(iframe|object|embed|form|style)[\s\S]*?<\/\1>/gi, "");
  result = result.replace(/<(iframe|object|embed|form|style)[^>]*\/?>/gi, "");

  // 5. Remove data: URIs in image sources (except data:image/ which are safe for inline images)
  result = result.replace(
    /!\[([^\]]*)\]\((data:(?!image\/)[^)]*)\)/gi,
    "![$1](#)",
  );

  // 6. Prevent path traversal in image references
  result = result.replace(
    /!\[([^\]]*)\]\(([^)]*)\)/g,
    (match, alt: string, path: string) => {
      // Block path traversal attempts
      if (path.includes("..") || path.startsWith("/etc") || path.startsWith("/proc")) {
        return "";
      }
      // Only allow relative paths under /uploads/, http(s) URLs, or data:image URIs
      if (
        path.startsWith("/uploads/") ||
        path.startsWith("http://") ||
        path.startsWith("https://") ||
        path.startsWith("data:image/")
      ) {
        return match;
      }
      return ""; // Strip suspicious paths
    },
  );

  // 7. Remove base64-encoded content that's not images
  result = result.replace(/data:[^;]+;base64,(?!(?:[A-Za-z0-9+/=\s]){0,100}$)[^\s)"]*/gi, "");

  return result.trim();
}
