/**
 * Centralized Audit Logger
 *
 * Records all critical operations (write/delete/auth events)
 * with timestamp, user ID, action type, IP address, and resource ID.
 *
 * OWASP A09:2021 — Security Logging and Monitoring Failures
 */

import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { getClientIp } from "@/lib/security/access-control";
import { getAttemptCount } from "@/lib/security/rate-limiter";
import { createNotificationForRole } from "@/lib/actions/notification";

// ─── Action Types ─────────────────────────────────────────
export type AuditAction =
  // Auth
  | "auth.login"
  | "auth.login_failed"
  | "auth.login_2fa"
  | "auth.logout"
  | "auth.register"
  | "auth.forgot_password"
  // User management
  | "user.create"
  | "user.update"
  | "user.delete"
  | "user.password_reset"
  // Profile
  | "profile.update"
  | "password.change"
  // 2FA
  | "2fa.enabled"
  | "2fa.disabled"
  | "2fa.backup_codes_regenerated"
  // Reports
  | "report.create"
  | "report.update"
  | "report.delete"
  | "report.merge"
  | "report.merged_closed"
  | "report.ai_generate"
  // Customers
  | "customer.create"
  | "customer.update"
  | "customer.delete"
  // Deliverables
  | "deliverable.generate"
  | "deliverable.delete"
  // Templates
  | "template.create"
  | "template.update"
  | "template.delete"
  // Framework entries
  | "cwe.create"
  | "cwe.delete"
  | "owasp.create"
  | "owasp.delete"
  // Settings
  | "app_settings.update"
  // Custom Template
  | "custom_template.upload"
  | "custom_template.delete"
  | "custom_template.generate_markdown"
  | "custom_template.save_markdown"
  // Upload
  | "upload.image"
  // Search
  | "search.reindex";

interface AuditLogEntry {
  userId: string;
  action: AuditAction;
  resourceId?: string;
  ip?: string;
  detail?: string;
}

/**
 * Write an audit log entry.
 *
 * Non-blocking: errors are caught and logged to stderr
 * to avoid disrupting the main request flow.
 */
export async function audit(entry: AuditLogEntry): Promise<void> {
  try {
    const ip = entry.ip || (await getClientIp().catch(() => "unknown"));

    await db.insert(auditLogs).values({
      userId: entry.userId,
      action: entry.action,
      ipAddress: ip,
    });
  } catch (error) {
    // Never let audit logging break the main request
    console.error("[AUDIT] Failed to write log:", error);
  }
}

/**
 * Detect brute-force login pattern and alert administrators.
 *
 * Triggers a dashboard notification when ≥5 failed login attempts
 * from the same IP within 10 minutes.
 *
 * @param ip  The attacker's IP address
 */
export async function detectBruteForce(ip: string): Promise<void> {
  try {
    const THRESHOLD = 5;
    const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

    const attempts = getAttemptCount(`login:${ip}`, WINDOW_MS);

    if (attempts >= THRESHOLD) {
      // Notify all administrators (with email for critical alert)
      await createNotificationForRole("administrator", {
        category: "security",
        type: "brute_force_detected",
        title: "⚠️ Brute-Force Attempt Detected",
        message: `${attempts} failed login attempts detected from IP ${ip} within 10 minutes. Consider blocking this IP.`,
        sendEmail: true,
        emailSeverity: "critical",
      });
    }
  } catch (error) {
    console.error("[AUDIT] Brute-force detection failed:", error);
  }
}
