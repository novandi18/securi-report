/**
 * LaTeX Input Sanitization
 *
 * Strips dangerous LaTeX commands that could lead to:
 * - Command Injection (e.g., \input, \write18, \immediate)
 * - File system access (\openin, \openout, \read, \write)
 * - Environment variable leakage (\csname, shell-escape)
 * - XSS via malicious macros
 *
 * OWASP A03:2021 — Injection
 * CWE-78: OS Command Injection
 * CWE-94: Code Injection
 */

/**
 * Dangerous LaTeX commands that can execute OS commands or access the file system.
 * These MUST be stripped before any server-side processing.
 */
const DANGEROUS_COMMANDS: RegExp[] = [
  // Shell execution / system commands
  /\\immediate\b/gi,
  /\\write18\b/gi,
  /\\ShellEscape\b/gi,
  /\\directlua\b/gi,
  /\\luaescapestring\b/gi,
  /\\luadirect\b/gi,

  // File I/O commands
  /\\input\{[^}]*\}/gi,
  /\\include\{[^}]*\}/gi,
  /\\openin\b/gi,
  /\\openout\b/gi,
  /\\read\b/gi,
  /\\write\b(?!18)/gi,    // \write (not \write18 which is caught above)
  /\\closein\b/gi,
  /\\closeout\b/gi,

  // Catcode manipulation (can redefine characters)
  /\\catcode\b/gi,

  // Dangerous environment-level commands
  /\\csname\b[\s\S]*?\\endcsname/gi,
  /\\expandafter\b/gi,

  // Package loading (could load malicious packages)
  /\\usepackage\{[^}]*\}/gi,
  /\\RequirePackage\{[^}]*\}/gi,

  // Definition commands that could define dangerous macros
  /\\def\\[a-zA-Z]+/gi,
  /\\edef\\[a-zA-Z]+/gi,
  /\\gdef\\[a-zA-Z]+/gi,
  /\\xdef\\[a-zA-Z]+/gi,
  /\\newcommand\b/gi,
  /\\renewcommand\b/gi,
  /\\providecommand\b/gi,

  // Looping constructs (potential DoS)
  /\\loop\b/gi,
  /\\repeat\b/gi,

  // TeX primitives that bypass security
  /\\special\{[^}]*\}/gi,

  // Document class (shouldn't appear in content fields)
  /\\documentclass\b/gi,
  /\\begin\{document\}/gi,
  /\\end\{document\}/gi,
];

/**
 * Allowed LaTeX environments for report content.
 * Any `\begin{...}` not in this list will be stripped.
 */
const ALLOWED_ENVIRONMENTS = new Set([
  "itemize",
  "enumerate",
  "description",
  "tabular",
  "verbatim",
  "quote",
  "quotation",
  "center",
  "flushleft",
  "flushright",
  "figure",
  "table",
  "minipage",
  "array",
  "align",
  "align*",
  "equation",
  "equation*",
  "gather",
  "gather*",
  "multline",
  "multline*",
  "cases",
  "matrix",
  "bmatrix",
  "pmatrix",
  "vmatrix",
  "Vmatrix",
]);

/**
 * Sanitize LaTeX input by stripping dangerous commands.
 *
 * This is the primary entry point for all user-supplied LaTeX content
 * (executive_summary, impact, scope, methodology, recommendation_summary, etc.)
 *
 * @param input  Raw LaTeX string from user
 * @returns      Sanitized LaTeX string safe for server-side rendering
 */
export function sanitizeLatex(input: string): string {
  if (!input) return "";

  let result = input;

  // 1. Strip all dangerous commands
  for (const pattern of DANGEROUS_COMMANDS) {
    result = result.replace(pattern, "");
  }

  // 2. Strip disallowed environments
  result = result.replace(
    /\\begin\{([^}]+)\}([\s\S]*?)\\end\{\1\}/g,
    (match, envName: string) => {
      const normalized = envName.trim().toLowerCase();
      if (ALLOWED_ENVIRONMENTS.has(envName.trim())) {
        return match; // Keep allowed environments
      }
      // Strip unknown/dangerous environments
      return "";
    },
  );

  // 3. Remove any embedded script-like content (defense-in-depth against XSS)
  result = result.replace(/<script[\s\S]*?<\/script>/gi, "");
  result = result.replace(/javascript:/gi, "");
  result = result.replace(/on\w+\s*=/gi, "");

  // 4. Prevent path traversal in \includegraphics
  result = result.replace(
    /\\includegraphics(\[[^\]]*\])?\{([^}]*)\}/g,
    (match, opts: string | undefined, path: string) => {
      // Block path traversal attempts
      if (path.includes("..") || path.startsWith("/etc") || path.startsWith("/proc")) {
        return "";
      }
      // Only allow relative paths under /uploads/ or http(s) URLs
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

  return result.trim();
}

/**
 * Configure KaTeX rendering options for safe preview.
 * Disables macro definitions that could leak environment data.
 */
export const SAFE_KATEX_OPTIONS = {
  throwOnError: false,
  trust: false, // CRITICAL: disable \url, \href with trust=false for previews
  strict: "warn" as const,
  maxSize: 500,   // Prevent extremely large renders (DoS mitigation)
  maxExpand: 100,  // Limit macro expansion depth
} as const;

/**
 * Safe KaTeX options for server-side rendering in PDFs
 * (slightly more permissive since content has been pre-sanitized).
 */
export const SAFE_KATEX_PDF_OPTIONS = {
  throwOnError: false,
  trust: false,
  strict: false as const,
  maxSize: 1000,
  maxExpand: 200,
} as const;
