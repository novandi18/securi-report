import nodemailer from "nodemailer";

// ─── SMTP Configuration ──────────────────────────────────
// Reads from environment variables. Add these to your .env:
//   SMTP_HOST=smtp.example.com
//   SMTP_PORT=587
//   SMTP_USER=your-email@example.com
//   SMTP_PASS=your-app-password
//   SMTP_FROM="SecuriReport <noreply@example.com>"

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn(
      "[email] SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS environment variables.",
    );
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

const FROM_ADDRESS =
  process.env.SMTP_FROM || "admin@demomailtrap.co";

// ─── Send email helper ───────────────────────────────────
async function sendMail(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn(`[email] Skipped sending "${subject}" to ${to} — SMTP not configured.`);
    return false;
  }

  try {
    await transporter.sendMail({ from: FROM_ADDRESS, to, subject, html });
    console.log(`[email] Sent "${subject}" to ${to}`);
    return true;
  } catch (error) {
    console.error(`[email] Failed to send "${subject}" to ${to}:`, error);
    return false;
  }
}

// ─── New User Credentials Email ──────────────────────────
export async function sendNewUserCredentials(
  to: string,
  username: string,
  password: string,
  loginUrl: string,
): Promise<boolean> {
  const subject = "Your SecuriReport Account Has Been Created";
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1E3A5F; margin-bottom: 24px;">Welcome to SecuriReport</h2>
      <p>Hello <strong>${escapeHtml(username)}</strong>,</p>
      <p>Your account has been created. Here are your login credentials:</p>
      <div style="background: #f4f6f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Username:</strong> ${escapeHtml(username)}</p>
        <p style="margin: 4px 0;"><strong>Password:</strong> <code style="background: #e2e6ea; padding: 2px 6px; border-radius: 4px;">${escapeHtml(password)}</code></p>
      </div>
      <p style="color: #e74c3c; font-weight: 600;">⚠️ You will be required to change your password on first login.</p>
      <p>
        <a href="${escapeHtml(loginUrl)}" style="display: inline-block; background: #3C50E0; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
          Login Now
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #e2e6ea; margin: 24px 0;" />
      <p style="color: #888; font-size: 12px;">This is an automated message. Do not reply to this email.</p>
    </div>
  `;
  return sendMail(to, subject, html);
}

// ─── Password Reset Email ────────────────────────────────
export async function sendPasswordResetCredentials(
  to: string,
  username: string,
  newPassword: string,
  loginUrl: string,
): Promise<boolean> {
  const subject = "Your SecuriReport Password Has Been Reset";
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1E3A5F; margin-bottom: 24px;">Password Reset</h2>
      <p>Hello <strong>${escapeHtml(username)}</strong>,</p>
      <p>Your password has been reset by an administrator. Here are your new credentials:</p>
      <div style="background: #f4f6f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Username:</strong> ${escapeHtml(username)}</p>
        <p style="margin: 4px 0;"><strong>New Password:</strong> <code style="background: #e2e6ea; padding: 2px 6px; border-radius: 4px;">${escapeHtml(newPassword)}</code></p>
      </div>
      <p style="color: #e74c3c; font-weight: 600;">⚠️ You will be required to change your password on your next login.</p>
      <p>
        <a href="${escapeHtml(loginUrl)}" style="display: inline-block; background: #3C50E0; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
          Login Now
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #e2e6ea; margin: 24px 0;" />
      <p style="color: #888; font-size: 12px;">This is an automated message. Do not reply to this email.</p>
    </div>
  `;
  return sendMail(to, subject, html);
}

// ─── Password Reset Request Notification (to admins) ─────
export async function sendResetRequestNotification(
  adminEmail: string,
  requestingUsername: string,
  requestingEmail: string,
): Promise<boolean> {
  const subject = `Password Reset Request from ${requestingUsername}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1E3A5F; margin-bottom: 24px;">Password Reset Request</h2>
      <p>User <strong>${escapeHtml(requestingUsername)}</strong> (${escapeHtml(requestingEmail)}) has requested a password reset.</p>
      <p>Please log in to SecuriReport and navigate to the Users page to approve or handle the reset request.</p>
      <hr style="border: none; border-top: 1px solid #e2e6ea; margin: 24px 0;" />
      <p style="color: #888; font-size: 12px;">This is an automated message from SecuriReport.</p>
    </div>
  `;
  return sendMail(adminEmail, subject, html);
}

// ─── Generic Notification Email ──────────────────────────
const SEVERITY_COLORS: Record<string, string> = {
  critical: "#e74c3c",
  high: "#e67e22",
  medium: "#f39c12",
  low: "#3498db",
  info: "#3C50E0",
};

/**
 * Send a notification email for critical alerts.
 * Used by the notification system for security events, SLA alerts, etc.
 */
export async function sendNotificationEmail(
  to: string,
  params: {
    title: string;
    message: string;
    severity?: "critical" | "high" | "medium" | "low" | "info";
    actionUrl?: string;
    actionLabel?: string;
  },
): Promise<boolean> {
  const severity = params.severity || "info";
  const color = SEVERITY_COLORS[severity] || SEVERITY_COLORS.info;
  const subject = `[SecuriReport] ${params.title}`;
  const actionButton = params.actionUrl
    ? `<p style="margin-top: 16px;">
        <a href="${escapeHtml(params.actionUrl)}" style="display: inline-block; background: ${color}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
          ${escapeHtml(params.actionLabel || "View Details")}
        </a>
      </p>`
    : "";
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="border-left: 4px solid ${color}; padding-left: 16px; margin-bottom: 24px;">
        <h2 style="color: #1E3A5F; margin: 0 0 4px 0;">${escapeHtml(params.title)}</h2>
        <span style="display: inline-block; background: ${color}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; text-transform: uppercase; font-weight: 600;">${severity}</span>
      </div>
      <p style="color: #333; line-height: 1.6;">${escapeHtml(params.message)}</p>
      ${actionButton}
      <hr style="border: none; border-top: 1px solid #e2e6ea; margin: 24px 0;" />
      <p style="color: #888; font-size: 12px;">This is an automated security notification from SecuriReport. Do not reply to this email.</p>
    </div>
  `;
  return sendMail(to, subject, html);
}

// ─── Auto-generate secure password ───────────────────────
export function generateSecurePassword(length = 16): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*?";
  const all = upper + lower + digits + special;

  // Ensure at least one from each category
  const required = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];

  const remaining = Array.from({ length: length - required.length }, () =>
    all[Math.floor(Math.random() * all.length)],
  );

  // Shuffle to avoid predictable positions
  const chars = [...required, ...remaining];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

// ─── HTML escape helper ──────────────────────────────────
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
