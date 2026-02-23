/**
 * Security module barrel export.
 *
 * All security utilities are consolidated here for clean imports:
 *   import { requireAuth, audit, sanitizeMarkdown, checkLoginRateLimit } from "@/lib/security";
 */

export {
  requireAuth,
  requireRole,
  requireAdmin,
  requireEditor,
  withAccessControl,
  assertOwnership,
  getClientIp,
  AccessDeniedError,
  type AuthenticatedUser,
  type Role,
} from "./access-control";

export {
  checkRateLimit,
  resetRateLimit,
  checkLoginRateLimit,
  checkForgotPasswordRateLimit,
  checkDeleteRateLimit,
  check2FARateLimit,
  getAttemptCount,
  type RateLimitResult,
} from "./rate-limiter";

export {
  sanitizeMarkdown,
} from "./markdown-sanitizer";

export {
  audit,
  detectBruteForce,
  type AuditAction,
} from "./audit-logger";
